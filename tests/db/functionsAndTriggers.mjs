// Checks the functions migration: every report transition in DEVELOPMENT.md
// 8.6 and claim transition in 8.7 as each role, with the exact error code
// each forbidden call raises; get_claim_contact; flag reviews; and the three
// triggers. Usage: npm run test:db
//
// PGlite has one connection, so two calls can't run at the same time here.
// The row locks are covered by reading the migration, not by these tests.
import { setup } from "./harness.mjs";

const { db, check, expectOk, expectError, expectValue, actAs, finish } = await setup();

const OWNER = "00000000-0000-0000-0000-000000000001";
const OTHER = "00000000-0000-0000-0000-000000000002";
const CLAIMANT = "00000000-0000-0000-0000-000000000003";
const ADMIN = "00000000-0000-0000-0000-000000000004";
const CLAIMANT2 = "00000000-0000-0000-0000-000000000005";
const VISITOR = "visitor";
const NOBODY = ""; // the authenticated role with no user ID
const DENIED = "permission denied";
const MSG = "'This is my wallet, it has a red zip.'";
const NOTE = "'Library entrance, Monday 2 pm'";
const REASON = "'Placeholder reason'";
const TODAY = "(now() at time zone 'Asia/Karachi')::date";
const UUID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const L = (n, ch = "x") => ch.repeat(n);
const lit = (s) => `'${s.replace(/'/g, "''")}'`;
// Whitespace that JavaScript's trim() (and so Zod's .trim()) removes.
const WS = "\t\n\r\u000B\f   　﻿";

await db.exec(`
  insert into auth.users (id, email, raw_user_meta_data) values
    ('${OWNER}', 'owner@example.test', '{"full_name": "Owner Person"}'),
    ('${OTHER}', 'other@example.test', '{"full_name": "Other Person"}'),
    ('${CLAIMANT}', 'claimant@example.test', '{"full_name": "Claimant Person"}'),
    ('${ADMIN}', 'admin@example.test', '{"full_name": "Admin Person"}'),
    ('${CLAIMANT2}', 'claimant2@example.test', '{"full_name": "Second Claimant"}');
  insert into public.admins (user_id) values ('${ADMIN}');
  insert into public.campus_locations (key, label, is_active) values
    ('library', 'Library (placeholder)', true), ('old_gate', 'Old gate (placeholder)', false);
`);

async function val(sql) {
  const { rows } = await db.query(sql);
  return rows.length ? Object.values(rows[0])[0] : undefined;
}
async function become(userId) {
  if (userId === VISITOR) await actAs("anon");
  else await actAs("authenticated", userId);
}
// Fixture rows are written as the superuser, which bypasses RLS.
let reportCount = 0;
async function newReport({ type = "found", status = "active", owner = OWNER } = {}) {
  await actAs(null);
  reportCount++;
  return val(`insert into public.item_reports
    (user_id, report_type, title, description, category, location_key, event_date, status)
    values ('${owner}', '${type}', 'Report ${reportCount}', 'Placeholder description.', 'wallet',
      'library', current_date, '${status}') returning id`);
}
async function newClaim(itemId, claimant, status = "pending") {
  await actAs(null);
  return val(`insert into public.claims (item_id, claimant_id, claim_type, message, status, handover_note)
    values ('${itemId}', '${claimant}', 'ownership', ${MSG}, '${status}',
      ${status === "approved" ? NOTE : "null"}) returning id`);
}
async function expectRow(name, sql, expected) {
  await actAs(null);
  await expectValue(name, sql, expected);
}
const statusOf = (table, id) => `select status from public.${table} where id = '${id}'`;
async function expectInvalid(name, sql, field) {
  try { await db.exec(sql); check(name, false, "expected INVALID_INPUT, but it succeeded"); }
  catch (e) {
    check(`${name}  [INVALID_INPUT ${field}]`, e.message === "INVALID_INPUT" && e.detail === field,
      `got ${e.message} (detail: ${e.detail})`);
  }
}
const submit = (item, msg = MSG) => `select public.submit_claim('${item}', ${msg})`;
const approve = (claim, note = NOTE) => `select public.approve_claim('${claim}', ${note})`;
const reject = (claim) => `select public.reject_claim('${claim}')`;
const cancel = (claim) => `select public.cancel_claim('${claim}')`;
const contact = (claim) => `select full_name || ' <' || email || '>' from public.get_claim_contact('${claim}')`;
const resolve = (item) => `select public.resolve_report('${item}')`;
const close = (item) => `select public.close_report('${item}')`;
const hide = (item, reason = REASON) => `select public.admin_hide_report('${item}', ${reason})`;
const restore = (item, reason = REASON) => `select public.admin_restore_report('${item}', ${reason})`;
const review = (flag, status, reason = REASON) => `select public.admin_review_flag('${flag}', ${status}, ${reason})`;

console.log("\nFunctions (catalog)");
const APP_FUNCTIONS = [
  "public.submit_claim(uuid, text)", "public.approve_claim(uuid, text)", "public.reject_claim(uuid)",
  "public.cancel_claim(uuid)", "public.get_claim_contact(uuid)", "public.resolve_report(uuid)",
  "public.close_report(uuid)", "public.admin_hide_report(uuid, text)",
  "public.admin_restore_report(uuid, text)", "public.admin_review_flag(uuid, text, text)",
];
const INTERNAL_FUNCTIONS = [
  "private.can_see_report(uuid, uuid, text)", "private.lock_visible_report(uuid)",
  "private.lock_visible_claim(uuid)", "private.require_admin()", "private.clean_admin_reason(text)",
  "private.handle_new_user()", "private.set_updated_at()", "private.validate_item_report()",
];
// Plus 2: is_admin, and the sign-up hook restrict_signup_domain (only
// Supabase Auth can run it; tested in signupEmail.mjs).
await expectValue("functions in public (is_admin, the app functions and the sign-up hook)",
  "select count(*) from pg_proc where pronamespace = 'public'::regnamespace", APP_FUNCTIONS.length + 2);
for (const fn of [...APP_FUNCTIONS, ...INTERNAL_FUNCTIONS]) {
  await expectValue(`${fn} search_path ''`, `select proconfig = array['search_path=""'] from pg_proc where oid = '${fn}'::regprocedure`, true);
  await expectValue(`${fn} executable by anon`, `select has_function_privilege('anon', '${fn}', 'execute')`, false);
}
for (const fn of APP_FUNCTIONS) {
  await expectValue(`${fn} security definer`, `select prosecdef from pg_proc where oid = '${fn}'::regprocedure`, true);
  await expectValue(`${fn} executable by authenticated`, `select has_function_privilege('authenticated', '${fn}', 'execute')`, true);
}
for (const fn of INTERNAL_FUNCTIONS) {
  await expectValue(`${fn} executable by authenticated`, `select has_function_privilege('authenticated', '${fn}', 'execute')`, false);
}
// Check constraints call trim_text as the user writing the row.
await expectValue("private.trim_text(text) executable by anon", "select has_function_privilege('anon', 'private.trim_text(text)', 'execute')", false);
await expectValue("private.trim_text(text) executable by authenticated", "select has_function_privilege('authenticated', 'private.trim_text(text)', 'execute')", true);

console.log("\nTrimming matches JavaScript's trim() (Zod)");
// Every Basic Multilingual Plane character except NUL and the surrogates,
// which Postgres text can't hold.
let everyChar = "";
for (let cp = 1; cp <= 0xffff; cp++) {
  if (cp < 0xd800 || cp > 0xdfff) everyChar += String.fromCharCode(cp);
}
const codes = (chars) => chars.map((c) => `U+${c.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")}`).sort().join(" ");
const jsTrimmed = codes([...everyChar].filter((ch) => (ch + "x" + ch).trim() === "x"));
const { rows: trimRows } = await db.query(
  "select string_agg(c, '') as s from regexp_split_to_table($1, '') c where private.trim_text(c || 'x' || c) = 'x'",
  [everyChar]);
const dbTrimmed = codes([...(trimRows[0].s ?? "")]);
check(`same ${jsTrimmed.split(" ").length} characters trimmed as JavaScript`, jsTrimmed === dbTrimmed,
  `JavaScript: ${jsTrimmed}\n        database:   ${dbTrimmed}`);
await expectValue("inner whitespace kept", `select private.trim_text(${lit(`${WS}a\n\tb${WS}`)}) = ${lit("a\n\tb")}`, true);

console.log("\nVisitor and signed-out calls");
const anyId = "gen_random_uuid()";
const everyCall = [
  `select public.submit_claim(${anyId}, ${MSG})`, `select public.approve_claim(${anyId}, ${NOTE})`,
  `select public.reject_claim(${anyId})`, `select public.cancel_claim(${anyId})`,
  `select * from public.get_claim_contact(${anyId})`, `select public.resolve_report(${anyId})`,
  `select public.close_report(${anyId})`, `select public.admin_hide_report(${anyId}, ${REASON})`,
  `select public.admin_restore_report(${anyId}, ${REASON})`,
  `select public.admin_review_flag(${anyId}, 'dismissed', ${REASON})`,
];
await become(VISITOR);
for (const sql of everyCall) await expectError(`visitor: ${sql.slice(7, 40)}`, sql, DENIED);
await become(NOBODY);
for (const sql of everyCall) await expectError(`no user ID: ${sql.slice(7, 40)}`, sql, "NOT_SIGNED_IN");

console.log("\nTrigger: handle_new_user");
await expectRow("profile from sign-up name", `select full_name from public.profiles where id = '${OWNER}'`, "Owner Person");
// The profile is inserted by an AFTER trigger, so read it in a second step.
async function nameFromSignUp(meta) {
  await actAs(null);
  try {
    const id = await val(`insert into auth.users (id, raw_user_meta_data)
      values (gen_random_uuid(), ${meta === null ? "null" : `'${JSON.stringify(meta)}'`}) returning id`);
    return await val(`select full_name from public.profiles where id = '${id}'`);
  } catch (e) {
    return `error: ${e.message}`;
  }
}
for (const [label, meta, want] of [
  ["name is trimmed", { full_name: "  Spaced Name  " }, "Spaced Name"],
  ["80-character name kept", { full_name: L(80) }, L(80)],
  ["no metadata (dashboard user)", null, "MUET user"],
  ["no full_name key", { other: "x" }, "MUET user"],
  ["name padded with Unicode spaces", { full_name: " Ali Raza　" }, "Ali Raza"],
  ["empty name", { full_name: "" }, "MUET user"],
  ["tabs and newlines only", { full_name: "\t\n\t\n" }, "MUET user"],
  ["1-character name", { full_name: "A" }, "MUET user"],
  ["81-character name", { full_name: L(81) }, "MUET user"],
]) {
  const got = await nameFromSignUp(meta);
  check(`${label} -> ${want.length > 20 ? `${want.length} chars` : want}`, got === want, `got ${got}`);
}

console.log("\nTrigger: set_updated_at");
const touched = await newReport();
await db.exec(`insert into public.item_private_details (item_id, details) values ('${touched}', 'Placeholder detail')`);
const touchedClaim = await newClaim(touched, CLAIMANT);
for (const [table, where] of [
  ["profiles", `id = '${OWNER}'`], ["item_reports", `id = '${touched}'`],
  ["item_private_details", `item_id = '${touched}'`], ["claims", `id = '${touchedClaim}'`],
]) {
  await db.exec(`update public.${table} set updated_at = '2000-01-01' where ${where}`);
  await expectValue(`${table}.updated_at set on update`, `select updated_at > '2001-01-01' from public.${table} where ${where}`, true);
}

console.log("\nTable constraints reject whitespace-only text");
const blankReport = await newReport();
const blankClaim = await newClaim(blankReport, CLAIMANT);
await actAs(null);
for (const [label, sql, constraint] of [
  ["profiles.full_name: tab and newline", `update public.profiles set full_name = ${lit("\t\n")} where id = '${OWNER}'`, "profiles_full_name_length"],
  ["item_reports.title: 2 characters inside newlines and tabs", `update public.item_reports set title = ${lit("\n\nab\t\t")} where id = '${blankReport}'`, "item_reports_title_length"],
  ["item_reports.description: 12 newlines", `update public.item_reports set description = ${lit(L(12, "\n"))} where id = '${blankReport}'`, "item_reports_description_length"],
  ["item_private_details.details: Unicode space and newline", `insert into public.item_private_details (item_id, details) values ('${blankReport}', ${lit("　\n")})`, "item_private_details_details_length"],
  ["claims.message: 10 newlines", `update public.claims set message = ${lit(L(10, "\n"))} where id = '${blankClaim}'`, "claims_message_length"],
  ["claims.handover_note: 5 tabs", `update public.claims set status = 'approved', handover_note = ${lit(L(5, "\t"))} where id = '${blankClaim}'`, "claims_handover_note_length"],
  ["admin_audit_log.reason: newline and tab", `insert into public.admin_audit_log (action, target_type, reason) values ('x', 'y', ${lit("\n\t")})`, "admin_audit_log_reason_length"],
]) {
  await expectError(label, sql, constraint);
}
await expectOk("item_reports.title: 3 characters inside whitespace", `update public.item_reports set title = ${lit(`${WS}abc${WS}`)} where id = '${blankReport}'`);

console.log("\nTrigger: validate_item_report");
const insertAsOwner = (cols = {}) => {
  const base = { report_type: "'lost'", title: "'Trigger test'", description: "'Placeholder description.'",
    category: "'keys'", location_key: "'library'", event_date: TODAY, ...cols };
  const keys = Object.keys(base);
  return `insert into public.item_reports (${keys.join(", ")}) values (${keys.map((k) => base[k]).join(", ")})`;
};
await become(OWNER);
await expectOk("event_date today (Asia/Karachi)", insertAsOwner());
await expectInvalid("event_date tomorrow", insertAsOwner({ event_date: `${TODAY} + 1` }), "event_date");
await expectOk("event_date 365 days ago", insertAsOwner({ event_date: `${TODAY} - 365` }));
await expectInvalid("event_date 366 days ago", insertAsOwner({ event_date: `${TODAY} - 366` }), "event_date");
for (const ext of ["jpg", "png", "webp"]) {
  await expectOk(`image_path own folder, .${ext}`, insertAsOwner({ image_path: `'${OWNER}/${UUID}.${ext}'` }));
}
await expectOk("no image", insertAsOwner({ image_path: "null" }));
for (const [label, path] of [
  ["another user's folder", `${OTHER}/${UUID}.jpg`],
  ["uploaded file name", `${OWNER}/photo.jpg`],
  ["path traversal", `${OWNER}/../${OTHER}/${UUID}.jpg`],
  ["extra prefix", `x${OWNER}/${UUID}.jpg`],
  ["extra suffix", `${OWNER}/${UUID}.jpg.exe`],
  [".jpeg (the app writes .jpg)", `${OWNER}/${UUID}.jpeg`],
  ["upper-case .JPG", `${OWNER}/${UUID}.JPG`],
  [".gif", `${OWNER}/${UUID}.gif`],
  ["no folder", `${UUID}.jpg`],
]) {
  await expectInvalid(`image_path: ${label}`, insertAsOwner({ image_path: `'${path}'` }), "image_path");
}
await expectInvalid("retired location", insertAsOwner({ location_key: "'old_gate'" }), "location_key");
await expectInvalid("unknown location", insertAsOwner({ location_key: "'mars'" }), "location_key");

// A report whose location was retired and whose event_date is now too old.
await actAs(null);
await db.exec(`insert into public.campus_locations (key, label) values ('temp_hall', 'Temporary hall (placeholder)')`);
const oldReport = await val(`insert into public.item_reports
  (user_id, report_type, title, description, category, location_key, event_date)
  values ('${OWNER}', 'found', 'Old report', 'Placeholder description.', 'bag', 'temp_hall', ${TODAY})
  returning id`);
await db.exec(`
  update public.campus_locations set is_active = false where key = 'temp_hall';
  alter table public.item_reports disable trigger validate_item_report;
  update public.item_reports set event_date = ${TODAY} - 400 where id = '${oldReport}';
  alter table public.item_reports enable trigger validate_item_report;
`);
await become(OWNER);
const editOld = (set) => `update public.item_reports set ${set} where id = '${oldReport}'`;
await expectOk("edit description: old date and retired location kept", editOld("description = 'Edited placeholder.'"));
await expectInvalid("change event_date to another old date", editOld(`event_date = ${TODAY} - 399`), "event_date");
await expectInvalid("change to a retired location", editOld("location_key = 'old_gate'"), "location_key");
await expectInvalid("change image to another user's folder", editOld(`image_path = '${OTHER}/${UUID}.jpg'`), "image_path");
await expectOk("change image to own folder", editOld(`image_path = '${OWNER}/${UUID}.webp'`));
await expectOk("remove image", editOld("image_path = null"));
await expectOk("change to an active location", editOld("location_key = 'library'"));
await expectOk("resolve it (status change only)", resolve(oldReport));

console.log("\n8.7 (new) -> pending: submit_claim");
const found = await newReport({ type: "found" });
const lost = await newReport({ type: "lost" });
const closedReport = await newReport({ status: "closed" });
const hiddenReport = await newReport({ status: "hidden" });
await become(OWNER);
await expectError("owner claims own report", submit(found), "OWN_ITEM");
await become(CLAIMANT);
await expectInvalid("message trims to 9 characters", submit(found, `'  ${L(9)}  '`), "message");
await expectInvalid("message 1001 characters", submit(found, `'${L(1001)}'`), "message");
await expectInvalid("message missing", submit(found, "null"), "message");
await expectInvalid("message of 10 newlines", submit(found, lit(L(10, "\n"))), "message");
await expectInvalid("message of tabs and Unicode spaces", submit(found, lit(WS.repeat(2))), "message");
await expectError("unknown report", submit("00000000-0000-0000-0000-00000000dead"), "NOT_FOUND");
await expectError("closed report it can't see", submit(closedReport), "NOT_FOUND");
await expectError("hidden report it can't see", submit(hiddenReport), "NOT_FOUND");
const c1 = await val(submit(found, lit(`${WS}${MSG.slice(1, -1)}${WS}`)));
await expectRow("claimant claims found report -> pending ownership, message trimmed",
  `select status || ' ' || claim_type || ' ' || (message = ${MSG}) from public.claims where id = '${c1}'`, "pending ownership true");
await become(CLAIMANT);
await expectError("second open claim on the same report", submit(found), "DUPLICATE_CLAIM");
await become(OTHER);
const lostClaim = await val(submit(lost));
await expectRow("other user responds to lost report -> found_match",
  `select claim_type from public.claims where id = '${lostClaim}'`, "found_match");
await become(ADMIN);
await expectError("admin (can see it) claims closed report", submit(closedReport), "ITEM_NOT_ACTIVE");
await expectError("admin claims hidden report", submit(hiddenReport), "ITEM_NOT_ACTIVE");
await become(CLAIMANT2);
const c2 = await val(submit(found));

console.log("\n8.7 pending -> approved: approve_claim");
await become(CLAIMANT);
await expectError("claimant approves own claim", approve(c1), "NOT_ALLOWED");
await become(CLAIMANT2);
await expectError("another claimant on the same report", approve(c1), "NOT_FOUND");
await become(OTHER);
await expectError("other user", approve(c1), "NOT_FOUND");
await become(OWNER);
await expectError("unknown claim", approve("00000000-0000-0000-0000-00000000dead"), "NOT_FOUND");
await expectInvalid("handover note 4 characters", approve(c1, "'  abcd  '"), "handover_note");
await expectInvalid("handover note 501 characters", approve(c1, `'${L(501)}'`), "handover_note");
await expectInvalid("handover note missing", approve(c1, "null"), "handover_note");
await expectInvalid("handover note of 5 tabs", approve(c1, lit(L(5, "\t"))), "handover_note");
await expectInvalid("handover note of newlines and Unicode spaces", approve(c1, lit("\n　\n \n ")), "handover_note");
await expectOk("owner approves", approve(c1, lit(`${WS}${NOTE.slice(1, -1)}${WS}`)));
await expectRow("  -> approved, note trimmed, reviewed by owner",
  `select status || ' ' || (handover_note = ${NOTE}) || ' ' || (reviewed_by = '${OWNER}') || ' ' || (reviewed_at is not null)
   from public.claims where id = '${c1}'`, "approved true true true");
await become(OWNER);
await expectError("approve a second claim on the report", approve(c2), "ALREADY_APPROVED");
await expectError("approve the approved claim again", approve(c1), "INVALID_STATUS");

console.log("\nget_claim_contact");
await become(CLAIMANT);
await expectValue("claimant sees the owner", contact(c1), "Owner Person <owner@example.test>");
await become(OWNER);
await expectValue("owner sees the claimant", contact(c1), "Claimant Person <claimant@example.test>");
await expectError("owner, pending claim", contact(c2), "NOT_ALLOWED");
await become(CLAIMANT2);
await expectError("claimant, pending claim", contact(c2), "NOT_ALLOWED");
await expectError("another claimant on the report", contact(c1), "NOT_FOUND");
await become(ADMIN);
await expectError("admin", contact(c1), "NOT_ALLOWED");
await become(OTHER);
await expectError("other user", contact(c1), "NOT_FOUND");

console.log("\n8.7 approved -> rejected, pending -> rejected: reject_claim");
await become(CLAIMANT);
await expectError("claimant rejects own claim", reject(c1), "NOT_ALLOWED");
await become(OTHER);
await expectError("other user", reject(c1), "NOT_FOUND");
await become(OWNER);
await expectOk("owner rejects approved claim (report active)", reject(c1));
await expectRow("  -> rejected, reviewed by owner",
  `select status || ' ' || (reviewed_by = '${OWNER}') from public.claims where id = '${c1}'`, "rejected true");
await become(OWNER);
await expectError("reject the rejected claim", reject(c1), "INVALID_STATUS");
await become(CLAIMANT);
await expectError("contact after rejection", contact(c1), "NOT_ALLOWED");
await become(ADMIN);
await expectOk("admin approves another claim once the first is rejected", approve(c2));
await expectRow("  -> reviewed by admin", `select reviewed_by from public.claims where id = '${c2}'`, ADMIN);
await become(CLAIMANT);
const c3 = await val(submit(found));
check("claimant can claim again after rejection", typeof c3 === "string", `got ${c3}`);
await become(ADMIN);
await expectOk("admin rejects a pending claim", reject(c3));
await expectRow("  -> rejected", statusOf("claims", c3), "rejected");

console.log("\nAn admin can't review their own claim");
await become(ADMIN);
const adminClaim = await val(submit(found));
await expectError("admin approves own claim", approve(adminClaim), "NOT_ALLOWED");
await expectError("admin rejects own claim", reject(adminClaim), "NOT_ALLOWED");

console.log("\n8.7 pending, approved -> cancelled: cancel_claim");
await become(OWNER);
await expectError("owner cancels a claim", cancel(adminClaim), "NOT_ALLOWED");
await become(OTHER);
await expectError("other user", cancel(adminClaim), "NOT_FOUND");
await become(ADMIN);
await expectOk("claimant (here an admin) cancels pending claim", cancel(adminClaim));
await expectRow("  -> cancelled", statusOf("claims", adminClaim), "cancelled");
await become(ADMIN);
await expectError("cancel the cancelled claim", cancel(adminClaim), "INVALID_STATUS");
await expectError("admin cancels someone else's claim", cancel(c2), "NOT_ALLOWED");
// Approved -> cancelled, on the lost report.
await become(OWNER);
await expectOk("owner approves the lost-report response", approve(lostClaim));
await become(OTHER);
await expectOk("claimant cancels approved claim (report active)", cancel(lostClaim));
await expectRow("  -> cancelled", statusOf("claims", lostClaim), "cancelled");
await become(OTHER);
await expectError("contact after cancelling", contact(lostClaim), "NOT_ALLOWED");

console.log("\n8.6 active -> resolved: resolve_report (8.7 pending -> closed)");
await become(OTHER);
const otherPending = await val(submit(found));
await become(CLAIMANT);
await expectError("claimant resolves owner's report", resolve(found), "NOT_ALLOWED");
await become(OTHER);
await expectError("other user resolves owner's report", resolve(found), "NOT_ALLOWED");
await become(OWNER);
await expectError("unknown report", resolve("00000000-0000-0000-0000-00000000dead"), "NOT_FOUND");
await expectOk("owner resolves", resolve(found));
await expectRow("  -> resolved with resolved_at",
  `select status || ' ' || (resolved_at is not null) from public.item_reports where id = '${found}'`, "resolved true");
await expectRow("  -> pending claim closed", statusOf("claims", otherPending), "closed");
await expectRow("  -> approved claim stays approved", statusOf("claims", c2), "approved");
await become(OWNER);
await expectError("resolve again", resolve(found), "INVALID_STATUS");
await expectError("close a resolved report", close(found), "INVALID_STATUS");
await become(OTHER);
await expectError("other user (claim closed, can't see it)", resolve(found), "NOT_FOUND");
await become(CLAIMANT2);
await expectValue("approved claimant still sees the contact", contact(c2), "Owner Person <owner@example.test>");
await expectError("claim on a resolved report it can see", submit(found), "ITEM_NOT_ACTIVE");
await expectError("cancel approved claim after resolve", cancel(c2), "ITEM_NOT_ACTIVE");
await become(OWNER);
await expectError("reject approved claim after resolve", reject(c2), "ITEM_NOT_ACTIVE");
await expectError("approve a closed claim on a resolved report", approve(otherPending), "ITEM_NOT_ACTIVE");
await become(ADMIN);
await expectError("hide a resolved report", hide(found), "INVALID_STATUS");

console.log("\n8.6 active -> closed: close_report (8.7 pending, approved -> closed)");
const toClose = await newReport({ type: "lost" });
const closeApproved = await newClaim(toClose, CLAIMANT, "approved");
const closePending = await newClaim(toClose, CLAIMANT2);
await become(OTHER);
await expectError("other user closes owner's report", close(toClose), "NOT_ALLOWED");
await become(CLAIMANT);
await expectError("claimant closes owner's report", close(toClose), "NOT_ALLOWED");
await become(ADMIN);
await expectOk("admin closes someone else's report", close(toClose));
await expectRow("  -> closed, no resolved_at",
  `select status || ' ' || (resolved_at is null) from public.item_reports where id = '${toClose}'`, "closed true");
await expectRow("  -> approved claim closed", statusOf("claims", closeApproved), "closed");
await expectRow("  -> pending claim closed", statusOf("claims", closePending), "closed");
await become(OWNER);
await expectError("close again", close(toClose), "INVALID_STATUS");
await expectError("resolve a closed report", resolve(toClose), "INVALID_STATUS");
await become(CLAIMANT);
await expectError("claimant cancels the closed claim", cancel(closeApproved), "INVALID_STATUS");
await expectError("contact after close", contact(closeApproved), "NOT_ALLOWED");
const ownClose = await newReport();
await become(OWNER);
await expectOk("owner closes own report", close(ownClose));

console.log("\n8.6 active -> hidden: admin_hide_report (8.7 pending, approved -> closed)");
const toHide = await newReport();
const hidePending = await newClaim(toHide, CLAIMANT);
const hideApproved = await newClaim(toHide, CLAIMANT2, "approved");
await become(OWNER);
await expectError("owner hides own report", hide(toHide), "NOT_ALLOWED");
await become(OTHER);
await expectError("non-admin, unknown report (no probing)", hide("00000000-0000-0000-0000-00000000dead"), "NOT_ALLOWED");
await become(ADMIN);
await expectInvalid("reason empty", hide(toHide, "''"), "reason");
await expectInvalid("reason whitespace only", hide(toHide, "'   '"), "reason");
await expectInvalid("reason 501 characters", hide(toHide, `'${L(501)}'`), "reason");
await expectInvalid("reason missing", hide(toHide, "null"), "reason");
await expectInvalid("reason of newlines and tabs", hide(toHide, lit("\n\t\n")), "reason");
await expectError("unknown report", hide("00000000-0000-0000-0000-00000000dead"), "NOT_FOUND");
await expectOk("admin hides (500-character reason, padded)", hide(toHide, `'  ${L(500)}  '`));
await expectRow("  -> hidden", statusOf("item_reports", toHide), "hidden");
await expectRow("  -> pending claim closed", statusOf("claims", hidePending), "closed");
await expectRow("  -> approved claim closed", statusOf("claims", hideApproved), "closed");
await expectRow("  -> audit row", `select action || ' ' || target_type || ' ' || (admin_id = '${ADMIN}') || ' ' || char_length(reason)
  from public.admin_audit_log where target_id = '${toHide}'`, "hide_report item_report true 500");
await become(ADMIN);
await expectError("hide again", hide(toHide), "INVALID_STATUS");
await expectError("hide a closed report", hide(toClose), "INVALID_STATUS");
await become(OWNER);
await expectError("owner resolves own hidden report", resolve(toHide), "INVALID_STATUS");
await expectError("owner closes own hidden report", close(toHide), "INVALID_STATUS");
await become(CLAIMANT);
await expectError("claimant (claim closed, can't see it) resolves", resolve(toHide), "NOT_FOUND");
await expectError("claimant claims the hidden report", submit(toHide), "NOT_FOUND");

console.log("\n8.6 hidden -> active: admin_restore_report");
await become(OWNER);
await expectError("owner restores own report", restore(toHide), "NOT_ALLOWED");
await become(ADMIN);
await expectInvalid("reason missing", restore(toHide, "null"), "reason");
await expectError("unknown report", restore("00000000-0000-0000-0000-00000000dead"), "NOT_FOUND");
await expectError("restore an active report", restore(lost), "INVALID_STATUS");
await expectError("restore a resolved report", restore(found), "INVALID_STATUS");
await expectOk("admin restores", restore(toHide, `'  ${REASON.slice(1, -1)}  '`));
await expectRow("  -> active", statusOf("item_reports", toHide), "active");
await expectRow("  -> claims not reopened", `select string_agg(status, ',') from public.claims where item_id = '${toHide}'`, "closed,closed");
await expectRow("  -> audit row, reason trimmed", `select action || ': ' || reason from public.admin_audit_log
  where target_id = '${toHide}' and action = 'restore_report'`, `restore_report: ${REASON.slice(1, -1)}`);
await become(CLAIMANT);
const afterRestore = await val(submit(toHide));
check("claimant can claim the restored report again", typeof afterRestore === "string", `got ${afterRestore}`);

console.log("\nadmin_review_flag");
const flagged = await newReport();
await actAs(null);
const flag = async (reporter) => val(`insert into public.abuse_reports (item_id, reporter_id, reason)
  values ('${flagged}', '${reporter}', 'scam') returning id`);
const f1 = await flag(OTHER), f2 = await flag(CLAIMANT), f3 = await flag(CLAIMANT2), f4 = await flag(OWNER);
await become(OWNER);
await expectError("non-admin reviews a flag", review(f1, "'dismissed'"), "NOT_ALLOWED");
await become(ADMIN);
for (const bad of ["'open'", "'closed'", "null"]) {
  await expectInvalid(`status ${bad}`, review(f1, bad), "status");
}
await expectInvalid("reason empty", review(f1, "'reviewing'", "''"), "reason");
await expectInvalid("reason of Unicode spaces", review(f1, "'reviewing'", lit(" 　﻿")), "reason");
await expectError("unknown flag", review("00000000-0000-0000-0000-00000000dead", "'dismissed'"), "NOT_FOUND");
for (const [label, id, to, want] of [
  ["open -> reviewing", f1, "reviewing", "ok"],
  ["reviewing -> reviewing", f1, "reviewing", "INVALID_STATUS"],
  ["reviewing -> actioned", f1, "actioned", "ok"],
  ["actioned -> dismissed", f1, "dismissed", "INVALID_STATUS"],
  ["actioned -> reviewing", f1, "reviewing", "INVALID_STATUS"],
  ["open -> dismissed", f2, "dismissed", "ok"],
  ["dismissed -> actioned", f2, "actioned", "INVALID_STATUS"],
  ["open -> actioned", f3, "actioned", "ok"],
  ["open -> reviewing", f4, "reviewing", "ok"],
  ["reviewing -> dismissed", f4, "dismissed", "ok"],
]) {
  await become(ADMIN);
  if (want === "ok") await expectOk(label, review(id, `'${to}'`));
  else await expectError(label, review(id, `'${to}'`), want);
}
await expectRow("final flag statuses",
  `select string_agg(status, ',' order by reporter_id) from public.abuse_reports where item_id = '${flagged}'`,
  "dismissed,actioned,dismissed,actioned");
await expectRow("  -> reviewed by admin", `select bool_and(reviewed_by = '${ADMIN}') from public.abuse_reports where item_id = '${flagged}'`, true);
await expectRow("  -> one audit row per review",
  `select count(*) from public.admin_audit_log where action = 'review_flag' and target_type = 'abuse_report'`, 6);

console.log("\nadmin_audit_log.reason constraint");
await actAs(null);
await expectError("empty reason", `insert into public.admin_audit_log (action, target_type, reason) values ('x', 'y', ' ')`, "admin_audit_log_reason_length");
await expectError("501-character reason", `insert into public.admin_audit_log (action, target_type, reason) values ('x', 'y', '${L(501)}')`, "admin_audit_log_reason_length");

finish();
