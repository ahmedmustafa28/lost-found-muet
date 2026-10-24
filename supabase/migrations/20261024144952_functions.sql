-- Migration 3 of 4 (DEVELOPMENT.md 9.13): functions and triggers.
--
-- Every status change happens in the functions below (DEVELOPMENT.md 8.6,
-- 8.7, 9.10). Functions the app calls with rpc are in public; internal
-- helpers and trigger functions are in private, which the API doesn't
-- expose. All are security definer (so they bypass RLS) with an empty
-- search_path, and check auth.uid() themselves.
--
-- Errors: the message is the code from DEVELOPMENT.md 9.10, so the app can
-- map it to a friendly message; input errors name the field in detail.
-- NOT_FOUND means the caller couldn't see the row under the 9.12 rules, so
-- nobody can probe for IDs. NOT_ALLOWED means they can see it but may not do
-- this.
--
-- Locking: a function that reads a row and then changes it locks the report
-- first, then the claim, always in that order, so two calls can't deadlock
-- and two people can't approve claims on the same report at once.


-- Trimming --------------------------------------------------------------------

-- Trims the same characters as JavaScript's String.prototype.trim(), which
-- Zod's .trim() uses, so the database rejects the same blank text as the
-- form. Plain btrim() removes only spaces, so 10 newlines passed as a claim
-- message. authenticated needs execute because the check constraints below
-- call it when users write those tables.
create function private.trim_text(p_text text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select btrim(
    p_text,
    -- space, tab, line feed, carriage return, vertical tab, form feed, and
    -- the Unicode spaces and line separators JavaScript also trims
    E' \t\n\r\u000B\f         '
    || E'        　﻿'
  );
$$;

revoke execute on function private.trim_text(text) from public, anon;
grant execute on function private.trim_text(text) to authenticated;

-- The core_tables migration checked minimum lengths with btrim(). It is
-- already applied, so its constraints are replaced here under the same names.
alter table public.profiles
  drop constraint profiles_full_name_length,
  add constraint profiles_full_name_length
    check (char_length(private.trim_text(full_name)) >= 2 and char_length(full_name) <= 80);
alter table public.item_reports
  drop constraint item_reports_title_length,
  add constraint item_reports_title_length
    check (char_length(private.trim_text(title)) >= 3 and char_length(title) <= 80),
  drop constraint item_reports_description_length,
  add constraint item_reports_description_length
    check (char_length(private.trim_text(description)) >= 10 and char_length(description) <= 1000);
alter table public.item_private_details
  drop constraint item_private_details_details_length,
  add constraint item_private_details_details_length
    check (char_length(private.trim_text(details)) >= 1 and char_length(details) <= 500);
alter table public.claims
  drop constraint claims_message_length,
  add constraint claims_message_length
    check (char_length(private.trim_text(message)) >= 10 and char_length(message) <= 1000),
  drop constraint claims_handover_note_length,
  add constraint claims_handover_note_length
    check (char_length(private.trim_text(handover_note)) >= 5 and char_length(handover_note) <= 500);

-- The admin functions require a reason of 1-500 characters (TEXT_LIMITS in
-- src/lib/constants.ts). Null stays allowed for any future action without
-- one.
alter table public.admin_audit_log
  add constraint admin_audit_log_reason_length
  check (char_length(private.trim_text(reason)) >= 1 and char_length(reason) <= 500);


-- Internal helpers ------------------------------------------------------------

-- The item_reports_select_visible rule, for functions that bypass RLS.
create function private.can_see_report(p_item_id uuid, p_owner_id uuid, p_status text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_status = 'active'
    or p_owner_id = (select auth.uid())
    or (p_status <> 'hidden' and private.has_claim_on_report(p_item_id))
    or public.is_admin();
$$;

-- Locks a report the caller can see. Raises NOT_SIGNED_IN or NOT_FOUND; the
-- caller checks what this person may do with it.
create function private.lock_visible_report(p_item_id uuid)
returns public.item_reports
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_report public.item_reports;
begin
  if (select auth.uid()) is null then
    raise exception 'NOT_SIGNED_IN';
  end if;

  select * into v_report from public.item_reports where id = p_item_id for update;
  if not found or not private.can_see_report(v_report.id, v_report.user_id, v_report.status) then
    raise exception 'NOT_FOUND';
  end if;

  return v_report;
end;
$$;

-- Locks a claim the caller can see (claimant, report owner or admin), and its
-- report first. Raises NOT_SIGNED_IN or NOT_FOUND.
create function private.lock_visible_claim(
  p_claim_id uuid,
  out claim public.claims,
  out report public.item_reports
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_item_id uuid;
begin
  if v_uid is null then
    raise exception 'NOT_SIGNED_IN';
  end if;

  -- A claim's item_id never changes, so reading it before the locks is safe.
  select c.item_id into v_item_id from public.claims c where c.id = p_claim_id;
  if not found then
    raise exception 'NOT_FOUND';
  end if;

  -- Either row could be gone by the time it is locked. Check both, because
  -- comparisons on a missing row give null, and a null check doesn't raise.
  select * into report from public.item_reports r where r.id = v_item_id for update;
  if not found then
    raise exception 'NOT_FOUND';
  end if;
  select * into claim from public.claims c where c.id = p_claim_id for update;
  if not found then
    raise exception 'NOT_FOUND';
  end if;

  if claim.claimant_id is distinct from v_uid
    and report.user_id is distinct from v_uid
    and not public.is_admin()
  then
    raise exception 'NOT_FOUND';
  end if;
end;
$$;

-- Raises NOT_SIGNED_IN or NOT_ALLOWED unless the caller is an admin.
create function private.require_admin()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'NOT_SIGNED_IN';
  end if;
  if not public.is_admin() then
    raise exception 'NOT_ALLOWED';
  end if;
end;
$$;

-- Returns the trimmed admin reason, or raises INVALID_INPUT.
create function private.clean_admin_reason(p_reason text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_reason text := private.trim_text(p_reason);
begin
  if v_reason is null or char_length(v_reason) not between 1 and 500 then
    raise exception 'INVALID_INPUT' using detail = 'reason';
  end if;
  return v_reason;
end;
$$;

revoke execute on function private.can_see_report(uuid, uuid, text) from public, anon, authenticated;
revoke execute on function private.lock_visible_report(uuid) from public, anon, authenticated;
revoke execute on function private.lock_visible_claim(uuid) from public, anon, authenticated;
revoke execute on function private.require_admin() from public, anon, authenticated;
revoke execute on function private.clean_admin_reason(text) from public, anon, authenticated;


-- Claim functions -------------------------------------------------------------

-- "This is mine" on a found report, "I found this" on a lost report.
create function public.submit_claim(p_item_id uuid, p_message text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_message text := private.trim_text(p_message);
  v_report public.item_reports;
  v_claim_id uuid;
begin
  if v_uid is null then
    raise exception 'NOT_SIGNED_IN';
  end if;
  if v_message is null or char_length(v_message) not between 10 and 1000 then
    raise exception 'INVALID_INPUT' using detail = 'message';
  end if;

  -- for share: other claimants can submit at the same time, but the report
  -- can't be resolved, closed or hidden until this claim is saved.
  select * into v_report from public.item_reports where id = p_item_id for share;
  if not found or not private.can_see_report(v_report.id, v_report.user_id, v_report.status) then
    raise exception 'NOT_FOUND';
  end if;
  if v_report.user_id is not distinct from v_uid then
    raise exception 'OWN_ITEM';
  end if;
  if v_report.status <> 'active' then
    raise exception 'ITEM_NOT_ACTIVE';
  end if;
  if exists (
    select 1 from public.claims
    where item_id = p_item_id and claimant_id = v_uid and status in ('pending', 'approved')
  ) then
    raise exception 'DUPLICATE_CLAIM';
  end if;

  insert into public.claims (item_id, claimant_id, claim_type, message)
  values (
    p_item_id,
    v_uid,
    case v_report.report_type when 'found' then 'ownership' else 'found_match' end,
    v_message
  )
  returning id into v_claim_id;

  return v_claim_id;
exception
  -- Two submits by the same person at once: the unique index catches it.
  when unique_violation then
    raise exception 'DUPLICATE_CLAIM';
end;
$$;

create function public.approve_claim(p_claim_id uuid, p_handover_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_note text := private.trim_text(p_handover_note);
  v_locked record;
  v_claim public.claims;
  v_report public.item_reports;
begin
  select * into v_locked from private.lock_visible_claim(p_claim_id);
  v_claim := v_locked.claim;
  v_report := v_locked.report;

  -- An admin can't review their own claim.
  if (v_report.user_id is distinct from v_uid and not public.is_admin())
    or v_claim.claimant_id is not distinct from v_uid
  then
    raise exception 'NOT_ALLOWED';
  end if;
  if v_note is null or char_length(v_note) not between 5 and 500 then
    raise exception 'INVALID_INPUT' using detail = 'handover_note';
  end if;
  if v_report.status <> 'active' then
    raise exception 'ITEM_NOT_ACTIVE';
  end if;
  if v_claim.status <> 'pending' then
    raise exception 'INVALID_STATUS';
  end if;
  if exists (
    select 1 from public.claims where item_id = v_report.id and status = 'approved'
  ) then
    raise exception 'ALREADY_APPROVED';
  end if;

  update public.claims
  set status = 'approved', handover_note = v_note, reviewed_by = v_uid, reviewed_at = now()
  where id = v_claim.id;
exception
  when unique_violation then
    raise exception 'ALREADY_APPROVED';
end;
$$;

create function public.reject_claim(p_claim_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_locked record;
  v_claim public.claims;
  v_report public.item_reports;
begin
  select * into v_locked from private.lock_visible_claim(p_claim_id);
  v_claim := v_locked.claim;
  v_report := v_locked.report;

  if (v_report.user_id is distinct from v_uid and not public.is_admin())
    or v_claim.claimant_id is not distinct from v_uid
  then
    raise exception 'NOT_ALLOWED';
  end if;
  if v_report.status <> 'active' then
    raise exception 'ITEM_NOT_ACTIVE';
  end if;
  if v_claim.status not in ('pending', 'approved') then
    raise exception 'INVALID_STATUS';
  end if;

  update public.claims
  set status = 'rejected', reviewed_by = v_uid, reviewed_at = now()
  where id = v_claim.id;
end;
$$;

create function public.cancel_claim(p_claim_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_locked record;
  v_claim public.claims;
  v_report public.item_reports;
begin
  select * into v_locked from private.lock_visible_claim(p_claim_id);
  v_claim := v_locked.claim;
  v_report := v_locked.report;

  if v_claim.claimant_id is distinct from v_uid then
    raise exception 'NOT_ALLOWED';
  end if;
  if v_claim.status not in ('pending', 'approved') then
    raise exception 'INVALID_STATUS';
  end if;
  -- After a report is resolved, its approved claim is the record of the
  -- handover, so it can't be withdrawn.
  if v_report.status <> 'active' then
    raise exception 'ITEM_NOT_ACTIVE';
  end if;

  update public.claims set status = 'cancelled' where id = v_claim.id;
end;
$$;

-- The other person's name and email, for the two people in an approved
-- claim only. Admins can't read it.
create function public.get_claim_contact(p_claim_id uuid)
returns table (full_name text, email text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_claimant_id uuid;
  v_owner_id uuid;
  v_status text;
begin
  if v_uid is null then
    raise exception 'NOT_SIGNED_IN';
  end if;

  select c.claimant_id, r.user_id, c.status
  into v_claimant_id, v_owner_id, v_status
  from public.claims c
  join public.item_reports r on r.id = c.item_id
  where c.id = p_claim_id;

  if not found or (
    v_claimant_id is distinct from v_uid
    and v_owner_id is distinct from v_uid
    and not public.is_admin()
  ) then
    raise exception 'NOT_FOUND';
  end if;
  if (v_uid is distinct from v_claimant_id and v_uid is distinct from v_owner_id)
    or v_status is distinct from 'approved'
  then
    raise exception 'NOT_ALLOWED';
  end if;

  return query
    select p.full_name, u.email::text
    from auth.users u
    left join public.profiles p on p.id = u.id
    where u.id = case when v_uid = v_claimant_id then v_owner_id else v_claimant_id end;
end;
$$;


-- Report functions ------------------------------------------------------------

create function public.resolve_report(p_item_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_report public.item_reports := private.lock_visible_report(p_item_id);
begin
  if v_report.user_id is distinct from (select auth.uid()) and not public.is_admin() then
    raise exception 'NOT_ALLOWED';
  end if;
  if v_report.status <> 'active' then
    raise exception 'INVALID_STATUS';
  end if;

  update public.item_reports set status = 'resolved', resolved_at = now() where id = v_report.id;
  -- The approved claim, if any, stays approved: it records the handover.
  update public.claims set status = 'closed' where item_id = v_report.id and status = 'pending';
end;
$$;

create function public.close_report(p_item_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_report public.item_reports := private.lock_visible_report(p_item_id);
begin
  if v_report.user_id is distinct from (select auth.uid()) and not public.is_admin() then
    raise exception 'NOT_ALLOWED';
  end if;
  if v_report.status <> 'active' then
    raise exception 'INVALID_STATUS';
  end if;

  update public.item_reports set status = 'closed' where id = v_report.id;
  update public.claims set status = 'closed'
  where item_id = v_report.id and status in ('pending', 'approved');
end;
$$;


-- Admin functions -------------------------------------------------------------

-- Only active reports can be hidden: restore always returns a report to
-- active, so hiding a resolved or closed one would bring it back as active.
create function public.admin_hide_report(p_item_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason text;
  v_report public.item_reports;
begin
  perform private.require_admin();
  v_reason := private.clean_admin_reason(p_reason);

  select * into v_report from public.item_reports where id = p_item_id for update;
  if not found then
    raise exception 'NOT_FOUND';
  end if;
  if v_report.status <> 'active' then
    raise exception 'INVALID_STATUS';
  end if;

  update public.item_reports set status = 'hidden' where id = v_report.id;
  update public.claims set status = 'closed'
  where item_id = v_report.id and status in ('pending', 'approved');
  insert into public.admin_audit_log (admin_id, action, target_type, target_id, reason)
  values ((select auth.uid()), 'hide_report', 'item_report', v_report.id, v_reason);
end;
$$;

-- Claims closed by hiding stay closed.
create function public.admin_restore_report(p_item_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason text;
  v_report public.item_reports;
begin
  perform private.require_admin();
  v_reason := private.clean_admin_reason(p_reason);

  select * into v_report from public.item_reports where id = p_item_id for update;
  if not found then
    raise exception 'NOT_FOUND';
  end if;
  if v_report.status <> 'hidden' then
    raise exception 'INVALID_STATUS';
  end if;

  update public.item_reports set status = 'active' where id = v_report.id;
  insert into public.admin_audit_log (admin_id, action, target_type, target_id, reason)
  values ((select auth.uid()), 'restore_report', 'item_report', v_report.id, v_reason);
end;
$$;

-- open -> reviewing, actioned or dismissed; reviewing -> actioned or
-- dismissed. actioned and dismissed are final.
create function public.admin_review_flag(p_flag_id uuid, p_status text, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason text;
  v_flag public.abuse_reports;
begin
  perform private.require_admin();
  if p_status is null or p_status not in ('reviewing', 'actioned', 'dismissed') then
    raise exception 'INVALID_INPUT' using detail = 'status';
  end if;
  v_reason := private.clean_admin_reason(p_reason);

  select * into v_flag from public.abuse_reports where id = p_flag_id for update;
  if not found then
    raise exception 'NOT_FOUND';
  end if;
  if not (
    v_flag.status = 'open'
    or (v_flag.status = 'reviewing' and p_status in ('actioned', 'dismissed'))
  ) then
    raise exception 'INVALID_STATUS';
  end if;

  update public.abuse_reports
  set status = p_status, reviewed_by = (select auth.uid()), reviewed_at = now()
  where id = v_flag.id;
  insert into public.admin_audit_log (admin_id, action, target_type, target_id, reason)
  values ((select auth.uid()), 'review_flag', 'abuse_report', v_flag.id, v_reason);
end;
$$;


-- Grants on the app functions -------------------------------------------------

revoke execute on function public.submit_claim(uuid, text) from public, anon;
revoke execute on function public.approve_claim(uuid, text) from public, anon;
revoke execute on function public.reject_claim(uuid) from public, anon;
revoke execute on function public.cancel_claim(uuid) from public, anon;
revoke execute on function public.get_claim_contact(uuid) from public, anon;
revoke execute on function public.resolve_report(uuid) from public, anon;
revoke execute on function public.close_report(uuid) from public, anon;
revoke execute on function public.admin_hide_report(uuid, text) from public, anon;
revoke execute on function public.admin_restore_report(uuid, text) from public, anon;
revoke execute on function public.admin_review_flag(uuid, text, text) from public, anon;

grant execute on function public.submit_claim(uuid, text) to authenticated;
grant execute on function public.approve_claim(uuid, text) to authenticated;
grant execute on function public.reject_claim(uuid) to authenticated;
grant execute on function public.cancel_claim(uuid) to authenticated;
grant execute on function public.get_claim_contact(uuid) to authenticated;
grant execute on function public.resolve_report(uuid) to authenticated;
grant execute on function public.close_report(uuid) to authenticated;
grant execute on function public.admin_hide_report(uuid, text) to authenticated;
grant execute on function public.admin_restore_report(uuid, text) to authenticated;
grant execute on function public.admin_review_flag(uuid, text, text) to authenticated;


-- Triggers --------------------------------------------------------------------

-- Creates the profile when someone signs up. Users added in the Supabase
-- dashboard have no name, so a missing or invalid name gets a placeholder
-- (DEFAULT_FULL_NAME in src/lib/constants.ts) instead of blocking sign-up.
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := private.trim_text(new.raw_user_meta_data ->> 'full_name');
begin
  if v_name is null or char_length(v_name) not between 2 and 80 then
    v_name := 'MUET user';
  end if;
  insert into public.profiles (id, full_name) values (new.id, v_name);
  return new;
end;
$$;

create trigger handle_new_user
  after insert on auth.users
  for each row execute function private.handle_new_user();

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger set_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.item_reports
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.item_private_details
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.claims
  for each row execute function private.set_updated_at();

-- Each field is checked on insert and on update only when it changes, so a
-- report can still be edited, resolved or restored after its event_date is
-- more than 365 days old or its location has been retired.
create function private.validate_item_report()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Asia/Karachi')::date;
begin
  if tg_op = 'INSERT' or new.event_date is distinct from old.event_date then
    if new.event_date > v_today or new.event_date < v_today - 365 then
      raise exception 'INVALID_INPUT' using detail = 'event_date';
    end if;
  end if;

  -- <owner user_id>/<uuid>.<jpg|png|webp>, the only paths the app generates
  -- (DEVELOPMENT.md 11.1).
  if new.image_path is not null
    and (tg_op = 'INSERT' or new.image_path is distinct from old.image_path)
    and new.image_path !~ (
      '^' || new.user_id::text
      || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$'
    )
  then
    raise exception 'INVALID_INPUT' using detail = 'image_path';
  end if;

  if (tg_op = 'INSERT' or new.location_key is distinct from old.location_key)
    and not exists (
      select 1 from public.campus_locations
      where key = new.location_key and is_active
    )
  then
    raise exception 'INVALID_INPUT' using detail = 'location_key';
  end if;

  return new;
end;
$$;

create trigger validate_item_report
  before insert or update on public.item_reports
  for each row execute function private.validate_item_report();

revoke execute on function private.handle_new_user() from public, anon, authenticated;
revoke execute on function private.set_updated_at() from public, anon, authenticated;
revoke execute on function private.validate_item_report() from public, anon, authenticated;
