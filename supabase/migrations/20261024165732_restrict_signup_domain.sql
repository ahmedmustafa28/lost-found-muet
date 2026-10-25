-- Only MUET students can have an account (DEVELOPMENT.md D-14): every email
-- must be a roll number at students.muet.edu.pk, for example
-- 23sw016@students.muet.edu.pk.
--
-- A "before user created" auth hook checks new sign-ups, and a trigger on
-- auth.users stops an existing account from changing its email to anything
-- else. The hook is turned on in supabase/config.toml for the local stack and
-- in the dashboard for hosted projects (DEVELOPMENT.md 10.1); until then,
-- only the register form checks the email.


-- Pattern ---------------------------------------------------------------------

-- The only copy in the database. STUDENT_EMAIL_PATTERN in
-- src/lib/constants.ts must be identical (tests/db/signupEmail.mjs checks).
-- Callers match it case-insensitively.
create function private.student_email_pattern()
returns text
language sql
immutable
set search_path = ''
as $$
  select '^[0-9]{2}[a-z]{2,4}[0-9]{1,3}@students\.muet\.edu\.pk$';
$$;

revoke execute on function private.student_email_pattern() from public, anon, authenticated;


-- Sign-up hook ----------------------------------------------------------------

-- Supabase Auth calls this before it creates any user. It allows only a
-- matching email; everything else is rejected, including a missing email
-- (phone or anonymous sign-ups), so an unexpected case fails closed.
create function public.restrict_signup_domain(event jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_email text := event -> 'user' ->> 'email';
begin
  if v_email ~* private.student_email_pattern() then
    return '{}'::jsonb;
  end if;

  return jsonb_build_object(
    'error', jsonb_build_object(
      'http_code', 403,
      'message', 'Use your MUET student email (your roll number, for example 23sw016@students.muet.edu.pk).'
    )
  );
end;
$$;

-- Only Supabase Auth may run the hook, as in Supabase's guide. It also needs
-- the pattern, which lives in the private schema.
grant execute on function public.restrict_signup_domain(jsonb) to supabase_auth_admin;
revoke execute on function public.restrict_signup_domain(jsonb) from authenticated, anon, public;

grant usage on schema private to supabase_auth_admin;
grant execute on function private.student_email_pattern() to supabase_auth_admin;


-- Email changes ---------------------------------------------------------------

-- The hook runs only for new users, and Supabase Auth's API lets a signed-in
-- user ask for a new email even though the app offers no way to. Auth writes
-- the requested address to email_change, then moves it to email once
-- confirmed; both are checked. auth.users is also updated on every sign-in
-- and token refresh, so the trigger's when clause skips any update that
-- leaves both columns alone, and an empty value (Auth clears email_change
-- after a change) is allowed. An account whose current email doesn't match,
-- such as one added in the dashboard, can still sign in.
create function private.check_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is distinct from old.email
    and coalesce(new.email, '') <> ''
    and new.email !~* private.student_email_pattern()
  then
    raise exception 'INVALID_INPUT' using detail = 'email';
  end if;

  if new.email_change is distinct from old.email_change
    and coalesce(new.email_change, '') <> ''
    and new.email_change !~* private.student_email_pattern()
  then
    raise exception 'INVALID_INPUT' using detail = 'email_change';
  end if;

  return new;
end;
$$;

create trigger check_email_change
  before update on auth.users
  for each row
  when (new.email is distinct from old.email or new.email_change is distinct from old.email_change)
  execute function private.check_email_change();

revoke execute on function private.check_email_change() from public, anon, authenticated;
