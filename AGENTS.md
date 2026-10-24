# AGENTS.md — Lost & Found MUET

Instructions for AI coding agents (Claude Code, Codex, Cursor, Copilot,
and others) working in this repository. Humans: read `DEVELOPMENT.md`.

## Project in one paragraph

A responsive website where people at MUET report lost and found items,
search active reports, and submit private claims: "This is mine" on a
found report, "I found this" on a lost report. The report owner reviews
each claim. Approving requires a handover note, after which the two
people can see each other's name and email to arrange a handover on
campus. Admins moderate flagged listings. It is built by one student
developer with Next.js and Supabase. Nobody else reviews the code, so
keep changes small and easy to check. Privacy and correct permissions
matter more than features.

## Source of truth

- `DEVELOPMENT.md` is the full specification. Key parts: section 2
  (decisions), 8.6 and 8.7 (status transitions), 9 (database, functions,
  RLS), 11 (uploads and privacy), 14 (solo workflow and review rules).
- Do not invent tables, columns, statuses, routes, or functions that are
  not in `DEVELOPMENT.md`. If a task needs one, stop and propose it.
- If this file and `DEVELOPMENT.md` disagree, stop and ask.

## Before you start a task

1. Restate the task's scope in one sentence.
2. Read the relevant sections of `DEVELOPMENT.md`.
3. Run `git status` and check the branch. Never work on `main`. If you
   are on `main`, ask the human which feature branch to use.
4. Check versions in `package.json` before using framework APIs.
5. Read nearby code and follow its existing patterns.

## Stack

- Next.js App Router, React, TypeScript (strict)
- Tailwind CSS
- Supabase (Postgres, Auth, Storage) via `@supabase/ssr` and
  `@supabase/supabase-js`
- Zod for validation
- Vitest (unit), Playwright (end-to-end), SQL/pgTAP (database)
- Supabase CLI for migrations and generated types
- Hosted on Vercel

Version notes:

- Next.js 16+ uses `src/proxy.ts` (it was `middleware.ts` before). Use
  the convention that matches the installed version.
- Tailwind CSS v4 is configured in CSS (`@theme`). Do not create
  `tailwind.config.js` unless the project already has one.
- Never use `@supabase/auth-helpers-nextjs` (deprecated).
- Do not copy code from old tutorials. Check the official docs for the
  installed version.
- Docs matching the installed Next.js version are in
  `node_modules/next/dist/docs/`. Read them before using Next.js APIs.
- `cacheComponents` is off on purpose. Don't turn it on or add
  `'use cache'` without asking.

## Commands

Use only scripts that exist in `package.json`. Expected:

```bash
npm install
npm run dev
npm run lint
npm run build
npm test             # once configured
npx playwright test  # once configured
```

Supabase CLI:

```bash
npx supabase migration new <descriptive_name>   # create a migration file
npx supabase db reset                           # LOCAL stack only (needs Docker)
npx supabase gen types typescript --local > src/types/database.ts
# or: npx supabase gen types typescript --project-id <dev-project-id> > src/types/database.ts
```

Do **not** run `supabase db push`, `supabase db reset --linked`, or any
command that changes a remote Supabase project unless the human asks
for it in this task.

## Key paths

```text
src/app/                   routes (App Router)
src/components/            UI components (layout, items, claims, forms, ui)
src/lib/supabase/client.ts browser Supabase client
src/lib/supabase/server.ts server Supabase client
src/lib/validation/        Zod schemas
src/lib/constants.ts       categories, statuses, limits, error messages
src/types/database.ts      generated DB types (do not edit by hand)
src/proxy.ts               session refresh
supabase/migrations/       SQL migrations
supabase/seed.sql          fictional seed data only
tests/unit, tests/db, tests/e2e
```

## Data contract (use these exact names)

Tables: `profiles`, `campus_locations`, `item_reports`,
`item_private_details`, `claims`, `abuse_reports`, `admins`,
`admin_audit_log`. (`messages` is P1. Do not create it unless the task
says so.)

Allowed values (text columns with `check` constraints):

| Field | Values |
|-------|--------|
| `item_reports.report_type` | `lost`, `found` |
| `item_reports.status` | `active`, `resolved`, `closed`, `hidden` |
| `item_reports.category` | `id_card`, `wallet`, `keys`, `phone`, `electronics`, `books`, `stationery`, `bag`, `clothing`, `water_bottle`, `other` |
| `claims.claim_type` | `ownership` (on found reports), `found_match` (on lost reports) |
| `claims.status` | `pending`, `approved`, `rejected`, `cancelled`, `closed` |
| `abuse_reports.reason` | `sensitive_info`, `fake_or_spam`, `offensive`, `scam`, `other` |
| `abuse_reports.status` | `open`, `reviewing`, `actioned`, `dismissed` |

Text limits (Zod and database must match):

| Field | Limit |
|-------|-------|
| `profiles.full_name` | 2–80 |
| `item_reports.title` | 3–80 |
| `item_reports.description` | 10–1000 |
| `item_reports.location_detail` | 0–120 |
| `item_private_details.details` | 1–500 |
| `claims.message` | 10–1000 |
| `claims.handover_note` | 5–500 |
| `abuse_reports.details` | 0–1000 |
| `item_reports.event_date` | not after today, not more than 365 days ago (`Asia/Karachi`) |
| Images | JPEG, PNG, WebP; max 5 MB |

Zod schemas must `.trim()` strings before checking length, because the
database checks trimmed length.

Define these values once in `src/lib/constants.ts` and import them.
Never hard-code them in components.

Database functions (call with `supabase.rpc`):

| Function | Caller |
|----------|--------|
| `submit_claim(p_item_id, p_message)` returns claim id | Signed-in user, not the report owner |
| `approve_claim(p_claim_id, p_handover_note)` | Report owner or admin |
| `reject_claim(p_claim_id)` | Report owner or admin |
| `cancel_claim(p_claim_id)` | Claimant |
| `get_claim_contact(p_claim_id)` returns `full_name`, `email` | Claimant or report owner, approved claims only |
| `resolve_report(p_item_id)` | Report owner or admin |
| `close_report(p_item_id)` | Report owner or admin |
| `admin_hide_report(p_item_id, p_reason)` | Admin |
| `admin_restore_report(p_item_id, p_reason)` | Admin |
| `admin_review_flag(p_flag_id, p_status, p_reason)` | Admin |
| `is_admin()` | Policies, functions, and UI display checks |

Error codes raised by functions: `NOT_SIGNED_IN`, `NOT_ALLOWED`,
`NOT_FOUND`, `ITEM_NOT_ACTIVE`, `OWN_ITEM`, `DUPLICATE_CLAIM`,
`ALREADY_APPROVED`, `INVALID_STATUS`, `INVALID_INPUT`. Map each to a
friendly message in `src/lib/constants.ts`.

## Security rules (non-negotiable)

1. **RLS on every table.** Enable RLS in the same migration that
   creates the table. (With RLS on and no policies, nobody can read or
   write the table, which is safe.) Add its policies in the same or the
   next migration, before any app code uses the table.
2. **Status columns are never written directly.** Every status change
   goes through a function above. Never add an UPDATE grant or policy
   that lets users change `status`, `user_id`, `report_type`,
   `claim_type`, `reviewed_by`, or `reviewed_at`.
3. **Users never write to `claims` directly.** Only the claim functions
   write to it.
4. **Never trust identity or state from the client.** Do not send
   `user_id`, role, status, or claim type from forms. In SQL use
   `auth.uid()`; on the server use `supabase.auth.getClaims()` (or
   `getUser()`). Never trust `getSession()` in server code.
5. **Only the URL and publishable key.** The app uses
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
   and `NEXT_PUBLIC_SITE_URL`. Never add a service-role or secret key,
   and never put a secret in a `NEXT_PUBLIC_` variable.
6. **Hiding a button is not security.** Every permission must also hold
   in the database.
7. **Private data stays private.**
   - `item_private_details` appears only in owner and admin views.
   - Names and emails come only from `get_claim_contact()`.
   - Public pages never show who reported an item.
   - Never log emails, tokens, or private details.
8. **Security-definer functions** use `set search_path = ''`,
   schema-qualify every name (`public.claims`), check `auth.uid()`
   themselves, revoke `execute` from `public` and `anon`, and grant it to
   `authenticated`.
9. **Validate twice.** Zod on the server (Server Actions) and
   constraints in the database, with the same limits.
10. **Images:** private bucket `item-images`, path
    `<user_id>/<uuid>.<ext>`, generated file names only, shown through
    short-lived signed URLs created on the server.
11. **Never read, print, or commit `.env.local`.** If you need a value,
    ask the human.

## Database and migration rules

- Every schema change is a new file in `supabase/migrations/`, created
  with `supabase migration new`. Never edit a migration that is merged or
  applied; write a new one.
- No schema changes through the dashboard without a matching migration.
- After a migration: regenerate `src/types/database.ts`, update
  `src/lib/constants.ts` if values changed, and update `DEVELOPMENT.md`
  section 9 if the data contract changed.
- No DELETE policies for users. Users close reports; they do not delete
  rows.
- Never disable RLS or add `using (true)` / `with check (true)` write
  policies to make something work.
- Every new table: enable RLS and revoke all from anon and authenticated
  in the same migration, then grant back only what is needed. Supabase
  grants full access on new tables by default, and policies don't
  remove it.
- Security-definer helpers used only inside policies go in the private
  schema. Functions the app calls with rpc go in public and must check
  permissions themselves.
- Store times as `timestamptz` (UTC). Display and compare dates in
  `Asia/Karachi`.
- Seed data must be fictional.

## Next.js conventions

- Server Components by default. Add `'use client'` only for state,
  effects, event handlers, or browser APIs.
- **Reads:** in Server Components with the server Supabase client.
- **Writes:** Server Actions. Validate with Zod, then call Supabase
  (table insert/update for content, `rpc` for status changes), then
  `revalidatePath`. Return `{ ok: true }` or
  `{ ok: false, error, fieldErrors? }`.
- **Image upload:** from the browser client straight to Storage (Server
  Actions have a small default body size limit), then pass the path to
  the Server Action that saves the report.
- Protect private pages on the server in the page or layout (check the
  user, redirect if needed), not only in the proxy.
- Never show raw database errors. Map error codes to friendly messages.
- Every data view has loading, empty, and error states.
- Mobile first. Check about 375 px wide and desktop.
- Accessibility: labelled fields, visible focus, semantic HTML, alt
  text, status shown with text and not only colour.
- UI text in clear, simple English.

## TypeScript and code style

- `strict` on. No `any`; use `unknown` and narrow it. No `@ts-ignore`
  without a comment explaining why.
- Components: `PascalCase.tsx`. Utilities: `camelCase.ts`. Route
  folders: `kebab-case`.
- Keep components small. Do not put all logic in one page file.
- Do not add a dependency without saying why in your report. Prefer
  what is already installed.
- Comments explain why, not what.

## Scope and review

- One developer (the human) owns everything and reviews every change
  alone. Make that review easy: small diffs, clear reports, no
  surprises.
- Features are built in vertical slices (`DEVELOPMENT.md` 14.1):
  database, then server, then UI. Do only the layer the task asks for.
  If it needs another layer too, say so before changing it.
- When you change migrations, RLS, grants, functions, auth, or storage
  policies, list every policy and function you added or changed in your
  report, with one line on who it lets do what. The human uses this
  list for an independent security review.
- One task, one branch, one pull request. Do not fix unrelated things;
  list them as follow-ups.
- Do not reformat, rename, or move files the task does not need.
- Commit only when the human asks. Never commit to `main`, push,
  force-push, merge, or rewrite history unless the human explicitly asks
  in this task.
- Commit messages: short and imperative, e.g. `Add lost items page`.
- Do not edit `AGENTS.md` or `DEVELOPMENT.md` unless the task is about
  them or you changed the data contract. Then update `DEVELOPMENT.md` in
  the same pull request.

## Before you say a task is done

1. `npm run lint` and `npm run build` pass.
2. Tests for what you changed pass (once tests are configured).
3. Database changes are tested as **visitor**, **report owner**,
   **other user**, and **admin**, and forbidden actions fail.
4. You exercised the feature you built, or explained why you could not.
5. UI changes were checked at mobile and desktop widths.

## Stop and ask when

- The task is unclear or contradicts `DEVELOPMENT.md`.
- The task needs a new table, column, status, route, or function.
- You are changing auth, RLS, grants, storage policies, or admin
  features and are not sure the change is safe.
- A command would affect a remote Supabase project, production, or Git
  history.
- You need a secret, a real email domain, real campus locations, or
  real user data.

## Report format at the end of a task

- **Summary:** one to three sentences.
- **Files changed:** a list.
- **How I tested:** commands run and what you checked.
- **Database:** migration file names, whether types were regenerated,
  and each policy or function added or changed, with one line on who it
  lets do what.
- **Not done / known issues.**
- **Follow-ups:** unrelated problems you noticed.

## Never

- Commit `.env*` files (except `.env.example`), secrets, or real student
  data.
- Use a service-role or secret key.
- Disable RLS or add open write policies.
- Store passwords or tokens in tables.
- Show phone numbers, ID numbers, or emails publicly.
- Approve claims automatically or decide ownership in code.
- Use official MUET logos or claim official endorsement.
