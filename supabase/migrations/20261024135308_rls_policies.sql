-- Migration 2 of 4 (DEVELOPMENT.md 9.13): policies and column grants.
--
-- Supabase grants anon and authenticated full access on every new table, and
-- policies only filter rows within that access. So all of it is revoked first
-- and only what DEVELOPMENT.md 9.12 allows is granted back. Column grants keep
-- users away from status, owner and reviewer columns; those change only
-- through the functions in the next migration.
--
-- There are no DELETE grants or policies: users close reports, they don't
-- delete rows. admins has no grants or policies at all; it is read only by
-- is_admin().
--
-- Policies wrap auth.uid() and is_admin() in a select so each runs once per
-- query instead of once per row.


-- Grants ---------------------------------------------------------------------

revoke all on table
  public.profiles,
  public.campus_locations,
  public.item_reports,
  public.item_private_details,
  public.claims,
  public.abuse_reports,
  public.admins,
  public.admin_audit_log
from anon, authenticated;

grant select on table
  public.campus_locations,
  public.item_reports
to anon;

-- Policies below decide which rows each signed-in user (or admin) sees.
grant select on table
  public.profiles,
  public.campus_locations,
  public.item_reports,
  public.item_private_details,
  public.claims,
  public.abuse_reports,
  public.admin_audit_log
to authenticated;

grant update (full_name) on public.profiles to authenticated;

-- user_id and status come from column defaults; report_type is fixed after
-- insert.
grant insert (
  report_type, title, description, category,
  location_key, location_detail, event_date, image_path
) on public.item_reports to authenticated;
grant update (
  title, description, category,
  location_key, location_detail, event_date, image_path
) on public.item_reports to authenticated;

grant insert (item_id, details) on public.item_private_details to authenticated;
grant update (details) on public.item_private_details to authenticated;

-- reporter_id comes from its default; status and reviewer columns change only
-- through admin_review_flag().
grant insert (item_id, reason, details) on public.abuse_reports to authenticated;


-- Helper functions -----------------------------------------------------------

-- Used by policies and by the UI (through rpc) to decide what to show.
-- Reveals only whether the caller is an admin.
create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admins where user_id = (select auth.uid())
  );
$$;

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- Helpers used only inside policies. They live in a schema the API doesn't
-- expose. Being security definer, they read item_reports and claims without
-- running those tables' policies, which would otherwise call each other in a
-- loop. Each answers a question about the caller only.
create schema private;

revoke all on schema private from public;
grant usage on schema private to authenticated;

create function private.is_report_owner(p_item_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.item_reports
    where id = p_item_id and user_id = (select auth.uid())
  );
$$;

-- Only open claims count, so a claimant whose claim was rejected, cancelled
-- or closed loses access once the report is no longer active.
create function private.has_claim_on_report(p_item_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.claims
    where item_id = p_item_id
      and claimant_id = (select auth.uid())
      and status in ('pending', 'approved')
  );
$$;

revoke execute on function private.is_report_owner(uuid) from public, anon;
revoke execute on function private.has_claim_on_report(uuid) from public, anon;
grant execute on function private.is_report_owner(uuid) to authenticated;
grant execute on function private.has_claim_on_report(uuid) to authenticated;


-- profiles -------------------------------------------------------------------

create policy profiles_select_own_or_admin
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));

create policy profiles_update_own
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));


-- campus_locations -----------------------------------------------------------

create policy campus_locations_select_active
  on public.campus_locations for select to anon
  using (is_active);

create policy campus_locations_select_active_or_admin
  on public.campus_locations for select to authenticated
  using (is_active or (select public.is_admin()));


-- item_reports ---------------------------------------------------------------

create policy item_reports_select_active
  on public.item_reports for select to anon
  using (status = 'active');

-- A claimant with a pending or approved claim keeps seeing the report, for
-- example an approved claim on a resolved report. Hiding a report closes its
-- claims; the hidden check also holds if one were missed.
create policy item_reports_select_visible
  on public.item_reports for select to authenticated
  using (
    status = 'active'
    or user_id = (select auth.uid())
    or (status <> 'hidden' and private.has_claim_on_report(id))
    or (select public.is_admin())
  );

create policy item_reports_insert_own
  on public.item_reports for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'active');

create policy item_reports_update_own_active
  on public.item_reports for update to authenticated
  using (user_id = (select auth.uid()) and status = 'active')
  with check (user_id = (select auth.uid()) and status = 'active');


-- item_private_details -------------------------------------------------------

create policy item_private_details_select_owner_or_admin
  on public.item_private_details for select to authenticated
  using (private.is_report_owner(item_id) or (select public.is_admin()));

-- Writable only while the report is active, like report content (8.6). The
-- subquery runs under item_reports' policies, which don't look at this
-- table, so there is no loop.
create policy item_private_details_insert_owner_active
  on public.item_private_details for insert to authenticated
  with check (exists (
    select 1 from public.item_reports r
    where r.id = item_private_details.item_id
      and r.user_id = (select auth.uid()) and r.status = 'active'
  ));

create policy item_private_details_update_owner_active
  on public.item_private_details for update to authenticated
  using (exists (
    select 1 from public.item_reports r
    where r.id = item_private_details.item_id
      and r.user_id = (select auth.uid()) and r.status = 'active'
  ))
  with check (exists (
    select 1 from public.item_reports r
    where r.id = item_private_details.item_id
      and r.user_id = (select auth.uid()) and r.status = 'active'
  ));


-- claims ---------------------------------------------------------------------

-- Read only. Claims are written by the claim functions in the next migration.
create policy claims_select_party_or_admin
  on public.claims for select to authenticated
  using (
    claimant_id = (select auth.uid())
    or private.is_report_owner(item_id)
    or (select public.is_admin())
  );


-- abuse_reports --------------------------------------------------------------

create policy abuse_reports_select_own_or_admin
  on public.abuse_reports for select to authenticated
  using (reporter_id = (select auth.uid()) or (select public.is_admin()));

-- The subquery runs under item_reports' policies, so users can flag only
-- reports they can see, and can't probe for hidden or unknown report IDs.
create policy abuse_reports_insert_own_on_visible
  on public.abuse_reports for insert to authenticated
  with check (
    reporter_id = (select auth.uid())
    and exists (
      select 1 from public.item_reports r where r.id = abuse_reports.item_id
    )
  );


-- admin_audit_log ------------------------------------------------------------

-- Read only. Rows are written by the admin functions in the next migration.
create policy admin_audit_log_select_admin
  on public.admin_audit_log for select to authenticated
  using ((select public.is_admin()));
