# Lost & Found MUET — Development Guide

> **Purpose:** This document is the shared product, technical, and
> delivery plan for building a Lost & Found web application for Mehran
> University of Engineering and Technology (MUET).
>
> **Version:** 2.1 — 23 October 2026 (one developer)
>
> **Project status:** Planning / initial implementation.
>
> **Important:** This is a proposed specification, not evidence that
> MUET has officially approved, endorsed, or integrated with the
> application. Use fictional data during development and obtain
> appropriate permission before using university branding or real
> student information.
>
> **AI coding tools:** read `AGENTS.md` first. It contains the working
> rules for agents. This file is the full specification it points to.

---

## What changed in version 2

| # | Change | Why |
|---|--------|-----|
| 1 | Approving a claim now needs a **handover note**, and after approval both people can see each other's name and email. | Before, a claim could be approved but nobody could contact each other. |
| 2 | Claims now work on **lost reports too** ("I found this"), not only on found reports ("This is mine"). | Before, a finder who saw a lost report had no way to respond. |
| 3 | Private verification details moved to their own table, `item_private_details`. | Supabase RLS controls rows, not columns. A private column inside a public table would be public. |
| 4 | **All status changes go through database functions.** Users never update status columns directly. | A plain update policy would let a claimant approve their own claim or an owner un-hide a moderated report. |
| 5 | Admin design decided: an `admins` table plus an `is_admin()` helper. | RLS policies cannot be written until this is decided. |
| 6 | Report statuses are now `active`, `resolved`, `closed`, `hidden`. `archived` removed. | "Close my report" had no matching status. |
| 7 | Claim status `closed` added; an approved claim can be rejected if the handover fails. | Defines what happens to claims when a report ends. |
| 8 | `/reset-password` route added. | Password recovery needs a page to set the new password. |
| 9 | Locations come from a fixed `campus_locations` list plus an optional detail field. | Free-text locations cannot be filtered. |
| 10 | A basic "Report this listing" button moved into P0. | The milestones and acceptance criteria already required it. |
| 11 | The app needs **no secret / service-role key** for the MVP. | All privileged logic lives in database functions. |
| 12 | Images are stored in a **private** bucket and shown with signed URLs. | ID cards and wallets should not sit behind permanent public links. |
| 13 | Added a decisions section, open questions, email (SMTP) and free-tier notes. | So you and your AI tools follow the same choices. |

**Version 2.1:** rewritten for one developer. The two-person split, peer
reviews, and team rules were replaced with a solo workflow (section 14):
vertical slices, self-review of every pull request, and an independent
review for security-sensitive changes.

---

## 1. Project Overview

### 1.1 Problem

Students and staff can lose belongings such as ID cards, keys, wallets,
books, chargers, water bottles, and bags around campus. Reports are
often shared through friends or messaging groups, so they can be
difficult to find later.

### 1.2 Proposed solution

Lost & Found MUET is a responsive website where members of the
university community can:

- Report an item they have lost.
- Report an item they have found.
- Search and filter active reports.
- Say **"This is mine"** on a found report.
- Say **"I found this"** on a lost report.
- Arrange a safe handover once the report owner approves.
- Mark a report as resolved.
- Flag suspicious listings for moderation.

Administrators can moderate reports, review flagged listings, and help
resolve disputes.

### 1.3 Project goals

1. Make lost and found reports easy to publish and search.
2. Protect users' personal information.
3. Help owners verify and recover belongings safely.
4. Provide a mobile-friendly interface.
5. Keep the first release small enough for one student developer to
   build and test alongside classes.
6. Use a codebase that can be extended later.

### 1.4 Non-goals for the first release

Do **not** include these in the initial MVP:

- Online payments.
- Delivery or courier arrangements.
- Public display of phone numbers, email addresses, student ID numbers,
  or home addresses.
- Automatic AI-based ownership decisions.
- Public ratings and reviews.
- Native Android or iOS applications.
- Real-time chat or messaging (messaging is P1).
- Official university single sign-on unless the university provides and
  approves an integration.

---

## 2. Key Decisions

These are decided. Change one only after thinking through what it
affects (especially permissions), and update this table when you do.

| ID | Decision |
|----|----------|
| D-01 | One Next.js application with Supabase. No separate backend server. |
| D-02 | Claims work on both report types. On a **found** report the claim type is `ownership` ("This is mine"). On a **lost** report it is `found_match` ("I found this"). The **report owner always reviews** claims on their report. The claim type is set by the database from the report type, never by the client. |
| D-03 | Approving a claim requires a **handover note** (where and when to meet). After approval, the claimant and the report owner can see each other's full name and account email through `get_claim_contact()`. Users are told this before they submit or approve a claim. |
| D-04 | Private verification details (for example "my name is written inside the cover") live in `item_private_details`, readable only by the report owner and admins. |
| D-05 | **Content edits** (title, description, and so on) are direct table writes protected by RLS and column grants. **State changes** (any status column) happen only through database functions. |
| D-06 | Admins are listed in an `admins` table that no user can read or write through the API. Policies and functions use an `is_admin()` helper. Admins are added by hand in the Supabase SQL editor. |
| D-07 | Report statuses: `active`, `resolved`, `closed`, `hidden`. Users never hard-delete reports or claims; they close them. |
| D-08 | Visitors see only `active` reports. Public pages never show who reported an item. Names and emails are shared only between the two people in an approved claim. |
| D-09 | Item images go in a **private** storage bucket and are shown through short-lived signed URLs, only for reports the viewer is allowed to see. |
| D-10 | Locations come from the `campus_locations` table plus an optional free-text detail. Categories are a fixed list enforced by a database check. |
| D-11 | The app uses only the Supabase URL and the publishable key. No secret / service-role key in the MVP. |
| D-12 | Times are stored as `timestamptz` (UTC) and shown in Pakistan time (`Asia/Karachi`). "Today" checks use `Asia/Karachi`. |
| D-13 | Anonymous sign-ins stay off. Policies treat every signed-in user as a real, verified account. |
| D-14 | **MUET student emails only.** An account's email must be a roll number at `students.muet.edu.pk`, for example `23sw016@students.muet.edu.pk`: a 2-digit batch year, a 2–4 letter department code, and a 1–3 digit serial number. Pattern (case-insensitive): `^[0-9]{2}[a-z]{2,4}[0-9]{1,3}@students\.muet\.edu\.pk$`. Addresses at plain `muet.edu.pk` and other subdomains such as `fake.students.muet.edu.pk` do not match. A "before user created" auth hook enforces it at sign-up, a trigger stops an account changing to another email (9.10, 9.11), and the register form checks it too. The pattern lives in `src/lib/constants.ts` and `private.student_email_pattern()`, and a test fails if they differ. |
| D-15 | **Auth emails through Gmail SMTP for the pilot.** Sign-up and password-reset emails go through custom SMTP with a dedicated Gmail account: `smtp.gmail.com`, port 587, an app password, about 500 emails a day. It is configured in the Supabase dashboard, and the credentials stay there (10.4). Before a wider launch, move to a transactional email provider with our own domain (P1). See section 17. |

### 2.1 Open decisions (settle before Milestone 2)

| ID | Question | Recommendation |
|----|----------|----------------|
| O-02 | What is the real list of campus locations? | Walk the campus and list departments, library, cafeterias, hostels, gates, transport stops, sports areas, and so on. Use stable keys (`library`, `main_cafeteria`) and friendly labels. |
| O-04 | Who acts as admin during the pilot? | You, at first. Hand over to a staff member only if the university agrees. Staff can't register (D-14), so their account would have to be added by hand in the dashboard. |

---

## 3. Target Users and Roles

### Visitor

- View active reports.
- Search and filter reports.
- Open a report's public details.
- Register or log in to create a report or submit a claim.

### Registered user

Only MUET students can register, with the email address made from their
roll number (D-14). Teachers and staff without a roll-number email can't
register.

- Create lost or found reports, with optional private details.
- Edit their own active reports.
- Close their own reports or mark them resolved.
- Submit claims: "This is mine" on found reports, "I found this" on
  lost reports.
- Review (approve or reject) claims on their own reports.
- Cancel their own claims.
- See the other person's name and email after a claim is approved.
- View their dashboard: their reports, their claims, and claims waiting
  for their review.
- Flag suspicious listings.

### Administrator

- Review flagged listings.
- Hide or restore reports.
- Help resolve disputed claims.
- Every admin action is written to an audit log.

Admin permissions must be assigned and checked securely. A user must
never become an administrator by changing a browser request or editing
their profile (see D-06).

---

## 4. Technology Stack

Use one repository and one web application.

| Area | Technology | Purpose |
|------|------------|---------|
| Language | TypeScript (strict mode) | Type checking for JavaScript |
| Web framework | Next.js App Router | Pages, routing, Server Components, Server Actions |
| UI | React | Reusable interface components |
| Styling | Tailwind CSS | Responsive styling |
| Database | PostgreSQL on Supabase | Profiles, reports, claims, moderation data |
| Supabase in Next.js | `@supabase/ssr` + `@supabase/supabase-js` | Cookie-based sessions for server and browser |
| Authentication | Supabase Auth | Registration, login, password recovery |
| File storage | Supabase Storage | Item photographs |
| Database tooling | Supabase CLI | Migrations and generated TypeScript types |
| Validation | Zod | Checks form data on the server |
| Forms | React Hook Form (optional) | Larger forms |
| Icons | A maintained React icon library | Consistent icons |
| Version control | Git | Tracks code changes |
| Collaboration | GitHub | Repository, issues, pull requests, reviews |
| Hosting | Vercel | Publishes the website |
| Testing | Vitest, Playwright, and optionally pgTAP | Unit, browser, and database tests |

### 4.1 Why this stack?

- No separate backend service to run for the first version.
- Supabase provides PostgreSQL, authentication, and file storage.
- Database functions keep the important rules in one place that every
  client must go through.
- Next.js and TypeScript support a maintainable single codebase.
- GitHub keeps a history of every change and gives you pull requests to
  review your own work before it reaches `main`.

### 4.2 Version policy

- Use current stable releases when creating the project. Commit the
  lockfile. Do not casually upgrade major versions during final testing.
- Check `package.json` before using framework APIs. Some names changed
  between major versions. For example, Next.js 16 renamed
  `middleware.ts` to `proxy.ts`. Follow the documentation for the
  version you actually installed.
- Use `@supabase/ssr`. Do not use the old `@supabase/auth-helpers-nextjs`
  package from older tutorials.
- Check the official documentation for current setup steps, pricing and
  usage limits before deployment.

---

## 5. MVP Scope and Priorities

### P0 — Required before the first user test

- [ ] Responsive home page.
- [ ] Registration, login, logout.
- [ ] Password recovery: `/forgot-password` sends the email and
      `/reset-password` sets the new password.
- [ ] Public list of active lost reports and active found reports,
      newest first, with a page-size limit and a "Load more" button.
- [ ] Search by title and description.
- [ ] Filter by report type, category, and location.
- [ ] Create a lost report and a found report, including optional
      private details.
- [ ] Optional photograph upload with type and size validation.
- [ ] Item detail page.
- [ ] Edit own active report.
- [ ] Close own report.
- [ ] Submit a claim: "This is mine" on found reports, "I found this" on
      lost reports.
- [ ] Report owner approves (with handover note) or rejects claims.
- [ ] Claimant can cancel their own claim.
- [ ] After approval, both people see each other's name and email.
- [ ] Mark a report as resolved.
- [ ] Dashboard: my reports, my claims, and claims waiting for my review
      (with a visible count).
- [ ] "Report this listing" button, and an admin list of flagged
      listings.
- [ ] Admin can hide and restore reports; every admin action is logged.
- [ ] RLS on every table, column grants, and storage policies.
- [ ] Error, loading, empty, and success states.
- [ ] Privacy, community guidelines, and help pages.
- [ ] Mobile layout testing.
- [ ] README and deployment instructions.

### P1 — Add after the MVP works

- [ ] Email notifications for new claims and claim decisions (do this
      first; see the risks in section 20).
- [ ] Before a wider launch, send auth emails through a transactional
      email provider (for example Resend or Brevo) from our own domain,
      with SPF, DKIM and DMARC set up. Gmail SMTP (D-15) is for the
      pilot only.
- [ ] Private messages linked to a claim.
- [ ] Proper pagination and full-text search.
- [ ] Automatically close reports after a set time (for example 60
      days), with a reminder before closing.
- [ ] Remove a deleted user's image folder from storage (11.3).
- [ ] Remove uploads that were never attached to a report, after a
      set time.
- [ ] A limit on how many images one user can upload.
- [ ] Owner can reopen a closed report.
- [ ] Require the current password to change it while signed in
      (today `/reset-password` works for any signed-in session).
- [ ] Browser-bound email links (PKCE), so a link from someone else's
      email can't sign you into their account. Not in the MVP because
      it breaks confirming on a different device; for now the header
      and `/reset-password` show the signed-in email (10.1).
- [ ] Flagging of claims, not only listings.
- [ ] Save a snapshot of the report's content and image when a flag is
      filed, so admins review what was actually flagged (11.1).
- [ ] A limit on how many pending claims one user can have (anti-spam).
- [ ] Stop exposing other people's user IDs: the reporter's `user_id`
      (and its folder in `image_path`), `claims.claimant_id`, and
      `reviewed_by` on claims and flags (see 9.12).
- [ ] Basic statistics.

### P2 — Future ideas

- [ ] Similar-report suggestions.
- [ ] AI-assisted image or text similarity (suggestions only, never
      automatic approval).
- [ ] Installable Progressive Web App (PWA).
- [ ] Campus map.
- [ ] "Where is the item now" field (for example, handed to a department
      office).
- [ ] Multi-campus support.
- [ ] University-approved identity verification.

Do not start P1 or P2 work while P0 features are broken or insecure.

---

## 6. Main User Journeys

### 6.1 Report a lost item

1. User signs in.
2. User opens **Report an Item** and selects **Lost**.
3. User enters title, category, location (from the list), optional
   location detail, public description, and date lost.
4. User optionally adds **private details** that only they and admins
   can see (for example, "my name is written inside the front cover").
   These help them check "I found this" claims later.
5. User optionally adds a safe photograph.
6. The server validates the fields.
7. The report is saved with the signed-in user's ID and status
   `active`.
8. The report appears in the active lost-items list.
9. The user can edit or close their own report.

### 6.2 Report a found item

1. User signs in.
2. User selects **Found**.
3. User adds basic details and an optional photograph.
4. The form tells the user to keep the public description general and
   not to reveal sensitive information.
5. User optionally adds private details (for example, "there is a
   sticker on the back") to help verify claimants.
6. The report is saved and appears in the found-items list.

### 6.3 Claim a found item ("This is mine")

1. A signed-in user opens an active found report.
2. They select **This is mine**.
3. They write a private message describing the item, ideally including
   a detail that is not in the public description or photograph.
4. The app calls `submit_claim()`. The database checks that the report
   is active, that the user is not the report owner, and that they have
   no other open claim on this report.
5. The claim is saved as `pending` with type `ownership`.
6. The finder (report owner) sees it in their dashboard and compares it
   with their private details.
7. The finder approves it with a handover note, or rejects it.

### 6.4 Respond to a lost report ("I found this")

1. A signed-in user who has found something opens an active lost report.
2. They select **I found this**.
3. They write a private message saying where and when they found it and
   what it looks like.
4. The app calls `submit_claim()`. The claim is saved as `pending` with
   type `found_match`.
5. The person who lost the item (report owner) reviews it and compares
   it with their private details.
6. They approve it with a handover note, or reject it.

### 6.5 Handover and resolution

1. The report owner approves a claim with `approve_claim()` and writes a
   handover note, for example: "Library entrance, Monday 2 pm."
2. Both people can now see each other's name and account email through
   `get_claim_contact()`. They use it only to arrange the handover.
3. They meet in a public place on campus.
4. If the item does not match in person, the report owner can reject
   the approved claim and review other claims.
5. If the item is returned, the report owner marks the report
   `resolved` with `resolve_report()`. Other pending claims are closed
   automatically.

A claim is not proof of ownership. The app never approves a claim
automatically, and never reveals private details to the other person.

### 6.6 Moderate a report

1. A user selects **Report this listing** and picks a reason.
2. An admin reviews the flag in the admin dashboard.
3. The admin can dismiss the flag, or hide the report with
   `admin_hide_report()`.
4. Every admin action is written to `admin_audit_log`.
5. Admin actions only work for accounts in the `admins` table.

---

## 7. Pages and Routes

Use the Next.js App Router. Route names can be adjusted, but update this
table when they change.

| Route | Access | Purpose |
|-------|--------|---------|
| `/` | Public | Home page and recent reports |
| `/lost` | Public | Browse active lost reports |
| `/found` | Public | Browse active found reports |
| `/items/[id]` | Public for active reports; owner, claimants and admins otherwise | Item details |
| `/login` | Public | Sign in |
| `/register` | Public | Create account |
| `/forgot-password` | Public | Request a password-reset email |
| `/reset-password` | User arriving from the reset email | Set a new password |
| `/auth/confirm` | Auth flow | Handle the email confirmation and password-reset links (`verifyOtp` with a token hash), as in the current Supabase Next.js server-side auth guide. Goes to `/dashboard` (`type=email`) or `/reset-password` (`type=recovery`), otherwise `/login?error=link`. Never redirects to a destination taken from the URL. |
| `/report` | Signed-in | Create a report |
| `/items/[id]/edit` | Report owner, while active | Edit own report |
| `/dashboard` | Signed-in | My reports, my claims, claims waiting for my review |
| `/claims/[id]` | Claimant, report owner, admins | Claim details, approve/reject/cancel, handover contact |
| `/admin` | Admins | Moderation overview |
| `/admin/flags` | Admins | Review flagged listings |
| `/privacy` | Public | Privacy information |
| `/community-guidelines` | Public | Safe-use rules |
| `/help` | Public | Help and contact instructions |

The page is not the security boundary. Every read and write must also be
protected by RLS, column grants, and database functions.

---

## 8. UI and UX Requirements

### 8.1 Design principles

- Use clear, simple English.
- Mobile first.
- Keep navigation predictable.
- Accessible contrast and visible keyboard focus.
- Label every form field.
- Show field-level validation errors.
- Show loading feedback while requests are running.
- Show useful empty states when nothing matches a search.
- Ask for confirmation before closing a report, rejecting a claim, or
  hiding a report.
- Do not rely on colour alone to show status.
- Avoid unnecessary animations and heavy images.

### 8.2 Suggested home page

1. Header with logo/text, Lost Items, Found Items, and Login/Profile.
2. Hero heading: **Lost something? Found something? Help reunite it
   with its owner.**
3. Primary actions: **Report Lost Item** and **Report Found Item**.
4. Search input.
5. Recently reported items.
6. Short explanation of how it works.
7. Safety tips, including: meet in a public place on campus, and **never
   pay anyone to get your item back**.
8. Footer with privacy, guidelines, and help links.

Do not use official MUET logos or imply official endorsement without
permission.

### 8.3 Report form fields

| Field | Required | Notes |
|-------|----------|-------|
| Report type | Yes | `lost` or `found`. Cannot be changed after creation. |
| Title | Yes | 3–80 characters |
| Category | Yes | From the category list |
| Location | Yes | From `campus_locations` |
| Location detail | No | Up to 120 characters, e.g. "second floor, near the stairs" |
| Description | Yes | 10–1000 characters. Public. Keep it general. |
| Private details | No | Up to 500 characters. Only the owner and admins can see it. |
| Date lost / found | Yes | Not after today and not more than 365 days ago (Pakistan time) |
| Photograph | No | JPEG, PNG or WebP, at most 5 MB |

Validation rules:

- Trim leading and trailing whitespace.
- Validate on the server with Zod, and keep the same limits as database
  constraints.
- Never accept user ID, status, role, or claim type from the form. The
  signed-in user comes from the session; statuses come from database
  functions.
- Show a warning not to publish ID numbers, phone numbers, addresses,
  or financial information.

### 8.4 Claim form fields

| Field | Required | Notes |
|-------|----------|-------|
| Message | Yes | 10–1000 characters. Private: only the report owner and admins see it. |

Approving needs a **handover note** of 5–500 characters.

Before submitting or approving, show: "If this claim is approved, you
and the other person will see each other's name and email so you can
arrange the handover."

### 8.5 Categories

Stable values stored in the database, with friendly labels in the UI:

`id_card`, `wallet`, `keys`, `phone`, `electronics`, `books`,
`stationery`, `bag`, `clothing`, `water_bottle`, `other`

Changing this list requires a migration (it is a database check
constraint) and an update to the constants file.

### 8.6 Report statuses and transitions

| Status | Meaning |
|--------|---------|
| `active` | Visible and waiting to be resolved |
| `resolved` | The item was returned |
| `closed` | The owner withdrew the report without a return (or it was closed by an admin) |
| `hidden` | Hidden by an admin |

| From | To | Who | Function |
|------|----|-----|----------|
| `active` | `resolved` | Report owner, admin | `resolve_report()` |
| `active` | `closed` | Report owner, admin | `close_report()` |
| `active` | `hidden` | Admin | `admin_hide_report()` |
| `hidden` | `active` | Admin | `admin_restore_report()` |

Only active reports can be hidden. Restoring always returns a report to
`active`, so hiding a resolved or closed report would bring it back onto
the public list. Resolved and closed reports are already off the public
list.

Effects on claims:

- When a report is **resolved**: pending claims become `closed`; an
  approved claim stays `approved`.
- When a report is **closed** or **hidden**: pending and approved claims
  become `closed`.
- Restoring a hidden report does not reopen its claims.

Owners can edit content only while the report is `active`.

### 8.7 Claim statuses and transitions

| Status | Meaning |
|--------|---------|
| `pending` | Waiting for the report owner |
| `approved` | Report owner accepted it; handover being arranged |
| `rejected` | Report owner (or admin) declined it |
| `cancelled` | The claimant withdrew it |
| `closed` | Closed automatically because the report ended |

| From | To | Who | Conditions | Function |
|------|----|-----|------------|----------|
| (new) | `pending` | Any signed-in user except the report owner | Report is active; the user has no pending or approved claim on it | `submit_claim()` |
| `pending` | `approved` | Report owner, admin | Report is active; no other approved claim on it; handover note given | `approve_claim()` |
| `pending` | `rejected` | Report owner, admin | — | `reject_claim()` |
| `approved` | `rejected` | Report owner, admin | Report is still active (the handover did not work out) | `reject_claim()` |
| `pending`, `approved` | `cancelled` | Claimant | Report is active (after a report is resolved, its approved claim is the record of the handover) | `cancel_claim()` |
| `pending`, `approved` | `closed` | System | Report resolved (pending only), closed, or hidden | Inside the report functions |

An admin can approve or reject claims on anyone's report, but not their
own claim.

A claimant can see the report only while it is `active` or while their
claim is `pending` or `approved` (and never once it is `hidden`). After
a claim is rejected, cancelled, or closed on a report that is no longer
active, the claimant still sees their claim but not the report. The
claim page must handle this: show the claim and its status with a
"This report is no longer available" message instead of the report
details.

---

## 9. Database Design

General rules:

- UUID primary keys (`gen_random_uuid()`).
- `timestamptz` for times, stored in UTC.
- Text status fields with `check` constraints (easier to change than
  Postgres enums).
- Length limits as `check` constraints that match the Zod schemas.
  Minimum lengths are checked on `private.trim_text(column)`, never
  `btrim()`, which removes only spaces.
- User-owned rows reference `auth.users(id) on delete cascade`, so
  deleting an account deletes that person's data. Reviewer and admin
  references use `on delete set null`.
- Every foreign key column has an index that starts with it, so deletes
  and cascades don't scan the referencing table. The one exception is
  `item_reports.location_key`: locations are retired with `is_active`,
  never deleted.
- Every table has RLS enabled in the same migration that creates it.

### 9.1 `profiles`

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK | References `auth.users(id) on delete cascade` |
| `full_name` | `text not null` | 2–80 characters |
| `created_at` | `timestamptz not null default now()` | |
| `updated_at` | `timestamptz not null default now()` | |

- Created automatically by a trigger when a user signs up (name taken
  from sign-up metadata). If the name is missing or invalid, for
  example for users added in the Supabase dashboard, it is set to
  `MUET user` (`DEFAULT_FULL_NAME`), and the user can change it.
- No email, phone, password, or role columns. Email lives in Supabase
  Auth.
- Users read and update only their own row. Other people's names are
  shared only through `get_claim_contact()`.

### 9.2 `campus_locations`

| Column | Type | Notes |
|--------|------|-------|
| `key` | `text` PK | Stable value, e.g. `library` |
| `label` | `text not null` | Display name |
| `sort_order` | `int not null default 0` | Display order |
| `is_active` | `boolean not null default true` | Hide old locations without breaking old reports |

- Everyone can read active rows. Only admins edit it (dashboard or SQL).
- Seed with the real list once O-02 is decided. Use placeholders until
  then.

### 9.3 `item_reports`

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK | |
| `user_id` | `uuid not null default auth.uid()` | References `auth.users(id) on delete cascade` |
| `report_type` | `text not null` | `lost` or `found`; cannot change after insert |
| `title` | `text not null` | 3–80 characters |
| `description` | `text not null` | 10–1000 characters, public |
| `category` | `text not null` | Check against the category list |
| `location_key` | `text not null` | References `campus_locations(key)` |
| `location_detail` | `text null` | Up to 120 characters |
| `event_date` | `date not null` | Checked by trigger: not in the future, not older than 365 days (Pakistan time) |
| `image_path` | `text null` | Storage path in `item-images`: `<owner user_id>/<uuid>.<jpg\|png\|webp>` (checked by `validate_item_report`) |
| `status` | `text not null default 'active'` | `active`, `resolved`, `closed`, `hidden` |
| `resolved_at` | `timestamptz null` | Set by `resolve_report()` |
| `created_at` | `timestamptz not null default now()` | |
| `updated_at` | `timestamptz not null default now()` | |

Indexes:

- `(status, report_type, created_at desc)`
- `(status, category)`
- `(status, location_key)`
- `(user_id, created_at desc)`
- `(image_path) where image_path is not null`: the storage policies
  find an image's report by its path.

Column grants for the `authenticated` role:

- `INSERT` only on: `report_type`, `title`, `description`, `category`,
  `location_key`, `location_detail`, `event_date`, `image_path`.
- `UPDATE` only on: `title`, `description`, `category`, `location_key`,
  `location_detail`, `event_date`, `image_path`.
- No `DELETE`.

So `user_id`, `status`, `resolved_at`, and `report_type` (after insert)
cannot be changed by users at all.

Search for the MVP: `ilike` on `title` and `description`, with `%`, `_`
and `\` in user input escaped. Full-text search is P1.

### 9.4 `item_private_details`

| Column | Type | Notes |
|--------|------|-------|
| `item_id` | `uuid` PK | References `item_reports(id) on delete cascade` |
| `details` | `text not null` | Up to 500 characters |
| `created_at` | `timestamptz not null default now()` | |
| `updated_at` | `timestamptz not null default now()` | |

- Readable only by the owner of the linked report and admins.
- Insertable and updatable only by the owner, and only while the report
  is `active` (the same rule as report content, section 8.6).
- This is a separate table because RLS works on rows. If this text were
  a column in `item_reports`, anyone who can read the report could read
  it.

### 9.5 `claims`

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK | |
| `item_id` | `uuid not null` | References `item_reports(id) on delete cascade` |
| `claimant_id` | `uuid not null` | References `auth.users(id) on delete cascade` |
| `claim_type` | `text not null` | `ownership` (on found reports) or `found_match` (on lost reports); set by `submit_claim()` |
| `message` | `text not null` | 10–1000 characters |
| `status` | `text not null default 'pending'` | `pending`, `approved`, `rejected`, `cancelled`, `closed` |
| `handover_note` | `text null` | 5–500 characters; required when approved |
| `reviewed_by` | `uuid null` | References `auth.users(id) on delete set null` |
| `reviewed_at` | `timestamptz null` | |
| `created_at` | `timestamptz not null default now()` | |
| `updated_at` | `timestamptz not null default now()` | |

Indexes and constraints:

- Unique `(item_id, claimant_id) where status in ('pending', 'approved')`:
  one open claim per user per report.
- Unique `(item_id) where status = 'approved'`: at most one approved
  claim per report.
- `(item_id, status)`, `(claimant_id, created_at desc)`, and
  `(reviewed_by)`.

Access:

- Readable by the claimant, the report owner, and admins.
- **No direct insert, update, or delete** for users. All writes go
  through the claim functions in section 9.10.

### 9.6 `abuse_reports`

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK | |
| `reporter_id` | `uuid not null default auth.uid()` | References `auth.users(id) on delete cascade` |
| `item_id` | `uuid not null` | References `item_reports(id) on delete cascade` |
| `reason` | `text not null` | `sensitive_info`, `fake_or_spam`, `offensive`, `scam`, `other` |
| `details` | `text null` | Up to 1000 characters |
| `status` | `text not null default 'open'` | `open`, `reviewing`, `actioned`, `dismissed` |
| `reviewed_by` | `uuid null` | References `auth.users(id) on delete set null` |
| `reviewed_at` | `timestamptz null` | |
| `created_at` | `timestamptz not null default now()` | |

- Users insert their own (column grant on `item_id`, `reason`,
  `details` only) and can read the ones they filed.
- Unique `(item_id, reporter_id) where status in ('open', 'reviewing')`:
  one open flag per user per listing.
- Indexes `(item_id)`, `(reporter_id)`, and `(reviewed_by)` for the
  foreign keys. The partial unique index above can't serve `item_id`
  lookups.
- Only admins change the status, through `admin_review_flag()`.

### 9.7 `admins`

| Column | Type | Notes |
|--------|------|-------|
| `user_id` | `uuid` PK | References `auth.users(id) on delete cascade` |
| `created_at` | `timestamptz not null default now()` | |

- RLS enabled with **no policies**, so nobody can read or write it
  through the API.
- Checked only through `is_admin()`.
- Add an admin by running an `insert` in the Supabase SQL editor.

### 9.8 `admin_audit_log`

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK | |
| `admin_id` | `uuid null` | References `auth.users(id) on delete set null` |
| `action` | `text not null` | e.g. `hide_report`, `restore_report`, `review_flag` |
| `target_type` | `text not null` | e.g. `item_report`, `abuse_report`, `claim` |
| `target_id` | `uuid null` | |
| `reason` | `text null` | 1–500 characters when set; the admin functions require it |
| `created_at` | `timestamptz not null default now()` | |

- Admins can read it. Only admin functions insert into it. Nobody
  updates or deletes it.
- Index `(admin_id)` for the foreign key.

### 9.9 `messages` (P1 only)

Add only when private messaging is implemented.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK | |
| `claim_id` | `uuid not null` | References `claims(id) on delete cascade` |
| `sender_id` | `uuid not null` | References `auth.users(id) on delete cascade` |
| `body` | `text not null` | |
| `created_at` | `timestamptz not null default now()` | |
| `read_at` | `timestamptz null` | |

Only the claimant and report owner can read or send messages, and only
while the claim is `pending` or `approved`.

### 9.10 Database functions

All functions that check permissions or change status:

- Use `security definer` and `set search_path = ''`, and schema-qualify
  every table name (for example `public.claims`).
- Check `auth.uid()` themselves. They must not trust any user ID passed
  in.
- Revoke `execute` from `public` and `anon`; grant it to
  `authenticated`. This includes `is_admin()`: no visitor policy calls
  it.
- Raise errors with the codes below so the UI can show friendly
  messages. The error message is the code itself; for `INVALID_INPUT`,
  the error detail names the field (for example `handover_note`).
- Raise `NOT_FOUND` when the caller couldn't see the row under the
  section 9.12 rules (so nobody can probe for IDs), and `NOT_ALLOWED`
  when they can see it but may not do this. Admin functions check
  "is admin" first, so non-admins always get `NOT_ALLOWED`.
- Trim text input with `private.trim_text()`, check its length (the
  same limits as Zod), and store it trimmed. Admin functions require
  `p_reason`, 1–500 characters.
- A function that reads a row and then changes it locks the report
  first (`select ... for update`), then the claim, always in that order.
  So two calls can't deadlock, and two people can't approve claims on
  the same report at once. `submit_claim()` uses `for share`, so many
  people can claim at once but the report can't change status
  meanwhile.

| Function | Who can call | What it does |
|----------|--------------|--------------|
| `is_admin()` returns `boolean` | Signed-in user; used inside policies and functions, and by the UI for display checks | True if `auth.uid()` is in `admins` |
| `submit_claim(p_item_id uuid, p_message text)` returns `uuid` | Signed-in user | Creates a `pending` claim. Sets `claim_type` from the report type. Checks report is active, caller is not the owner, no open claim from the caller. |
| `approve_claim(p_claim_id uuid, p_handover_note text)` | Report owner, admin (not on their own claim) | `pending` → `approved`. Checks report is active and no other approved claim. Saves the handover note, reviewer, and time. |
| `reject_claim(p_claim_id uuid)` | Report owner, admin (not on their own claim) | `pending` or `approved` → `rejected`, while the report is active. |
| `cancel_claim(p_claim_id uuid)` | Claimant | `pending` or `approved` → `cancelled`, while the report is active. |
| `get_claim_contact(p_claim_id uuid)` returns `(full_name text, email text)` | Claimant or report owner (not admins) | Returns the **other** person's name and email, only if the claim is `approved`. |
| `resolve_report(p_item_id uuid)` | Report owner, admin | `active` → `resolved`, sets `resolved_at`, closes pending claims. |
| `close_report(p_item_id uuid)` | Report owner, admin | `active` → `closed`, closes pending and approved claims. |
| `admin_hide_report(p_item_id uuid, p_reason text)` | Admin | `active` → `hidden`, closes pending and approved claims, writes audit log. |
| `admin_restore_report(p_item_id uuid, p_reason text)` | Admin | `hidden` → `active`, writes audit log. Claims stay closed. |
| `admin_review_flag(p_flag_id uuid, p_status text, p_reason text)` | Admin | `open` → `reviewing`, `actioned`, or `dismissed`; `reviewing` → `actioned` or `dismissed`. `actioned` and `dismissed` are final. Writes audit log. |

Policy helpers, in the `private` schema (not exposed by the API). Same
rules as above, but only `authenticated` has `execute` on them (and,
with `supabase_auth_admin`, `usage` on the schema; see the auth hook
below). They are security definer so the `item_reports` and
`claims` policies can look at each other's table without calling each
other's policies in a loop. Each answers a question about the caller
only.

| Function | Used by | What it does |
|----------|---------|--------------|
| `private.is_report_owner(p_item_id uuid)` returns `boolean` | `item_private_details` and `claims` policies | True if the caller owns the report |
| `private.has_claim_on_report(p_item_id uuid)` returns `boolean` | `item_reports` policy | True if the caller has a `pending` or `approved` claim on the report |

Internal helpers, also in `private`, used only inside the functions
above. Nobody but the table owner can execute them.

| Function | What it does |
|----------|--------------|
| `private.can_see_report(p_item_id, p_owner_id, p_status)` | The `item_reports` read rule from 9.12, for functions that bypass RLS |
| `private.lock_visible_report(p_item_id)` | Locks a report the caller can see; raises `NOT_SIGNED_IN` or `NOT_FOUND` |
| `private.lock_visible_claim(p_claim_id)` | Locks a claim's report, then the claim, if the caller is the claimant, the report owner or an admin; raises `NOT_SIGNED_IN` or `NOT_FOUND` |
| `private.require_admin()` | Raises `NOT_SIGNED_IN` or `NOT_ALLOWED` unless the caller is an admin |
| `private.clean_admin_reason(p_reason)` | Returns the trimmed reason, or raises `INVALID_INPUT` |
| `private.trim_text(p_text)` | Trims the same characters as JavaScript's `trim()` (which Zod's `.trim()` uses): spaces, tabs, newlines, and Unicode spaces. Used by the functions and by the length check constraints, so `authenticated` can execute it. |

Auth hook and student email check (D-14). Supabase Auth runs these as
its own role, `supabase_auth_admin`; nobody else can execute them.

| Function | Who can call | What it does |
|----------|--------------|--------------|
| `public.restrict_signup_domain(event jsonb)` returns `jsonb` | `supabase_auth_admin` only (the "before user created" hook) | Returns `{}` (allow) only if `event.user.email` matches the student pattern. Anything else, including a missing email, gets `{"error": {"http_code": 403, "message": "Use your MUET student email (your roll number, for example 23sw016@students.muet.edu.pk)."}}`. Not security definer. |
| `private.student_email_pattern()` returns `text` | `supabase_auth_admin`, and the trigger below | The pattern from D-14. Must equal `STUDENT_EMAIL_PATTERN` in `src/lib/constants.ts` (checked by `tests/db/signupEmail.mjs`). Callers match it case-insensitively. |

The hook does nothing until it is turned on (10.1).

Error codes:

| Code | Meaning |
|------|---------|
| `NOT_SIGNED_IN` | No signed-in user |
| `NOT_ALLOWED` | The caller may not do this |
| `NOT_FOUND` | Report, claim, or flag not found (or not visible to the caller) |
| `ITEM_NOT_ACTIVE` | The report is not active |
| `OWN_ITEM` | The caller is trying to claim their own report |
| `DUPLICATE_CLAIM` | The caller already has an open claim on this report |
| `ALREADY_APPROVED` | Another claim on this report is already approved |
| `INVALID_STATUS` | This status change is not allowed from the current status |
| `INVALID_INPUT` | A field is missing, too short, too long, or not allowed (for example a future `event_date` or a retired location); the error detail names the field |

### 9.11 Triggers

| Trigger | Table | Purpose |
|---------|-------|---------|
| `handle_new_user` | `auth.users` (after insert) | Create the `profiles` row from `full_name` in the sign-up metadata, trimmed; `MUET user` if it is missing or not 2–80 characters |
| `set_updated_at` | `profiles`, `item_reports`, `item_private_details`, `claims` (before update) | Keep `updated_at` correct |
| `validate_item_report` | `item_reports` (before insert/update) | Check `event_date` against today in `Asia/Karachi` (not after today, not more than 365 days ago); check `image_path` is `<owner user_id>/<uuid>.<jpg\|png\|webp>`; reject an inactive `location_key` |
| `check_email_change` | `auth.users` (before update, only when `email` or `email_change` changes) | Raise `INVALID_INPUT` if either is changed to a non-empty value that doesn't match the student pattern (D-14). Supabase Auth's API lets a signed-in user request a new email even though the app doesn't offer it; this stops that. `auth.users` is updated on every sign-in and token refresh, so the trigger skips updates that leave both columns alone, and an account whose current email doesn't match can still sign in. |

The trigger functions live in `private` (same names as the triggers).
`validate_item_report` checks each field on insert, and on update only
when that field changes. So a report can still be edited, resolved or
restored after its `event_date` is more than 365 days old or its
location has been retired. Each failure raises `INVALID_INPUT`, with
the field name in the error detail.

### 9.12 Row Level Security summary

Reading (`SELECT`):

| Table | Visitor | Signed-in user | Admin |
|-------|---------|----------------|-------|
| `profiles` | — | Own row | All |
| `campus_locations` | Active rows | Active rows | All |
| `item_reports` | `active` only | `active`, plus own (any status), plus reports they have a `pending` or `approved` claim on (except `hidden`) | All |
| `item_private_details` | — | Own reports only | All |
| `claims` | — | Claims they made, and claims on their reports | All |
| `abuse_reports` | — | Ones they filed | All |
| `admins` | — | — | — (use `is_admin()`) |
| `admin_audit_log` | — | — | All |

Writing:

| Table | Signed-in user | Admin |
|-------|----------------|-------|
| `profiles` | Update own `full_name` | SQL editor |
| `item_reports` | Insert own (status is always `active`); update content columns of own `active` reports | Status through functions |
| `item_private_details` | Insert and update for own `active` reports | — |
| `claims` | Nothing directly; functions only | Functions only |
| `abuse_reports` | Insert own, only on reports they can see | Status through `admin_review_flag()` |
| `admin_audit_log` | Nothing | Written by admin functions only |
| `admins`, `campus_locations` | Nothing | SQL editor or dashboard |
| Storage (`item-images`) | See 11.1: upload to own folder; read images of reports they can see, and own files; delete own files no report points to | Read images of all reports; no delete |

Nobody deletes rows from these tables through the API. The only
deletes are of image files in Storage (11.1).

Grants: Supabase gives `anon` and `authenticated` full access on new
tables, and policies only filter rows within that access. So every
table starts with all of it revoked, and only these are granted back:

- `SELECT` where this section allows reading (`anon`: `campus_locations`
  and `item_reports` only; nothing on `admins` for anyone).
- The column grants in 9.3 (`item_reports`) and 9.6 (`abuse_reports`),
  `UPDATE (full_name)` on `profiles`, and `INSERT (item_id, details)` /
  `UPDATE (details)` on `item_private_details`.
- No `DELETE` on any table.

Known limitation (MVP): some rows show other people's user IDs.

- `item_reports.user_id`, to anyone who can read the report. Its
  `image_path` contains it too.
- `claims.claimant_id`, to the report owner.
- `claims.reviewed_by`, to the claimant and the report owner.
- `abuse_reports.reviewed_by` (the reviewing admin), to the user who
  filed the flag.

Names and emails stay private, because `profiles` is own-row only and
contact details come only from `get_claim_contact()`. But someone could
tell that two rows came from the same account. See the P1 list.

### 9.13 Database migrations

- Store every schema change as a migration file in
  `supabase/migrations/`, created with `supabase migration new <name>`.
- Suggested first migrations:
  1. `core_tables` — tables, constraints, indexes; RLS enabled with no
     policies.
  2. `rls_policies` — policies and column grants.
  3. `functions` — helper, claim, report, and admin functions; triggers.
  4. `storage` — the `item-images` bucket and its policies.
  5. `restrict_signup_domain` — the student-email sign-up hook and the
     email-change trigger (D-14).
- `supabase/seed.sql` holds placeholder locations and fictional
  reports only.
- Never edit a migration that has already been merged or applied. Write
  a new one.
- Never change the schema in the dashboard without a matching
  migration.
- After each migration, regenerate TypeScript types into
  `src/types/database.ts`.
- Read every migration line by line before merging. For RLS, grants,
  and functions, also get the independent review in section 14.3.

---

## 10. Authentication and Authorization

### 10.1 Authentication

Implement:

- Sign up (with full name), with email verification.
- Sign in and sign out.
- Password reset: `/forgot-password` sends the email; `/reset-password`
  sets the new password.
- Session refresh through the Next.js proxy (`proxy.ts` on Next.js 16
  and later; `middleware.ts` on older versions), following the current
  Supabase Next.js server-side auth guide.

Rules:

- On the server, check the user with `supabase.auth.getClaims()` (or
  `getUser()`). Never trust `getSession()` in server code.
- Protect private pages on the server (in the page or layout), not only
  in the proxy.
- Auth emails go through custom SMTP (D-15, section 17).
- Only MUET student emails can register (D-14). The hook checks only new
  sign-ups, so **the app must not offer a way to change an account's
  email**. The `check_email_change` trigger (9.11) also blocks a change
  to a non-student email made through the Auth API directly.
- Never show Supabase's own error messages. Known error codes map to
  `AUTH_ERROR_MESSAGES` in `src/lib/constants.ts`; anything else gets the
  generic message.
- `/forgot-password` shows the same message whatever happens, so it
  never reveals whether an email is registered. Sign-up doesn't reveal
  it either: Supabase replies to an already-registered email as if it
  worked.
- Nothing in the app links to `/reset-password`; only the reset email
  does. It works for anyone signed in, without the current password
  (see the P1 list).
- An email link signs in the account it was sent to, in whatever
  browser opens it. Someone could send another person a link from their
  own account, and that person would be signed in as them without
  noticing. So the header always shows the signed-in email, and
  `/reset-password` says "You are setting a new password for <email>".
  It shows the email, not the name, because anyone can type any name
  but a roll-number email belongs to one student. A browser-bound flow
  (PKCE) would stop this, but it breaks confirming on a different
  device, such as registering on a laptop and opening the email on a
  phone (see the P1 list).
- **Accepted risk: account discovery through the sign-up API.** Anyone
  can call Supabase Auth's sign-up endpoint directly with the
  publishable key. Supabase answers an email that already has an
  account as if the sign-up worked, but the hook rejects a new
  non-student email with 403. So the API can reveal which non-student
  emails have accounts, which are the staff and admin accounts added by
  hand (O-04). It reveals only that an account exists, and the app's
  own pages don't reveal it. Because these emails can be discovered,
  admin accounts must use strong passwords (10.3).

Email links. The templates in `supabase/templates/` link to
`{{ .SiteURL }}/auth/confirm` with a token hash: `type=email` to confirm
an account (then `/dashboard`), `type=recovery` to reset a password
(then `/reset-password`). The route chooses the destination from `type`
alone and never reads one from the URL, so a crafted link can't send
people to another site; any other `type` goes to `/login?error=link`.
Because they use `{{ .SiteURL }}`, each
Supabase project can link to only one site. Local development and the
live site therefore need separate Supabase projects (section 17), each
with its own Site URL.

Dashboard steps for each hosted Supabase project (the local stack reads
the same settings from `supabase/config.toml`):

1. **Hook:** Authentication → Hooks → add a "Before User Created" hook,
   type Postgres, function `public.restrict_signup_domain`. Until this
   is on, only the register form checks the email. The form rejects
   non-student emails itself, so testing through it never reaches the
   hook. Instead, with that project's URL and publishable key in the env
   file, run
   `node --env-file=.env.local scripts/check-signup-hook.mjs <email>`
   once with a non-student email (it must print `REJECTED (403)`) and
   once with a student email that has no account (it must print
   `ACCEPTED`; delete that user afterwards). Also check whether the hook
   blocks users you add by hand in the dashboard.
2. **Email templates:** Authentication → Emails → Templates. Paste
   `supabase/templates/confirmation.html` into "Confirm signup" and
   `supabase/templates/recovery.html` into "Reset password", with the
   subjects from `config.toml`. Without this, the default emails link
   to a route the app doesn't have.
3. **Password length:** Authentication → Sign In / Providers → Email:
   minimum password length 8, matching `PASSWORD_MIN_LENGTH` in
   `src/lib/constants.ts`. Keep "Confirm email" on.
4. **URL configuration:** Authentication → URL Configuration. Set the
   Site URL to that project's site (`http://localhost:3000` for the
   development project, the live address for production), and add the
   same address to the redirect URLs.

### 10.2 Authorization

Authentication answers **"Who is signed in?"** Authorization answers
**"What may this person do?"**

Permissions are enforced in the database, through RLS, column grants,
and functions (section 9). The UI hides buttons for convenience only.

Examples:

- Visitors read only `active` reports.
- Signed-in users create reports as themselves.
- Users edit only their own `active` reports.
- Claimants read their own claims. Report owners read claims on their
  reports.
- Only report owners and admins approve or reject claims.
- Only admins hide or restore reports.

### 10.3 Admin role

Decided in D-06: an `admins` table with no API access, checked by
`is_admin()`. There is no role column anywhere a user can edit. The UI
can call `is_admin()` to decide whether to show the admin link, but
security comes from the database checks.

Admin accounts must use strong, unique passwords (for example one
generated by a password manager). Their emails can be discovered
through the sign-up API (10.1), and an admin can see private details.

### 10.4 Secret handling

- The app uses only `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `NEXT_PUBLIC_SITE_URL`
  (none of them secret).
- No service-role or secret key in the MVP. If one is ever needed, it
  must be server-only (no `NEXT_PUBLIC_` prefix), and the reason goes in
  this document before you add it.
- Keep `.env.local` out of Git. Commit only `.env.example`.
- Rotate any key that is accidentally committed.
- Do not paste real secrets into issues, screenshots, or AI prompts.
- SMTP credentials (the Gmail app password, D-15) live only in the
  Supabase dashboard. They never go in the repo: not in
  `supabase/config.toml`, `.env.example`, docs, tests, or commit
  messages. The app itself never needs them.

A publishable key is safe in the browser only because RLS is correct.

---

## 11. File Uploads and Privacy

### 11.1 Images

- Bucket: `item-images`, **private**.
- Object path: `<user_id>/<random-uuid>.<ext>`, with `<ext>` one of
  `jpg`, `png`, `webp` (lowercase, no subfolders). Never use the
  uploaded file name.
- Allowed types: JPEG, PNG, WebP. Maximum size: 5 MB. Set these limits
  on the bucket as well as in the app. The Storage service enforces
  them using the content type the browser declares; it does not inspect
  the file itself.
- **Re-encode every image in the browser before upload** (for example,
  draw it on a canvas and export it as JPEG or WebP). Phone photos often
  carry GPS location and other EXIF data, and Storage serves files
  exactly as uploaded. Re-encoding removes that data and shrinks the
  file. Never upload the original file.
- Upload from the browser straight to Storage (Next.js Server Actions
  have a small default request size limit). Then send the resulting
  path to the Server Action that saves the report.
- Storage policies (on `storage.objects`, for `item-images` only):
  - Insert (signed-in users): only into your own `<user_id>/` folder,
    and only with the exact path format above, the same format
    `validate_item_report` accepts for `image_path`. Not to a path a
    report already points to (a report can name a file that doesn't
    exist yet, and uploading it would add an image to that report).
  - Read (visitors and signed-in users): only if a report you can see
    has that `image_path`. The check runs under the `item_reports` read
    rules, so it follows them exactly (9.12).
  - Read (signed-in users): anything in your own folder, including
    images not yet attached to a report. This is for previews, and
    because Storage's remove needs read access as well as delete.
  - Delete (signed-in users): only in your own folder, and only files
    that no report points to. Admins remove an image from view by
    hiding the report.
  - No update policy: files can't be overwritten or moved. Upload with
    `upsert: false` (the default).
  - Together these lock an attached image once its report is resolved,
    closed, or hidden: only `active` reports can change `image_path`,
    so the image can't be removed, or deleted and uploaded again under
    the same name.
  - While a report is `active`, its owner can change its content,
    including the image, even if it has been flagged. So a flagged
    image can be changed or removed before an admin reviews it, just
    like the title and description. This is accepted for the MVP:
    locking edits while a flag is open would let anyone freeze a report
    by flagging it. See the P1 list for flag snapshots.
- To change or remove a report's image, the app works in this order:
  1. To change it: upload the new file first.
  2. Update the report's `image_path` (to the new file's path, or to
     `null` to remove the image).
  3. Then delete the old file. Deleting it first fails while the report
     still points to it.

  Storage's remove does not report an error when a policy blocks it; it
  just removes nothing. Check the list of removed files it returns.
- Show images with short-lived signed URLs created on the server. A
  signed URL works for anyone who has it until it expires, so keep
  expiry times short.

### 11.2 Sensitive items

For ID cards, bank cards, documents, wallets, and phones:

- Tell users not to show full ID numbers, account numbers, addresses,
  or other sensitive details. Encourage cropped or blurred photos.
- Keep the public description general. Put identifying details in
  private details.
- Never show private details to the other person.
- Never require identity documents.

### 11.3 Data minimization and privacy

- Do not collect phone numbers, student ID numbers, or home addresses.
- Email is shared only between the two people in an approved claim, and
  users are told this before it happens.
- Before the pilot:
  - Publish a privacy notice.
  - Explain how users can request deletion of their account and data.
  - Decide how long resolved and closed reports are kept.
  - Set up a way to handle flags and urgent privacy issues.
  - Get permission before using official university marks.
- Images need an admin for some deletions (MVP):
  - Deleting an account deletes its reports, but the files in its
    `<user_id>/` folder stay in storage. Nobody can read them through
    the app any more, but they are still stored.
  - Owners can't delete or remove images on resolved, closed, or hidden
    reports (11.1).
  - For now, an admin handles deletion requests by hand in the Supabase
    dashboard. See the P1 list for automatic clean-up.

---

## 12. Project Structure

```text
lost-found-muet/
├── public/
│   └── images/
├── src/
│   ├── app/
│   │   ├── page.tsx
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   ├── forgot-password/page.tsx
│   │   ├── reset-password/page.tsx
│   │   ├── auth/confirm/route.ts
│   │   ├── lost/page.tsx
│   │   ├── found/page.tsx
│   │   ├── items/[id]/page.tsx
│   │   ├── items/[id]/edit/page.tsx
│   │   ├── report/page.tsx
│   │   ├── dashboard/page.tsx
│   │   ├── claims/[id]/page.tsx
│   │   ├── admin/page.tsx
│   │   ├── admin/flags/page.tsx
│   │   ├── privacy/page.tsx
│   │   ├── community-guidelines/page.tsx
│   │   └── help/page.tsx
│   ├── components/
│   │   ├── layout/
│   │   ├── items/
│   │   ├── claims/
│   │   ├── forms/
│   │   └── ui/
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts      # browser client
│   │   │   ├── server.ts      # server client
│   │   │   └── proxy.ts       # updateSession() helper used by src/proxy.ts
│   │   ├── validation/        # Zod schemas
│   │   ├── constants.ts       # categories, statuses, limits, error messages
│   │   └── utils/
│   ├── types/
│   │   └── database.ts        # generated by Supabase CLI
│   └── proxy.ts               # session refresh (middleware.ts on Next.js < 16)
├── scripts/
│   └── check-signup-hook.mjs  # checks the sign-up hook on a project (10.1)
├── supabase/
│   ├── config.toml
│   ├── migrations/
│   └── seed.sql
├── tests/
│   ├── unit/
│   ├── db/
│   └── e2e/
├── .env.example
├── .gitignore
├── AGENTS.md
├── CLAUDE.md                  # one line: @AGENTS.md
├── DEVELOPMENT.md
├── README.md
├── package.json
└── package-lock.json
```

This is a guide, not a requirement to create every folder on day one.
Avoid putting all logic in one large page file.

---

## 13. Environment Configuration

`.env.example`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

- Copy it to `.env.local` and fill in the values from your Supabase
  project.
- `NEXT_PUBLIC_SITE_URL` is used to build email redirect links (for
  example, password reset).
- Set the same variables in Vercel for each environment.
- Do not add a service-role or secret key (D-11).

---

## 14. Working Plan (Solo Developer)

You build the whole application yourself. That removes merge conflicts
and coordination, but it also removes the second person who would catch
your mistakes. The workflow below replaces that person with small
branches, checklists, tests, and an independent review for
security-sensitive changes.

### 14.1 Build in vertical slices

Do not build all the pages first and the database later, or the
reverse. Build one feature at a time, end to end:

1. **Database:** migration, constraints, RLS, and functions (if any).
2. **Database tests** for that feature (section 16.2).
3. **Server:** Zod schema and Server Action.
4. **UI:** page and components, with loading, empty, and error states.
5. **Try it** with two test accounts, then merge.

A finished thin slice (for example, "create a report and see it in the
list") is worth more than half-built pages everywhere. It also means
you always have a working demo to show.

### 14.2 Git workflow

Keep using branches and pull requests, even alone. A pull request is
where you read your own changes calmly before they reach `main`.

- `main`: stable code that works.
- `feature/<short-name>`: one feature per branch.
- Pull requests: open one for each branch and read the full diff on
  GitHub before merging. If the repository is connected to Vercel, each
  pull request also gets a preview deployment you can test.
- GitHub Issues: your task list and bug list.

Start a feature:

```bash
git switch main
git pull origin main
git switch -c feature/home-page
```

After making a small change:

```bash
git status
npm run lint
npm run build
git add .
git commit -m "Add responsive home page"
git push -u origin feature/home-page
```

Open a pull request, read the diff, and merge when checks pass. Then
start the next feature from the updated `main`:

```bash
git switch main
git pull origin main
git switch -c feature/item-search
```

### 14.3 Solo rules

1. Do not commit directly to `main`.
2. Do not commit `.env.local`, credentials, or real user data.
3. Keep branches small: one feature, merged within a few days.
4. Read the whole diff before every merge, including code an AI tool
   wrote.
5. **Independent security review.** For any change to migrations, RLS,
   grants, functions, auth, or storage policies, open a **fresh** AI
   session (one that did not write the code). Give it `AGENTS.md`,
   section 9 of this file, and the diff, and ask it to look for
   permission holes. For the big migrations, a classmate or teacher who
   knows databases is even better.
6. Run lint, build, and tests before merging.
7. Record major decisions in section 2 or in GitHub Issues, so you
   remember why weeks later.
8. Keep the setup steps in `README.md` current. If your laptop breaks,
   you should be able to set the project up again from the README.

### 14.4 Using AI coding tools

- `AGENTS.md` in the repository root holds the rules for AI coding
  tools. Most tools read it automatically.
- For Claude Code, also commit a `CLAUDE.md` containing the single line
  `@AGENTS.md`, so it always loads the same rules.
- Give the tool one small task at a time, on its own branch.
- Do not run two AI sessions on the same files at the same time.
- Review every change to migrations, policies, functions, and auth by
  hand, then get the independent review from rule 5 in section 14.3.
- Never paste secrets or real student data into an AI tool.

### 14.5 Example GitHub issues

- `SETUP-1`: Initialize Next.js project, Supabase client, proxy.
- `DB-1`: Core tables migration.
- `DB-2`: RLS policies and column grants.
- `DB-3`: Claim, report, and admin functions; triggers.
- `DB-4`: Storage bucket and policies.
- `AUTH-1`: Register, login, logout.
- `AUTH-2`: Forgot and reset password.
- `UI-1`: Home page and layout.
- `UI-2`: Item card and lists with filters.
- `ITEM-1`: Create and edit report (with image and private details).
- `CLAIM-1`: Submit and cancel claims.
- `CLAIM-2`: Review claims, handover note, contact view.
- `ITEM-2`: Resolve and close reports.
- `ADMIN-1`: Flags, hide/restore, audit log.
- `TEST-1`: Database permission tests.
- `TEST-2`: End-to-end tests.
- `DEPLOY-1`: Staging deployment and custom SMTP.

---

## 15. Development Milestones

These milestones assume one developer who is learning while working
part-time alongside classes. Working alone, each milestone will take
longer than it would for a team. Extend the schedule rather than
skipping security or testing.

### Milestone 0 — Planning

- Agree on the MVP and the decisions in section 2.
- Settle open decisions O-01 to O-04.
- Validate the problem with 15–20 students.
- Sketch the main pages.
- Create the GitHub repository and first issues.

**Exit condition:** The MVP and the decisions in section 2 are clear,
and the open decisions are settled.

### Milestone 1 — Project foundation

- Create the Next.js project.
- Configure linting and formatting.
- Shared layout and navigation.
- Create the Supabase development project and link the CLI.
- Core tables migration and seed data.
- Environment variables and `.env.example`.
- Commit `AGENTS.md`, `CLAUDE.md`, and this file.

**Exit condition:** The project runs locally from a fresh clone by
following the README, and the first migration applies cleanly.

### Milestone 2 — Authentication and security baseline

- Sign up, login, logout, forgot password, reset password.
- Profile trigger.
- `admins` table and `is_admin()`.
- RLS policies and column grants on every table.
- Server-side protection for private pages.

**Exit condition:** Users can authenticate, and direct unauthorized
database access is denied (tested as visitor, user, other user, admin).

### Milestone 3 — Item reports

- Report form with validation, private details, and image upload.
- Storage bucket and policies.
- Lists, filters, search, detail page.
- Edit own active report; close own report.

**Exit condition:** A user can create, find, view, edit, and close
their own reports, and cannot touch anyone else's.

### Milestone 4 — Claims, handover, and resolution

- `submit_claim`, `approve_claim`, `reject_claim`, `cancel_claim`.
- "This is mine" on found reports; "I found this" on lost reports.
- Handover note and `get_claim_contact`.
- `resolve_report`, with automatic closing of other claims.
- Dashboard with "waiting for my review" count.

**Exit condition:** Both journeys (found → "This is mine" and lost →
"I found this") work end to end across two test accounts, and every
forbidden transition fails.

### Milestone 5 — Moderation and quality

- "Report this listing" and the admin flags page.
- `admin_hide_report`, `admin_restore_report`, `admin_review_flag`,
  audit log.
- Privacy, guidelines, and help pages.
- Mobile and accessibility checks.
- Fix errors and edge cases.

**Exit condition:** Moderation works only for admins, and key tests
pass.

### Milestone 6 — Staging and pilot preparation

- Deploy to Vercel.
- Configure custom SMTP and auth redirect URLs.
- Apply migrations to the production project.
- Take a backup and test restoring it.
- Run a small pilot with fictional or consented data.
- Fix feedback before a wider release.

**Exit condition:** Every item in the acceptance criteria (section 19)
is checked.

---

## 16. Testing Plan

### 16.1 Unit and component tests (Vitest)

- Zod schemas (lengths, dates, file types and sizes).
- Category and location labels.
- Mapping of database error codes to friendly messages.
- Empty, loading, and error states.

### 16.2 Database tests (SQL scripts or pgTAP)

Run each as **visitor**, **report owner**, **other user**, and
**admin**:

- Visitors see only `active` reports.
- Users cannot read other users' private details, claims, or profiles.
- Users cannot update `status`, `user_id`, or `report_type`.
- Users cannot edit another user's report, or their own once it is not
  active.
- Users cannot insert, update, or delete `claims` directly.
- `submit_claim` rejects: own report, inactive report, duplicate claim.
- `approve_claim` rejects: non-owner, report not active, second approval.
- `cancel_claim` works only for the claimant.
- `get_claim_contact` returns nothing unless the claim is approved and
  the caller is a participant.
- `resolve_report`, `close_report`, and `admin_hide_report` close the
  right claims.
- Non-admins cannot call admin functions or read `admins` or the audit
  log.
- Storage: users cannot upload outside their folder or read images of
  reports they cannot see. Nobody can delete or upload a file that a
  report points to, so images are locked once a report is resolved,
  closed, or hidden.

### 16.3 End-to-end tests (Playwright)

Use two test accounts, **User A** and **User B**.

Found-item journey:

1. User A creates a found report with private details.
2. User B sees it and submits "This is mine".
3. User A sees the claim in "waiting for my review".
4. User A approves with a handover note.
5. Both see each other's contact on the claim page.
6. User A marks the report resolved.
7. The report no longer appears in public lists.

Lost-item journey:

1. User A creates a lost report.
2. User B submits "I found this".
3. User A approves; contact appears for both.
4. User A resolves the report.

Permission checks:

5. User B cannot open User A's other claims.
6. A normal user cannot open `/admin`.
7. A normal user cannot make themselves an admin.

### 16.4 Security checklist

- [ ] RLS enabled on every table.
- [ ] Policies tested as visitor, owner, other user, and admin.
- [ ] No user can change a status column directly.
- [ ] Column grants block changes to `user_id` and `report_type`.
- [ ] Private details readable only by the owner and admins.
- [ ] Claim details private to the two participants and admins.
- [ ] Contact shared only after approval.
- [ ] Admin access depends only on the `admins` table.
- [ ] Security-definer functions set `search_path = ''` and check
      `auth.uid()`.
- [ ] Storage bucket is private, with folder-based policies.
- [ ] No secret keys in the client bundle or Git history.
- [ ] Inputs validated on the server and by database constraints.
- [ ] Error messages do not leak internal details.

### 16.5 Commands

Use the scripts that exist in `package.json`. Common ones:

```bash
npm run dev
npm run lint
npm run build
npm test
npx playwright test
```

Add and document test scripts when you set up the test tools.

---

## 17. Deployment Plan

### Development

- Run the app locally.
- Use a development Supabase project (or the local Supabase stack, which
  needs Docker).
- Fictional seed data only.

### Staging and production

- Deploy to Vercel. Set environment variables in the Vercel dashboard.
- Apply reviewed migrations with the Supabase CLI.
- Configure the Site URL and redirect URLs in Supabase Auth for each
  domain.
- Confirm RLS and storage policies on the deployed project.
- Publish privacy and community guidelines.
- Keep a rollback plan for app deployments and database changes.

### Free-tier and email notes (check current limits before launch)

- **Email:** Supabase's built-in email sender is meant for testing and
  allows only a few emails per hour. For the pilot, auth emails go
  through **custom SMTP** with a dedicated Gmail account (D-15), set in
  the Supabase dashboard. Supabase's email rate limit was also raised
  under Authentication → Rate Limits. Gmail's own limit of about 500
  emails a day still applies. Before a wider launch, move to a
  transactional email provider (P1).
- **Pausing:** at the time of writing, free Supabase projects pause
  after about a week with no activity. Restore the project from the
  dashboard before a demo or pilot, or upgrade if it must stay online.
- **Project count:** a free organization has a limited number of active
  projects (two at the time of writing). Use one for development and one
  for production; use the development project as staging until you
  need a separate one.
- **Backups:** check what backups your plan includes, and take your own
  database dump before the pilot.

Never assume that deploying the website secures the database. Database
policies must be correct on their own.

---

## 18. Accessibility and Performance

### Accessibility

- Semantic HTML.
- Keyboard navigation and visible focus states.
- Descriptive labels and button text.
- Alt text for meaningful images.
- Status shown with text, not only colour.
- Readable text on mobile.
- Good colour contrast.

### Performance

- Optimized images; limit upload size.
- Limit list queries (for example 20 per page) and use "Load more".
- Indexes for the common filters (section 9.3).
- Create signed URLs for a list of images in one call where possible.
- Avoid unnecessary client-side JavaScript.
- Test on a typical mobile connection.

---

## 19. Acceptance Criteria for the MVP

The MVP is ready for a small pilot only when all of these are true:

- [ ] A user can register, verify, log in, log out, and reset their
      password.
- [ ] On each hosted Supabase project, `scripts/check-signup-hook.mjs`
      shows the sign-up hook rejecting a non-student email (403) and
      accepting a student email with no account (10.1, step 1).
- [ ] A signed-in user can create lost and found reports, with optional
      private details and photo.
- [ ] Invalid form data is rejected with a clear error.
- [ ] Visitors see only active reports, with no reporter names.
- [ ] Search, category, location, and type filters work.
- [ ] Owners can edit their active reports and close them.
- [ ] Other users cannot edit those reports.
- [ ] A user can submit "This is mine" on a found report and "I found
      this" on a lost report.
- [ ] Users cannot claim their own report or submit duplicate claims.
- [ ] Only the report owner or an admin can approve or reject a claim.
- [ ] Approval requires a handover note; contact appears only after
      approval, only to the two people.
- [ ] Resolving a report closes other pending claims and removes it from
      public lists.
- [ ] Users can flag listings; admins can hide and restore them; admin
      actions are logged.
- [ ] RLS, column grants, functions, and storage permissions have been
      tested.
- [ ] Custom SMTP is configured and emails arrive.
- [ ] The website works on common mobile and desktop sizes.
- [ ] No secrets or real sensitive data are in GitHub.
- [ ] Privacy, guidelines, and help pages are available.
- [ ] You can explain the architecture, the permission rules, and the
      deployment process (useful for a demo or viva).

---

## 20. Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| False ownership claims | Private details, manual review, handover in person, approved claim can be rejected |
| Scams on lost reports ("send money and I'll return it") | Safety tips everywhere: never pay; meet on campus; "Report this listing" |
| Fake or abusive reports | Flags and admin moderation |
| Sensitive data in images | Warnings, cropping, private bucket, admin hiding |
| Unauthorized data access | RLS, column grants, functions-only status changes, tests |
| People miss new claims (no notifications in MVP) | Dashboard "waiting for review" count; email notifications first in P1 |
| Verification and reset emails not arriving | Custom SMTP before the pilot |
| Supabase free project paused before a demo | Check and restore before demos; upgrade if it must stay online |
| No second person reviewing security changes | Database tests, the security checklist (16.4), and the independent review in 14.3 |
| Running out of time alongside classes | Vertical slices so there is always a working demo; finish P0 first; drop P1 if needed |
| Scope growing too large | Finish P0 before P1/P2 |
| Low student adoption | Interview students; run a small pilot |
| Lost access to accounts or a broken laptop | Save recovery codes; push to GitHub often; keep the README setup steps current |
| Confusion about official status | No official branding or endorsement claims without permission |

---

## 21. Weekly Check-in and Definition of Done

Once a week, write three short answers in a GitHub issue or a notes
file. It keeps a solo project from drifting:

1. What did I complete?
2. What will I work on next?
3. Am I blocked by anything?

A task is **Done** only when:

- The code is on a feature branch, you read the full diff in the pull
  request, and it is merged.
- Lint and build pass.
- Validation, loading, empty, and error states are handled.
- Relevant tests pass.
- Permission checks are included and tested where needed.
- Changes to migrations, RLS, or functions got the independent review
  in section 14.3, and types are regenerated.
- Documentation is updated if behaviour, setup, or the data contract
  changed.

Do not mark a task complete just because the page looks correct in the
browser.

---

## 22. First-Day Checklist

1. Confirm Lost & Found MUET is the selected project.
2. Read sections 2, 5, 8.6, 8.7, 9, and 14.
3. Settle open decisions O-01 to O-04, or write down how you will find
   out.
4. Create the GitHub repository (private while you build).
5. Create the Next.js application.
6. Add `AGENTS.md`, `CLAUDE.md`, and `DEVELOPMENT.md` to the repository.
7. Confirm it installs and runs locally.
8. Create the development Supabase project and link the Supabase CLI.
9. Add `.env.local` to `.gitignore`; add `.env.example`.
10. Write the core tables migration.
11. Write and test the first RLS policies.
12. Create GitHub issues for Milestones 1 and 2.
13. Build the shared layout and home page.
14. Test the app end to end before adding more features.

---

## 23. Official Documentation

Use official documentation when setting up services; commands and
dashboards change.

- Next.js: https://nextjs.org/docs
- React: https://react.dev/learn
- Tailwind CSS: https://tailwindcss.com/docs
- Supabase: https://supabase.com/docs
- Supabase server-side auth for Next.js:
  https://supabase.com/docs/guides/auth/server-side/nextjs
- Supabase Auth: https://supabase.com/docs/guides/auth
- Supabase custom SMTP: https://supabase.com/docs/guides/auth/auth-smtp
- Supabase Row Level Security:
  https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase database functions:
  https://supabase.com/docs/guides/database/functions
- Supabase Storage: https://supabase.com/docs/guides/storage
- Supabase CLI and local development:
  https://supabase.com/docs/guides/local-development
- GitHub pull requests: https://docs.github.com/en/pull-requests
- GitHub Skills: https://skills.github.com/
- Vercel: https://vercel.com/docs

---

## Final Principle

Build the smallest secure version that solves the core problem. Get
feedback from real students, fix the important problems, and then add
advanced features. Prioritize reliable reporting, private claims, safe
handovers, and correct permissions over unnecessary complexity.
