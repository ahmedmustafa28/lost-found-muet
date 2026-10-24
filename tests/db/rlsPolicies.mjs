// Checks the rls_policies migration as each kind of caller: visitor, report
// owner, other user, claimant and admin. Every allowed read and write is
// tried, and so is every forbidden one, which must fail or change no rows.
// Usage: npm run test:db
import { setup } from "./harness.mjs";

const { db, check, expectOk, expectError, expectValue, actAs, finish } = await setup();

const OWNER = "00000000-0000-0000-0000-000000000001";
const OTHER = "00000000-0000-0000-0000-000000000002";
const CLAIMANT = "00000000-0000-0000-0000-000000000003";
const ADMIN = "00000000-0000-0000-0000-000000000004";
const R_ACTIVE = "10000000-0000-0000-0000-000000000001"; // owner's, has private details and a claim
const R_PLAIN = "10000000-0000-0000-0000-000000000002"; // owner's, nothing attached
const R_CLOSED = "10000000-0000-0000-0000-000000000003"; // owner's, claimant has a rejected claim
// Hiding closes a report's claims. The pending claim here is a state the
// functions never leave behind; it checks the policy's hidden guard alone.
const R_HIDDEN = "10000000-0000-0000-0000-000000000004"; // owner's, claimant has a pending claim
const R_OTHER = "10000000-0000-0000-0000-000000000005"; // other user's
const R_RESOLVED = "10000000-0000-0000-0000-000000000006"; // owner's, claimant has an approved claim
const C_ACTIVE = "20000000-0000-0000-0000-000000000001";
const DENIED = "permission denied";
const RLS = "row-level security";

// Fixture, written as the superuser (which bypasses RLS).
const desc = "'Placeholder description.'";
const msg = "'Placeholder claim message.'";
await db.exec(`
  insert into auth.users (id) values ('${OWNER}'), ('${OTHER}'), ('${CLAIMANT}'), ('${ADMIN}');
  insert into public.profiles (id, full_name) values
    ('${OWNER}', 'Owner Person'), ('${OTHER}', 'Other Person'),
    ('${CLAIMANT}', 'Claimant Person'), ('${ADMIN}', 'Admin Person');
  insert into public.admins (user_id) values ('${ADMIN}');
  insert into public.campus_locations (key, label, is_active) values
    ('library', 'Library (placeholder)', true), ('old_gate', 'Old gate (placeholder)', false);
  insert into public.item_reports
    (id, user_id, report_type, title, description, category, location_key, event_date, status)
  values
    ('${R_ACTIVE}', '${OWNER}', 'found', 'Owner active', ${desc}, 'wallet', 'library', current_date, 'active'),
    ('${R_PLAIN}', '${OWNER}', 'lost', 'Owner plain', ${desc}, 'keys', 'library', current_date, 'active'),
    ('${R_CLOSED}', '${OWNER}', 'found', 'Owner closed', ${desc}, 'phone', 'library', current_date, 'closed'),
    ('${R_HIDDEN}', '${OWNER}', 'found', 'Owner hidden', ${desc}, 'bag', 'library', current_date, 'hidden'),
    ('${R_OTHER}', '${OTHER}', 'lost', 'Other active', ${desc}, 'books', 'library', current_date, 'active'),
    ('${R_RESOLVED}', '${OWNER}', 'found', 'Owner resolved', ${desc}, 'stationery', 'library', current_date, 'resolved');
  insert into public.item_private_details (item_id, details) values
    ('${R_ACTIVE}', 'Placeholder detail'), ('${R_CLOSED}', 'Placeholder detail'),
    ('${R_HIDDEN}', 'Placeholder detail');
  insert into public.claims (id, item_id, claimant_id, claim_type, message, status, handover_note) values
    ('${C_ACTIVE}', '${R_ACTIVE}', '${CLAIMANT}', 'ownership', ${msg}, 'pending', null),
    (gen_random_uuid(), '${R_CLOSED}', '${CLAIMANT}', 'ownership', ${msg}, 'rejected', null),
    (gen_random_uuid(), '${R_HIDDEN}', '${CLAIMANT}', 'ownership', ${msg}, 'pending', null),
    (gen_random_uuid(), '${R_RESOLVED}', '${CLAIMANT}', 'ownership', ${msg}, 'approved', 'Library entrance, Monday 2 pm');
  insert into public.abuse_reports (item_id, reporter_id, reason) values ('${R_ACTIVE}', '${OTHER}', 'scam');
  insert into public.admin_audit_log (admin_id, action, target_type, target_id, reason)
    values ('${ADMIN}', 'hide_report', 'item_report', '${R_HIDDEN}', 'Placeholder reason');
`);

const list = (col, table) => `select coalesce(string_agg(${col}, ', ' order by ${col}), '') from public.${table}`;
const readSql = {
  item_reports: list("title", "item_reports"),
  campus_locations: list("key", "campus_locations"),
  profiles: list("full_name", "profiles"),
  item_private_details: "select count(*) from public.item_private_details",
  claims: "select count(*) from public.claims",
  abuse_reports: "select count(*) from public.abuse_reports",
  admin_audit_log: "select count(*) from public.admin_audit_log",
  admins: "select count(*) from public.admins",
};
async function expectReads(who, expected) {
  for (const [table, want] of Object.entries(expected)) {
    if (want === DENIED) await expectError(`${who} reads ${table}`, readSql[table], DENIED);
    else await expectValue(`${who} reads ${table}`, readSql[table], want);
  }
}
// Rows an UPDATE changed: 0 means the policy filtered every row out.
const changed = (sql) => `with u as (${sql} returning 1) select count(*) from u`;
const newReport = (cols = "", vals = "") => `insert into public.item_reports
  (report_type, title, description, category, location_key, event_date${cols})
  values ('lost', 'Owner new', ${desc}, 'keys', 'library', current_date${vals})`;
const ALL_ACTIVE = "Other active, Owner active, Owner plain";

console.log("\nGrants and functions (catalog)");
const sortedRows = async (sql) => (await db.query(sql)).rows.map((r) => r.g).sort();
const sameList = (name, got, want) =>
  check(name, JSON.stringify(got) === JSON.stringify([...want].sort()), `got:\n          ${got.join("\n          ")}`);
sameList("table grants to anon and authenticated", await sortedRows(`
  select a.grantee::regrole::text || ' ' || a.privilege_type || ' ' || c.relname as g
  from pg_class c cross join lateral aclexplode(c.relacl) a
  where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
    and a.grantee in ('anon'::regrole, 'authenticated'::regrole)`), [
  "anon SELECT campus_locations", "anon SELECT item_reports",
  ...["profiles", "campus_locations", "item_reports", "item_private_details", "claims",
    "abuse_reports", "admin_audit_log"].map((t) => `authenticated SELECT ${t}`),
]);
const cols = (priv, table, names) => names.map((n) => `authenticated ${priv} ${table}.${n}`);
const reportCols = ["title", "description", "category", "location_key", "location_detail", "event_date", "image_path"];
sameList("column grants to anon and authenticated", await sortedRows(`
  select x.grantee::regrole::text || ' ' || x.privilege_type || ' ' || c.relname || '.' || a.attname as g
  from pg_attribute a join pg_class c on c.oid = a.attrelid
  cross join lateral aclexplode(a.attacl) x
  where c.relnamespace = 'public'::regnamespace and a.attnum > 0
    and x.grantee in ('anon'::regrole, 'authenticated'::regrole)`), [
  ...cols("UPDATE", "profiles", ["full_name"]),
  ...cols("INSERT", "item_reports", ["report_type", ...reportCols]),
  ...cols("UPDATE", "item_reports", reportCols),
  ...cols("INSERT", "item_private_details", ["item_id", "details"]),
  ...cols("UPDATE", "item_private_details", ["details"]),
  ...cols("INSERT", "abuse_reports", ["item_id", "reason", "details"]),
]);
await expectValue("policies in public", `select count(*) from pg_policies where schemaname = 'public'`, 15);
await expectValue("DELETE or ALL policies", `select count(*) from pg_policies where schemaname = 'public' and cmd in ('DELETE', 'ALL')`, 0);
await expectValue("policies on admins", `select count(*) from pg_policies where schemaname = 'public' and tablename = 'admins'`, 0);
for (const fn of ["public.is_admin()", "private.is_report_owner(uuid)", "private.has_claim_on_report(uuid)"]) {
  await expectValue(`${fn} is security definer with search_path ''`,
    `select prosecdef and proconfig = array['search_path=""'] from pg_proc where oid = '${fn}'::regprocedure`, true);
  await expectValue(`${fn} executable by anon`, `select has_function_privilege('anon', '${fn}', 'execute')`, false);
  await expectValue(`${fn} executable by authenticated`, `select has_function_privilege('authenticated', '${fn}', 'execute')`, true);
}
await expectValue("anon can use schema private", `select has_schema_privilege('anon', 'private', 'usage')`, false);
await expectValue("authenticated can use schema private", `select has_schema_privilege('authenticated', 'private', 'usage')`, true);

// Reads first, before any writes change the fixture.
console.log("\nVisitor reads");
await actAs("anon");
await expectReads("visitor", {
  item_reports: ALL_ACTIVE, campus_locations: "library",
  profiles: DENIED, item_private_details: DENIED, claims: DENIED,
  abuse_reports: DENIED, admin_audit_log: DENIED, admins: DENIED,
});
await expectError("visitor calls is_admin()", "select public.is_admin()", DENIED);
await expectError("visitor calls private.is_report_owner()", `select private.is_report_owner('${R_ACTIVE}')`, DENIED);

console.log("\nReport owner reads");
await actAs("authenticated", OWNER);
await expectReads("owner", {
  item_reports: "Other active, Owner active, Owner closed, Owner hidden, Owner plain, Owner resolved",
  campus_locations: "library", profiles: "Owner Person",
  item_private_details: 3, claims: 4, abuse_reports: 0, admin_audit_log: 0, admins: DENIED,
});
await expectValue("owner is_admin()", "select public.is_admin()", false);

console.log("\nOther user reads");
await actAs("authenticated", OTHER);
await expectReads("other user", {
  item_reports: ALL_ACTIVE, campus_locations: "library", profiles: "Other Person",
  item_private_details: 0, claims: 0, abuse_reports: 1, admin_audit_log: 0, admins: DENIED,
});

console.log("\nClaimant reads");
await actAs("authenticated", CLAIMANT);
await expectReads("claimant", {
  // Sees the resolved report (approved claim). Not the closed one (claim
  // rejected) or the hidden one (pending claim, but hidden).
  item_reports: "Other active, Owner active, Owner plain, Owner resolved",
  campus_locations: "library", profiles: "Claimant Person",
  item_private_details: 0, claims: 4, abuse_reports: 0, admin_audit_log: 0, admins: DENIED,
});
// claims and item_reports policies both look at the other table.
await expectValue("claimant joins claims to reports (no policy recursion)",
  "select count(*) from public.claims c join public.item_reports r on r.id = c.item_id", 2);

console.log("\nAdmin reads");
await actAs("authenticated", ADMIN);
await expectReads("admin", {
  item_reports: "Other active, Owner active, Owner closed, Owner hidden, Owner plain, Owner resolved",
  campus_locations: "library, old_gate",
  profiles: "Admin Person, Claimant Person, Other Person, Owner Person",
  item_private_details: 3, claims: 4, abuse_reports: 1, admin_audit_log: 1, admins: DENIED,
});
await expectValue("admin is_admin()", "select public.is_admin()", true);

console.log("\nVisitor writes");
await actAs("anon");
await expectError("visitor inserts a report", newReport(), DENIED);
await expectError("visitor updates a report", `update public.item_reports set description = ${desc}`, DENIED);
await expectError("visitor deletes a report", "delete from public.item_reports", DENIED);
await expectError("visitor flags a report", `insert into public.abuse_reports (item_id, reason) values ('${R_ACTIVE}', 'scam')`, DENIED);
await expectError("visitor inserts a claim", `insert into public.claims (item_id, claimant_id, claim_type, message) values ('${R_ACTIVE}', '${OWNER}', 'ownership', ${msg})`, DENIED);
await expectError("visitor inserts a location", "insert into public.campus_locations (key, label) values ('x', 'X')", DENIED);

console.log("\nReport owner writes");
await actAs("authenticated", OWNER);
await expectOk("owner inserts a report", newReport());
await expectValue("  -> user_id and status from defaults",
  "select user_id || ' ' || status from public.item_reports where title = 'Owner new'", `${OWNER} active`);
await expectError("owner inserts a report with status", newReport(", status", ", 'hidden'"), DENIED);
await expectError("owner inserts a report for another user", newReport(", user_id", `, '${OTHER}'`), DENIED);
await expectError("owner inserts a report with chosen id", newReport(", id", ", gen_random_uuid()"), DENIED);
await expectValue("owner edits own active report", changed(`update public.item_reports set description = 'Edited placeholder.' where id = '${R_ACTIVE}'`), 1);
await expectValue("owner edits own closed report", changed(`update public.item_reports set description = 'Edited placeholder.' where id = '${R_CLOSED}'`), 0);
await expectValue("owner edits own hidden report", changed(`update public.item_reports set description = 'Edited placeholder.' where id = '${R_HIDDEN}'`), 0);
await expectValue("owner edits other user's report", changed(`update public.item_reports set description = 'Edited placeholder.' where id = '${R_OTHER}'`), 0);
for (const [col, val] of [["status", "'resolved'"], ["user_id", `'${OTHER}'`], ["report_type", "'lost'"], ["resolved_at", "now()"]]) {
  await expectError(`owner sets ${col} on own report`, `update public.item_reports set ${col} = ${val} where id = '${R_ACTIVE}'`, DENIED);
}
await expectError("owner deletes own report", `delete from public.item_reports where id = '${R_ACTIVE}'`, DENIED);
await expectValue("owner renames self", changed(`update public.profiles set full_name = 'Owner Renamed' where id = '${OWNER}'`), 1);
await expectValue("owner renames other user", changed(`update public.profiles set full_name = 'Renamed' where id = '${OTHER}'`), 0);
await expectError("owner changes own profile id", `update public.profiles set id = '${OTHER}' where id = '${OWNER}'`, DENIED);
await expectError("owner inserts a profile", `insert into public.profiles (id, full_name) values ('${OWNER}', 'Again')`, DENIED);
await expectValue("owner edits private details (active report)", changed(`update public.item_private_details set details = 'Edited detail' where item_id = '${R_ACTIVE}'`), 1);
await expectValue("owner edits private details (closed report)", changed(`update public.item_private_details set details = 'Edited detail' where item_id = '${R_CLOSED}'`), 0);
await expectValue("owner edits private details (hidden report)", changed(`update public.item_private_details set details = 'Edited detail' where item_id = '${R_HIDDEN}'`), 0);
await expectError("owner adds private details to own resolved report", `insert into public.item_private_details (item_id, details) values ('${R_RESOLVED}', 'Late detail')`, RLS);
await expectOk("owner adds private details to own report", `insert into public.item_private_details (item_id, details) values ('${R_PLAIN}', 'New detail')`);
await expectError("owner adds private details to other user's report", `insert into public.item_private_details (item_id, details) values ('${R_OTHER}', 'Sneaky detail')`, RLS);
await expectError("owner moves private details to another report", `update public.item_private_details set item_id = '${R_OTHER}' where item_id = '${R_ACTIVE}'`, DENIED);
await expectError("owner deletes private details", `delete from public.item_private_details where item_id = '${R_ACTIVE}'`, DENIED);
await expectError("owner approves a claim directly", `update public.claims set status = 'approved', handover_note = 'Library, Monday 2 pm' where id = '${C_ACTIVE}'`, DENIED);
await expectError("owner deletes a claim", `delete from public.claims where id = '${C_ACTIVE}'`, DENIED);
await expectError("owner writes to the audit log", "insert into public.admin_audit_log (action, target_type) values ('x', 'y')", DENIED);
await expectError("owner makes self admin", `insert into public.admins (user_id) values ('${OWNER}')`, DENIED);

console.log("\nOther user writes");
await actAs("authenticated", OTHER);
await expectValue("other user edits owner's report", changed(`update public.item_reports set description = 'Edited placeholder.' where id = '${R_ACTIVE}'`), 0);
await expectValue("other user edits owner's private details", changed(`update public.item_private_details set details = 'Edited detail' where item_id = '${R_ACTIVE}'`), 0);
await expectError("other user adds private details to owner's report",
  "insert into public.item_private_details (item_id, details) select id, 'Sneaky detail' from public.item_reports where title = 'Owner new'", RLS);
await expectOk("other user flags owner's active report", `insert into public.abuse_reports (item_id, reason, details) values ('${R_PLAIN}', 'fake_or_spam', '')`);
await expectValue("  -> reporter_id from default", `select reporter_id from public.abuse_reports where item_id = '${R_PLAIN}'`, OTHER);
await expectError("other user flags a hidden report", `insert into public.abuse_reports (item_id, reason) values ('${R_HIDDEN}', 'scam')`, RLS);
await expectError("other user flags a closed report", `insert into public.abuse_reports (item_id, reason) values ('${R_CLOSED}', 'scam')`, RLS);
await expectError("other user flags an unknown report ID", "insert into public.abuse_reports (item_id, reason) values (gen_random_uuid(), 'scam')", RLS);
await expectError("other user flags as someone else", `insert into public.abuse_reports (item_id, reporter_id, reason) values ('${R_OTHER}', '${OWNER}', 'scam')`, DENIED);
await expectError("other user sets a flag's status", "update public.abuse_reports set status = 'dismissed'", DENIED);
await expectError("other user deletes own flag", "delete from public.abuse_reports", DENIED);
await expectError("other user claims a report directly", `insert into public.claims (item_id, claimant_id, claim_type, message) values ('${R_ACTIVE}', '${OTHER}', 'ownership', ${msg})`, DENIED);

console.log("\nClaimant writes");
await actAs("authenticated", CLAIMANT);
await expectError("claimant cancels own claim directly", `update public.claims set status = 'cancelled' where id = '${C_ACTIVE}'`, DENIED);
await expectError("claimant edits own claim message", `update public.claims set message = ${msg} where id = '${C_ACTIVE}'`, DENIED);
await expectValue("claimant edits owner's report", changed(`update public.item_reports set description = 'Edited placeholder.' where id = '${R_ACTIVE}'`), 0);

console.log("\nAdmin writes");
await actAs("authenticated", ADMIN);
await expectError("admin hides a report directly", `update public.item_reports set status = 'hidden' where id = '${R_ACTIVE}'`, DENIED);
await expectValue("admin edits another user's report", changed(`update public.item_reports set description = 'Edited placeholder.' where id = '${R_ACTIVE}'`), 0);
await expectError("admin deletes a report", `delete from public.item_reports where id = '${R_ACTIVE}'`, DENIED);
await expectError("admin rejects a claim directly", `update public.claims set status = 'rejected' where id = '${C_ACTIVE}'`, DENIED);
await expectError("admin reviews a flag directly", "update public.abuse_reports set status = 'actioned'", DENIED);
await expectError("admin writes to the audit log directly", "insert into public.admin_audit_log (action, target_type) values ('x', 'y')", DENIED);
await expectError("admin edits campus locations", "update public.campus_locations set label = 'Changed'", DENIED);
await expectError("admin adds an admin", `insert into public.admins (user_id) values ('${OTHER}')`, DENIED);

await actAs(null);
finish();
