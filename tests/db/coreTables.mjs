// Applies every migration in supabase/migrations to PGlite (Postgres in WASM)
// with a tiny stand-in for Supabase's auth schema, then checks constraints,
// indexes, foreign-key delete rules and RLS. Docker isn't needed, so this runs
// where `supabase db reset` can't. Usage: npm run test:db
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

const migrationsDir = fileURLToPath(new URL("../../supabase/migrations/", import.meta.url));
const db = new PGlite();

const U1 = "00000000-0000-0000-0000-000000000001"; // report owner
const U2 = "00000000-0000-0000-0000-000000000002"; // claimant / flagger
const U3 = "00000000-0000-0000-0000-000000000003"; // reviewer / admin
const U4 = "00000000-0000-0000-0000-000000000004"; // second claimant
const ITEM = "10000000-0000-0000-0000-000000000001";
const ITEM2 = "10000000-0000-0000-0000-000000000002";
const C1 = "20000000-0000-0000-0000-000000000001";
const C2 = "20000000-0000-0000-0000-000000000002";

let pass = 0, fail = 0;
const ok = (name) => { pass++; console.log(`  PASS  ${name}`); };
const bad = (name, why) => { fail++; console.log(`  FAIL  ${name}\n        ${why}`); };

async function expectOk(name, sql) {
  try { await db.exec(sql); ok(name); } catch (e) { bad(name, `unexpected error: ${e.message}`); }
}
async function expectError(name, sql, needle) {
  try { await db.exec(sql); bad(name, `expected error containing "${needle}", but it succeeded`); }
  catch (e) { check(`${name}  [${needle}]`, e.message.includes(needle), `wrong error: ${e.message}`); }
}
async function expectValue(name, sql, expected) {
  const { rows } = await db.query(sql);
  const got = rows.length ? Object.values(rows[0])[0] : undefined;
  check(`${name} = ${expected}`, String(got) === String(expected), `expected ${expected}, got ${got}`);
}
function check(name, passed, why) {
  if (passed) ok(name);
  else bad(name, why);
}

const ver = await db.query("select version()");
console.log(ver.rows[0].version.split(",")[0]);

// --- Stand-in for Supabase: auth.users, auth.uid(), and its default grants.
await db.exec(`
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable
    as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create role anon nologin;
  create role authenticated nologin;
  grant usage on schema public, auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
`);

console.log("\nApply migrations");
// Filenames start with a timestamp, so sorting gives the order Supabase uses.
for (const file of readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort()) {
  await expectOk(file, readFileSync(join(migrationsDir, file), "utf8"));
}

await db.exec(`
  insert into auth.users (id) values ('${U1}'), ('${U2}'), ('${U3}'), ('${U4}');
  insert into public.campus_locations (key, label) values ('library', 'Library (placeholder)');
`);

const L = (n, ch = "x") => ch.repeat(n);
const item = (cols) => {
  const base = { id: `'${ITEM}'`, user_id: `'${U1}'`, report_type: "'found'", title: "'Blue wallet'",
    description: "'Found near the library entrance.'", category: "'wallet'",
    location_key: "'library'", event_date: "current_date", ...cols };
  const keys = Object.keys(base).filter((k) => base[k] !== undefined);
  return `insert into public.item_reports (${keys.join(", ")}) values (${keys.map((k) => base[k]).join(", ")})`;
};

console.log("\nprofiles");
await expectError("full_name 1 char", `insert into public.profiles values ('${U1}', 'A')`, "profiles_full_name_length");
await expectError("full_name whitespace only", `insert into public.profiles values ('${U1}', '     ')`, "profiles_full_name_length");
await expectError("full_name 81 chars", `insert into public.profiles values ('${U1}', '${L(81)}')`, "profiles_full_name_length");
await expectOk("full_name 80 chars", `insert into public.profiles values ('${U1}', '${L(80)}')`);
await expectError("profile for unknown user", `insert into public.profiles values (gen_random_uuid(), 'Ali')`, "profiles_id_fkey");

console.log("\nitem_reports");
await expectError("report_type 'stolen'", item({ report_type: "'stolen'" }), "item_reports_report_type_valid");
await expectError("category 'laptop'", item({ category: "'laptop'" }), "item_reports_category_valid");
await expectError("status 'deleted'", item({ status: "'deleted'" }), "item_reports_status_valid");
await expectError("title trims to 2 chars", item({ title: "'  ab  '" }), "item_reports_title_length");
await expectError("title 81 chars", item({ title: `'${L(81)}'` }), "item_reports_title_length");
await expectError("description 9 chars", item({ description: `'${L(9)}'` }), "item_reports_description_length");
await expectError("description 1001 chars", item({ description: `'${L(1001)}'` }), "item_reports_description_length");
await expectError("location_detail 121 chars", item({ location_detail: `'${L(121)}'` }), "item_reports_location_detail_length");
await expectError("unknown location_key", item({ location_key: "'mars'" }), "item_reports_location_key_fkey");
await expectError("event_date missing", item({ event_date: "null" }), "event_date");
await expectError("owner not an auth user", item({ user_id: "gen_random_uuid()" }), "item_reports_user_id_fkey");
await expectOk("valid report (empty location_detail, title 80, description 1000)",
  item({ title: `'${L(80)}'`, description: `'${L(1000)}'`, location_detail: "''" }));
await expectValue("status defaults to", `select status from public.item_reports where id = '${ITEM}'`, "active");
await db.exec(`set request.jwt.claim.sub = '${U2}'`);
await expectOk("user_id defaults to auth.uid()", item({ id: `'${ITEM2}'`, user_id: undefined, report_type: "'lost'" }));
await expectValue("  -> user_id", `select user_id from public.item_reports where id = '${ITEM2}'`, U2);
await db.exec(`reset request.jwt.claim.sub`);
await expectOk("future event_date still accepted (trigger comes later)",
  item({ id: "gen_random_uuid()", event_date: "current_date + 30" }));

console.log("\nitem_private_details");
await expectError("details empty", `insert into public.item_private_details (item_id, details) values ('${ITEM}', '')`, "item_private_details_details_length");
await expectError("details whitespace only", `insert into public.item_private_details (item_id, details) values ('${ITEM}', '   ')`, "item_private_details_details_length");
await expectError("details 501 chars", `insert into public.item_private_details (item_id, details) values ('${ITEM}', '${L(501)}')`, "item_private_details_details_length");
await expectOk("details 1 char", `insert into public.item_private_details (item_id, details) values ('${ITEM}', 'x')`);
await expectError("second row for same report", `insert into public.item_private_details (item_id, details) values ('${ITEM}', 'again')`, "item_private_details_pkey");

console.log("\nclaims");
const claim = (id, claimant, extra = "") =>
  `insert into public.claims (id, item_id, claimant_id, claim_type, message${extra ? ", " + extra.split("=")[0] : ""})
   values ('${id}', '${ITEM}', '${claimant}', 'ownership', 'This is my wallet, blue with a red zip.'${extra ? ", " + extra.split("=").slice(1).join("=") : ""})`;
await expectError("claim_type 'other'", `insert into public.claims (item_id, claimant_id, claim_type, message) values ('${ITEM}', '${U2}', 'other', 'This is my wallet honestly.')`, "claims_claim_type_valid");
await expectError("message 9 chars", `insert into public.claims (item_id, claimant_id, claim_type, message) values ('${ITEM}', '${U2}', 'ownership', '${L(9)}')`, "claims_message_length");
await expectError("message whitespace only", `insert into public.claims (item_id, claimant_id, claim_type, message) values ('${ITEM}', '${U2}', 'ownership', '${L(20, " ")}')`, "claims_message_length");
await expectError("status 'accepted'", claim(C1, U2, "status='accepted'"), "claims_status_valid");
await expectOk("pending claim", claim(C1, U2));
await expectError("second open claim, same user and report", claim(C2, U2), "claims_one_open_per_claimant_idx");
await expectError("approved without handover note", `update public.claims set status = 'approved' where id = '${C1}'`, "claims_approved_has_handover_note");
await expectError("handover note 4 chars", `update public.claims set status = 'approved', handover_note = 'abcd' where id = '${C1}'`, "claims_handover_note_length");
await expectError("handover note 501 chars", `update public.claims set status = 'approved', handover_note = '${L(501)}' where id = '${C1}'`, "claims_handover_note_length");
await expectOk("approve with handover note", `update public.claims set status = 'approved', handover_note = 'Library entrance, Monday 2 pm', reviewed_by = '${U3}', reviewed_at = now() where id = '${C1}'`);
await expectOk("other user's pending claim", claim(C2, U4));
await expectError("second approved claim on same report", `update public.claims set status = 'approved', handover_note = 'Gate 1, Tuesday' where id = '${C2}'`, "claims_one_approved_per_item_idx");
await expectOk("rejected keeps old handover note", `update public.claims set status = 'rejected' where id = '${C1}'`);
await expectOk("new claim allowed after previous one ended", claim(gen(), U2));

console.log("\nabuse_reports");
await db.exec(`set request.jwt.claim.sub = '${U2}'`);
await expectError("reason 'rude'", `insert into public.abuse_reports (item_id, reason) values ('${ITEM}', 'rude')`, "abuse_reports_reason_valid");
await expectError("details 1001 chars", `insert into public.abuse_reports (item_id, reason, details) values ('${ITEM}', 'other', '${L(1001)}')`, "abuse_reports_details_length");
await expectOk("flag (reporter_id from auth.uid(), empty details)", `insert into public.abuse_reports (item_id, reason, details) values ('${ITEM}', 'scam', '')`);
await expectValue("  -> reporter_id", `select reporter_id from public.abuse_reports limit 1`, U2);
await expectError("second open flag by same user", `insert into public.abuse_reports (item_id, reason) values ('${ITEM}', 'other')`, "abuse_reports_one_open_per_reporter_idx");
await expectError("status 'closed'", `update public.abuse_reports set status = 'closed'`, "abuse_reports_status_valid");
await expectOk("dismiss flag", `update public.abuse_reports set status = 'dismissed', reviewed_by = '${U3}', reviewed_at = now()`);
await expectOk("new flag allowed after dismissal", `insert into public.abuse_reports (item_id, reason) values ('${ITEM}', 'other')`);
await db.exec(`reset request.jwt.claim.sub`);

console.log("\nadmins and admin_audit_log");
await expectOk("add admin", `insert into public.admins (user_id) values ('${U3}')`);
await expectOk("audit row", `insert into public.admin_audit_log (admin_id, action, target_type, target_id, reason) values ('${U3}', 'hide_report', 'item_report', '${ITEM}', 'test')`);

console.log("\nForeign-key delete rules");
await expectError("delete a location still in use", `delete from public.campus_locations where key = 'library'`, "item_reports_location_key_fkey");
await expectOk("delete reviewer/admin account", `delete from auth.users where id = '${U3}'`);
await expectValue("  -> claims.reviewed_by set null", `select count(*) from public.claims where reviewed_by is not null`, 0);
await expectValue("  -> abuse_reports.reviewed_by set null", `select count(*) from public.abuse_reports where reviewed_by is not null`, 0);
await expectValue("  -> audit row kept, admin_id null", `select count(*) from public.admin_audit_log where admin_id is null`, 1);
await expectValue("  -> admins row cascaded", `select count(*) from public.admins`, 0);
await expectOk("delete claimant account", `delete from auth.users where id = '${U2}'`);
await expectValue("  -> their claims cascaded", `select count(*) from public.claims where claimant_id = '${U2}'`, 0);
await expectValue("  -> their flags cascaded", `select count(*) from public.abuse_reports`, 0);
await expectValue("  -> their report cascaded", `select count(*) from public.item_reports where id = '${ITEM2}'`, 0);
await expectOk("delete report", `delete from public.item_reports where id = '${ITEM}'`);
await expectValue("  -> private details cascaded", `select count(*) from public.item_private_details`, 0);
await expectValue("  -> claims cascaded", `select count(*) from public.claims`, 0);
await expectOk("delete owner account", `delete from auth.users where id = '${U1}'`);
await expectValue("  -> profile cascaded", `select count(*) from public.profiles`, 0);
await expectValue("  -> remaining reports cascaded", `select count(*) from public.item_reports`, 0);

console.log("\nRLS");
await expectValue("tables in public", `select count(*) from pg_tables where schemaname = 'public'`, 8);
await expectValue("tables with RLS enabled", `select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity`, 8);
await expectValue("policies", `select count(*) from pg_policies where schemaname = 'public'`, 0);
await db.exec(`insert into auth.users (id) values ('${U1}'); insert into public.campus_locations (key, label) values ('gate', 'Gate (placeholder)') on conflict do nothing;`);
await db.exec(item({ id: `'${ITEM}'` }));
for (const role of ["anon", "authenticated"]) {
  await db.exec(`set role ${role}; set request.jwt.claim.sub = '${role === "authenticated" ? U1 : ""}'`);
  for (const t of ["item_reports", "campus_locations", "admins"]) {
    await expectValue(`${role} sees rows in ${t}`, `select count(*) from public.${t}`, 0);
  }
  await expectError(`${role} insert into item_reports`, item({ id: "gen_random_uuid()" }), "row-level security");
  await expectError(`${role} insert into admins`, `insert into public.admins (user_id) values ('${U1}')`, "row-level security");
  await expectValue(`${role} update item_reports (rows changed)`, `with u as (update public.item_reports set status = 'hidden' returning 1) select count(*) from u`, 0);
  await db.exec(`reset role; reset request.jwt.claim.sub`);
}

console.log("\nIndexes");
const expectedIndexes = [
  "item_reports_status_type_created_idx", "item_reports_status_category_idx",
  "item_reports_status_location_idx", "item_reports_user_created_idx",
  "claims_one_open_per_claimant_idx", "claims_one_approved_per_item_idx",
  "claims_item_status_idx", "claims_claimant_created_idx", "claims_reviewed_by_idx",
  "abuse_reports_one_open_per_reporter_idx", "abuse_reports_item_idx",
  "abuse_reports_reporter_idx", "abuse_reports_reviewed_by_idx", "admin_audit_log_admin_idx",
];
const { rows: idxRows } = await db.query(`select indexname from pg_indexes where schemaname = 'public' and indexname like '%_idx'`);
const haveIndexes = new Set(idxRows.map((r) => r.indexname));
for (const name of expectedIndexes) {
  check(`index ${name}`, haveIndexes.has(name), "missing");
}
// A foreign key is covered when a non-partial index (primary keys count)
// starts with its column. location_key is the documented exception.
const { rows: unindexed } = await db.query(`
  select c.conrelid::regclass::text as tbl, a.attname as col
  from pg_constraint c
  join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
  where c.contype = 'f' and c.connamespace = 'public'::regnamespace
    and not exists (
      select 1 from pg_index i
      where i.indrelid = c.conrelid and i.indkey[0] = c.conkey[1] and i.indpred is null)
  order by 1, 2`);
const gaps = unindexed.map((r) => `${r.tbl}.${r.col}`);
check("every foreign key indexed except item_reports.location_key",
  gaps.length === 1 && gaps[0] === "item_reports.location_key", `unindexed: ${gaps.join(", ") || "none"}`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

function gen() { return "30000000-0000-0000-0000-000000000009"; }
