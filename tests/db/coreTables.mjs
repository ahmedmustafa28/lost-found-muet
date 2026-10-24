// Checks the core_tables migration: constraints, indexes, foreign-key delete
// rules, and that RLS is on for every table. Policies and grants are checked
// in rlsPolicies.mjs. Usage: npm run test:db
import { setup } from "./harness.mjs";

const { db, check, expectOk, expectError, expectValue, finish } = await setup();

const U1 = "00000000-0000-0000-0000-000000000001"; // report owner
const U2 = "00000000-0000-0000-0000-000000000002"; // claimant / flagger
const U3 = "00000000-0000-0000-0000-000000000003"; // reviewer / admin
const U4 = "00000000-0000-0000-0000-000000000004"; // second claimant
const ITEM = "10000000-0000-0000-0000-000000000001";
const ITEM2 = "10000000-0000-0000-0000-000000000002";
const C1 = "20000000-0000-0000-0000-000000000001";
const C2 = "20000000-0000-0000-0000-000000000002";

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

// Profiles are created by the handle_new_user trigger, so these update them.
console.log("\nprofiles");
const setName = (name) => `update public.profiles set full_name = '${name}' where id = '${U1}'`;
await expectError("full_name 1 char", setName("A"), "profiles_full_name_length");
await expectError("full_name whitespace only", setName("     "), "profiles_full_name_length");
await expectError("full_name 81 chars", setName(L(81)), "profiles_full_name_length");
await expectOk("full_name 80 chars", setName(L(80)));
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
// validate_item_report rejects it before the foreign key is checked.
await expectError("unknown location_key", item({ location_key: "'mars'" }), "INVALID_INPUT");
await expectError("event_date missing", item({ event_date: "null" }), "event_date");
await expectError("owner not an auth user", item({ user_id: "gen_random_uuid()" }), "item_reports_user_id_fkey");
await expectOk("valid report (empty location_detail, title 80, description 1000)",
  item({ title: `'${L(80)}'`, description: `'${L(1000)}'`, location_detail: "''" }));
await expectValue("status defaults to", `select status from public.item_reports where id = '${ITEM}'`, "active");
await db.exec(`set request.jwt.claim.sub = '${U2}'`);
await expectOk("user_id defaults to auth.uid()", item({ id: `'${ITEM2}'`, user_id: undefined, report_type: "'lost'" }));
await expectValue("  -> user_id", `select user_id from public.item_reports where id = '${ITEM2}'`, U2);
await db.exec(`reset request.jwt.claim.sub`);
await expectError("future event_date (validate_item_report trigger)",
  item({ id: "gen_random_uuid()", event_date: "current_date + 30" }), "INVALID_INPUT");

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
await expectValue("  -> profile cascaded", `select count(*) from public.profiles where id = '${U1}'`, 0);
await expectValue("  -> remaining reports cascaded", `select count(*) from public.item_reports`, 0);

console.log("\nRLS");
await expectValue("tables in public", `select count(*) from pg_tables where schemaname = 'public'`, 8);
await expectValue("tables with RLS enabled", `select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity`, 8);

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

finish();

function gen() { return "30000000-0000-0000-0000-000000000009"; }
