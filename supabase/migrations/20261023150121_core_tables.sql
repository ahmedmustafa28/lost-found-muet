-- Migration 1 of 4 (DEVELOPMENT.md 9.13): core tables, constraints, indexes.
--
-- RLS is enabled on every table with no policies yet, so nobody can read or
-- write through the API until the rls_policies migration adds them.
--
-- Every foreign key column has an index whose first column is that key, so
-- deleting a user or report doesn't scan the referencing table. The one
-- exception is item_reports.location_key: locations are retired with
-- is_active and never deleted.
--
-- Text limits match src/lib/constants.ts. Minimum lengths are checked on the
-- trimmed text so whitespace-only values are rejected. A check on a nullable
-- column passes when the value is null.
--
-- Not here on purpose (later migrations): policies and column grants,
-- functions, triggers (updated_at, new-user profile, and the event_date and
-- image_path checks in validate_item_report).


-- Public display name for each account. Email stays in Supabase Auth.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null
    constraint profiles_full_name_length
    check (char_length(btrim(full_name)) >= 2 and char_length(full_name) <= 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;


-- Fixed list of places on campus that a report can point to.
create table public.campus_locations (
  key text primary key,
  label text not null,
  sort_order int not null default 0,
  is_active boolean not null default true
);

alter table public.campus_locations enable row level security;


-- Lost and found reports. Status changes only through database functions.
create table public.item_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid()
    references auth.users (id) on delete cascade,
  report_type text not null
    constraint item_reports_report_type_valid
    check (report_type in ('lost', 'found')),
  title text not null
    constraint item_reports_title_length
    check (char_length(btrim(title)) >= 3 and char_length(title) <= 80),
  description text not null
    constraint item_reports_description_length
    check (char_length(btrim(description)) >= 10 and char_length(description) <= 1000),
  category text not null
    constraint item_reports_category_valid
    check (category in (
      'id_card', 'wallet', 'keys', 'phone', 'electronics', 'books',
      'stationery', 'bag', 'clothing', 'water_bottle', 'other'
    )),
  -- Default (no action) on delete: retire a location with is_active instead.
  location_key text not null references public.campus_locations (key),
  location_detail text
    constraint item_reports_location_detail_length
    check (char_length(location_detail) <= 120),
  event_date date not null,
  image_path text,
  status text not null default 'active'
    constraint item_reports_status_valid
    check (status in ('active', 'resolved', 'closed', 'hidden')),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.item_reports enable row level security;

create index item_reports_status_type_created_idx
  on public.item_reports (status, report_type, created_at desc);
create index item_reports_status_category_idx
  on public.item_reports (status, category);
create index item_reports_status_location_idx
  on public.item_reports (status, location_key);
create index item_reports_user_created_idx
  on public.item_reports (user_id, created_at desc);


-- Private verification details for a report, seen only by its owner and
-- admins. A separate table because RLS works on rows, not columns.
create table public.item_private_details (
  item_id uuid primary key references public.item_reports (id) on delete cascade,
  details text not null
    constraint item_private_details_details_length
    check (char_length(btrim(details)) >= 1 and char_length(details) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.item_private_details enable row level security;


-- Claims on a report: "This is mine" (ownership) on found reports and
-- "I found this" (found_match) on lost reports. Written only by functions.
create table public.claims (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.item_reports (id) on delete cascade,
  claimant_id uuid not null references auth.users (id) on delete cascade,
  claim_type text not null
    constraint claims_claim_type_valid
    check (claim_type in ('ownership', 'found_match')),
  message text not null
    constraint claims_message_length
    check (char_length(btrim(message)) >= 10 and char_length(message) <= 1000),
  status text not null default 'pending'
    constraint claims_status_valid
    check (status in ('pending', 'approved', 'rejected', 'cancelled', 'closed')),
  handover_note text
    constraint claims_handover_note_length
    check (char_length(btrim(handover_note)) >= 5 and char_length(handover_note) <= 500),
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint claims_approved_has_handover_note
    check (status <> 'approved' or handover_note is not null)
);

alter table public.claims enable row level security;

-- One open claim per user per report.
create unique index claims_one_open_per_claimant_idx
  on public.claims (item_id, claimant_id)
  where status in ('pending', 'approved');
-- At most one approved claim per report.
create unique index claims_one_approved_per_item_idx
  on public.claims (item_id)
  where status = 'approved';
create index claims_item_status_idx
  on public.claims (item_id, status);
create index claims_claimant_created_idx
  on public.claims (claimant_id, created_at desc);
create index claims_reviewed_by_idx
  on public.claims (reviewed_by);


-- Flags raised by users against a listing, reviewed by admins.
create table public.abuse_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null default auth.uid()
    references auth.users (id) on delete cascade,
  item_id uuid not null references public.item_reports (id) on delete cascade,
  reason text not null
    constraint abuse_reports_reason_valid
    check (reason in ('sensitive_info', 'fake_or_spam', 'offensive', 'scam', 'other')),
  details text
    constraint abuse_reports_details_length
    check (char_length(details) <= 1000),
  status text not null default 'open'
    constraint abuse_reports_status_valid
    check (status in ('open', 'reviewing', 'actioned', 'dismissed')),
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.abuse_reports enable row level security;

-- One open flag per user per listing.
create unique index abuse_reports_one_open_per_reporter_idx
  on public.abuse_reports (item_id, reporter_id)
  where status in ('open', 'reviewing');
-- The partial index above can't serve foreign-key lookups on item_id.
create index abuse_reports_item_idx
  on public.abuse_reports (item_id);
create index abuse_reports_reporter_idx
  on public.abuse_reports (reporter_id);
create index abuse_reports_reviewed_by_idx
  on public.abuse_reports (reviewed_by);


-- Users who are admins. Never exposed through the API (RLS on, no policies);
-- checked only through is_admin(). Rows are added by hand in the SQL editor.
create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;


-- Record of admin actions. Written only by admin functions; never updated
-- or deleted.
create table public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references auth.users (id) on delete set null,
  action text not null,
  target_type text not null,
  target_id uuid,
  reason text,
  created_at timestamptz not null default now()
);

alter table public.admin_audit_log enable row level security;

create index admin_audit_log_admin_idx
  on public.admin_audit_log (admin_id);
