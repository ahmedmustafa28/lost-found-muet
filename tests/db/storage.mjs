// Checks the storage migration: the item-images bucket settings, and each
// storage policy as visitor, report owner, other user, claimant and admin.
// Usage: npm run test:db
//
// Uses a stand-in for Supabase's storage schema (see harness.mjs). The 5 MB
// and file type limits are enforced by the Storage service, so these tests
// can check the bucket settings but not the limits themselves.
import { setup } from "./harness.mjs";

const { db, check, expectOk, expectError, expectValue, actAs, finish } = await setup();

const OWNER = "00000000-0000-0000-0000-000000000001";
const OTHER = "00000000-0000-0000-0000-000000000002";
const CLAIMANT = "00000000-0000-0000-0000-000000000003"; // approved claim on the resolved report
const ADMIN = "00000000-0000-0000-0000-000000000004";
const CLAIMANT2 = "00000000-0000-0000-0000-000000000005"; // rejected claim on the closed report
const VISITOR = "visitor";
const RLS = "row-level security";
const uuid = (n) => `aaaaaaaa-aaaa-4aaa-8aaa-${String(n).padStart(12, "0")}`;

// One image per case, keyed by a short label for readable results.
const IMAGES = {
  active: `${OWNER}/${uuid(1)}.jpg`,
  resolved: `${OWNER}/${uuid(2)}.png`,
  closed: `${OWNER}/${uuid(3)}.webp`,
  hidden: `${OWNER}/${uuid(4)}.jpg`,
  unattached: `${OWNER}/${uuid(5)}.jpg`,
  otherActive: `${OTHER}/${uuid(6)}.jpg`,
};
const labelOf = Object.fromEntries(Object.entries(IMAGES).map(([label, name]) => [name, label]));

await db.exec(`
  insert into auth.users (id, raw_user_meta_data) values
    ('${OWNER}', '{"full_name": "Owner Person"}'), ('${OTHER}', '{"full_name": "Other Person"}'),
    ('${CLAIMANT}', '{"full_name": "Claimant Person"}'), ('${ADMIN}', '{"full_name": "Admin Person"}'),
    ('${CLAIMANT2}', '{"full_name": "Second Claimant"}');
  insert into public.admins (user_id) values ('${ADMIN}');
  insert into public.campus_locations (key, label) values ('library', 'Library (placeholder)');
  insert into storage.buckets (id, name) values ('other-bucket', 'other-bucket');
`);
async function report(owner, status, image) {
  const { rows } = await db.query(`insert into public.item_reports
    (user_id, report_type, title, description, category, location_key, event_date, status, image_path)
    values ('${owner}', 'found', 'Report ${status}', 'Placeholder description.', 'wallet', 'library',
      current_date, '${status}', '${image}') returning id`);
  return rows[0].id;
}
await report(OWNER, "active", IMAGES.active);
const resolved = await report(OWNER, "resolved", IMAGES.resolved);
const closed = await report(OWNER, "closed", IMAGES.closed);
await report(OWNER, "hidden", IMAGES.hidden);
await report(OTHER, "active", IMAGES.otherActive);
await db.exec(`
  insert into public.claims (item_id, claimant_id, claim_type, message, status, handover_note) values
    ('${resolved}', '${CLAIMANT}', 'ownership', 'Placeholder claim message.', 'approved', 'Library entrance, Monday 2 pm'),
    ('${closed}', '${CLAIMANT2}', 'ownership', 'Placeholder claim message.', 'rejected', null);
  insert into storage.objects (bucket_id, name, owner_id)
    select 'item-images', name, split_part(name, '/', 1) from unnest(array[${Object.values(IMAGES).map((n) => `'${n}'`).join(", ")}]) as name;
  -- Same folder, different bucket: no item-images policy applies to it.
  insert into storage.objects (bucket_id, name, owner_id) values ('other-bucket', '${IMAGES.unattached}', '${OWNER}');
`);

async function become(userId) {
  if (userId === VISITOR) await actAs("anon");
  else await actAs("authenticated", userId);
}
async function expectVisible(name, expected) {
  const { rows } = await db.query("select bucket_id, name from storage.objects");
  const got = rows.map((r) => (r.bucket_id === "item-images" ? labelOf[r.name] : `${r.bucket_id}:${r.name}`)).sort();
  const want = [...expected].sort();
  check(`${name} = ${want.join(", ") || "(none)"}`, JSON.stringify(got) === JSON.stringify(want), `got ${got.join(", ") || "(none)"}`);
}
const changed = (sql) => `with u as (${sql} returning 1) select count(*) from u`;
const upload = (name, bucket = "item-images") =>
  `insert into storage.objects (bucket_id, name) values ('${bucket}', '${name}')`;

console.log("\nBucket and policies (catalog)");
await expectValue("item-images bucket: public, size limit, types",
  "select public || ' ' || file_size_limit || ' ' || allowed_mime_types::text from storage.buckets where id = 'item-images'",
  "false 5242880 {image/jpeg,image/png,image/webp}");
await expectValue("policies on storage.objects",
  "select string_agg(policyname || ' ' || cmd, ', ' order by policyname) from pg_policies where schemaname = 'storage' and tablename = 'objects'",
  "item_images_delete_own_unattached DELETE, item_images_insert_own_folder INSERT, item_images_select_own_folder SELECT, item_images_select_visible_report SELECT");
await expectValue("index on item_reports.image_path",
  "select indexdef like '%(image_path) WHERE (image_path IS NOT NULL)' from pg_indexes where indexname = 'item_reports_image_path_idx'", true);

console.log("\nReads");
await become(VISITOR);
await expectVisible("visitor sees", ["active", "otherActive"]);
await become(OWNER);
await expectVisible("owner sees", ["active", "resolved", "closed", "hidden", "unattached", "otherActive"]);
await become(OTHER);
await expectVisible("other user sees", ["active", "otherActive"]);
await become(CLAIMANT);
await expectVisible("claimant with approved claim sees", ["active", "resolved", "otherActive"]);
await become(CLAIMANT2);
await expectVisible("claimant with rejected claim sees", ["active", "otherActive"]);
await become(ADMIN);
// All report images, but not an unattached file in someone else's folder.
await expectVisible("admin sees", ["active", "resolved", "closed", "hidden", "otherActive"]);

console.log("\nUploads");
await become(VISITOR);
await expectError("visitor uploads", upload(`${OWNER}/${uuid(10)}.jpg`), RLS);
await become(OWNER);
for (const ext of ["jpg", "png", "webp"]) {
  await expectOk(`owner uploads .${ext} to own folder`, upload(`${OWNER}/${uuid(10)}.${ext}`));
}
for (const [label, name] of [
  ["another user's folder", `${OTHER}/${uuid(11)}.jpg`],
  ["a subfolder", `${OWNER}/sub/${uuid(11)}.jpg`],
  ["uploaded file name", `${OWNER}/photo.jpg`],
  ["path traversal", `${OWNER}/../${OTHER}/${uuid(11)}.jpg`],
  ["no folder", `${uuid(11)}.jpg`],
  [".jpeg (the app writes .jpg)", `${OWNER}/${uuid(11)}.jpeg`],
  ["upper-case .JPG", `${OWNER}/${uuid(11)}.JPG`],
  [".gif", `${OWNER}/${uuid(11)}.gif`],
  [".html", `${OWNER}/${uuid(11)}.html`],
]) {
  await expectError(`owner uploads: ${label}`, upload(name), RLS);
}
await expectError("owner uploads to another bucket", upload(`${OWNER}/${uuid(12)}.jpg`, "other-bucket"), RLS);
await become(OTHER);
await expectError("other user uploads into owner's folder", upload(`${OWNER}/${uuid(13)}.jpg`), RLS);

console.log("\nUpdates (no policy: files can't be overwritten or moved)");
await become(OWNER);
await expectValue("owner renames own file", changed(`update storage.objects set name = '${OWNER}/${uuid(20)}.jpg' where name = '${IMAGES.unattached}'`), 0);
await expectValue("owner moves own file to another user's folder", changed(`update storage.objects set name = '${OTHER}/${uuid(20)}.jpg' where name = '${IMAGES.active}'`), 0);
await become(ADMIN);
await expectValue("admin renames a file", changed(`update storage.objects set name = '${ADMIN}/${uuid(20)}.jpg' where name = '${IMAGES.active}'`), 0);

console.log("\nDeletes");
await become(VISITOR);
await expectValue("visitor deletes an active report's image", changed(`delete from storage.objects where name = '${IMAGES.active}'`), 0);
await become(OTHER);
await expectValue("other user deletes owner's image", changed(`delete from storage.objects where name = '${IMAGES.active}'`), 0);
await become(CLAIMANT);
await expectValue("claimant deletes the image it can see", changed(`delete from storage.objects where name = '${IMAGES.resolved}'`), 0);
await become(ADMIN);
await expectValue("admin deletes owner's image", changed(`delete from storage.objects where name = '${IMAGES.hidden}'`), 0);
await become(OWNER);
await expectValue("owner deletes own file in another bucket", changed(`delete from storage.objects where bucket_id = 'other-bucket'`), 0);
await expectValue("owner deletes own unattached file", changed(`delete from storage.objects where name = '${IMAGES.unattached}'`), 1);
for (const label of ["active", "resolved", "closed", "hidden"]) {
  await expectValue(`owner deletes own ${label} report's image`, changed(`delete from storage.objects where name = '${IMAGES[label]}'`), 0);
}
await become(OTHER);
await expectValue("other user deletes own active report's image", changed(`delete from storage.objects where name = '${IMAGES.otherActive}'`), 0);

console.log("\nSwapping an attached image (blocked once the report has ended or is hidden)");
await become(OWNER);
for (const label of ["resolved", "closed", "hidden"]) {
  await expectValue(`owner detaches the ${label} report's image`, changed(`update public.item_reports set image_path = null where image_path = '${IMAGES[label]}'`), 0);
  await expectValue(`owner then deletes the ${label} report's image`, changed(`delete from storage.objects where name = '${IMAGES[label]}'`), 0);
}
await expectError("owner uploads again under the hidden report's image name", upload(IMAGES.hidden), RLS);
// A report whose image_path names a file that was never uploaded.
await actAs(null);
const missing = { hidden: `${OWNER}/${uuid(30)}.jpg`, resolved: `${OWNER}/${uuid(31)}.jpg`, active: `${OWNER}/${uuid(32)}.jpg` };
for (const [status, name] of Object.entries(missing)) await report(OWNER, status, name);
await become(OWNER);
for (const [status, name] of Object.entries(missing)) {
  await expectError(`owner uploads the missing image of the ${status} report`, upload(name), RLS);
}

console.log("\nChanging and removing an image (active report: update image_path first)");
const replacement = `${OWNER}/${uuid(10)}.jpg`; // uploaded above
await expectValue("owner points the active report to a new file", changed(`update public.item_reports set image_path = '${replacement}' where image_path = '${IMAGES.active}'`), 1);
await expectValue("owner deletes the old file", changed(`delete from storage.objects where name = '${IMAGES.active}'`), 1);
await expectValue("owner deletes the new file while attached", changed(`delete from storage.objects where name = '${replacement}'`), 0);
await expectValue("owner removes the active report's image", changed(`update public.item_reports set image_path = null where image_path = '${replacement}'`), 1);
await expectValue("owner deletes the removed file", changed(`delete from storage.objects where name = '${replacement}'`), 1);

// Accepted for the MVP (DEVELOPMENT.md 11.1): a flag doesn't change the
// report, so its owner can still edit it, image included. Locking edits while
// a flag is open would let anyone freeze a report by flagging it.
console.log("\nFlagged active report (owner can still change the image)");
const flaggedImage = `${OWNER}/${uuid(10)}.png`; // uploaded above
await actAs(null);
const flagged = await report(OWNER, "active", flaggedImage);
await become(OTHER);
await expectOk("other user flags the report", `insert into public.abuse_reports (item_id, reason) values ('${flagged}', 'offensive')`);
await become(OWNER);
await expectValue("owner detaches the flagged report's image", changed(`update public.item_reports set image_path = null where id = '${flagged}'`), 1);
await expectValue("owner deletes the flagged report's image", changed(`delete from storage.objects where name = '${flaggedImage}'`), 1);

await actAs(null);
// 6 fixture images, plus the owner's 3 uploads, minus the 4 deletes.
await expectValue("files left in item-images",
  "select count(*) from storage.objects where bucket_id = 'item-images'", 5);
finish();
