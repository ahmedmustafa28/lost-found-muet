// Checks the seed_campus_locations migration (DEVELOPMENT.md D-16): the list,
// its order, and that it works with the location rules for reports.
// Usage: npm run test:db
import { setup } from "./harness.mjs";

const { db, check, expectOk, expectValue, actAs, finish } = await setup({ keepSeededLocations: true });

const EXPECTED = [
  "library", "stc", "cafeteria", "sports_grounds", "gym", "university_bus",
  "main_gate", "mosque", "admin_block", "muistd",
  "dept_architecture", "dept_biomedical", "dept_chemical", "dept_city_regional_planning",
  "dept_civil", "dept_computer_systems", "dept_electrical", "dept_electronic",
  "dept_environmental", "dept_industrial_management", "dept_mechanical", "dept_mechatronics",
  "dept_metallurgy_materials", "dept_mining", "dept_petroleum_gas", "dept_software",
  "dept_telecommunication", "dept_textile",
  "hostel_sachal_sarmast", "hostel_abdul_qadeer_khan", "hostel_hisamuddin_rashidi",
  "hostel_abdul_majeed_sindhi", "hostel_hyder_bux_jatoi", "hostel_gm_syed",
  "hostel_elsa_kazi", "hostel_benazir_bhutto", "hostel_bakhtawar",
  "other",
];

console.log("\nSeeded list");
const { rows } = await db.query("select key, label, sort_order, is_active from public.campus_locations order by sort_order");
check(`${EXPECTED.length} locations, in the agreed order`,
  JSON.stringify(rows.map((r) => r.key)) === JSON.stringify(EXPECTED),
  `got ${rows.map((r) => r.key).join(", ")}`);
check("sort_order values are unique",
  new Set(rows.map((r) => r.sort_order)).size === rows.length, "duplicate sort_order");
check("all active", rows.every((r) => r.is_active), "an inactive row");
check("keys are lowercase letters, digits and underscores",
  rows.every((r) => /^[a-z][a-z0-9_]*$/.test(r.key)), "a key with other characters");
check("labels have no leading or trailing spaces",
  rows.every((r) => r.label === r.label.trim() && r.label.length > 0), "a blank or padded label");
check("Other is last", rows.at(-1)?.key === "other" && rows.at(-1)?.label === "Other", "Other isn't last");

console.log("\nVisible through the API");
await actAs("anon");
await expectValue("visitor sees all seeded locations", "select count(*) from public.campus_locations", EXPECTED.length);

console.log("\nUsable by a report");
const USER = "00000000-0000-0000-0000-000000000001";
await actAs(null);
await db.exec(`insert into auth.users (id) values ('${USER}')`);
await actAs("authenticated", USER);
await expectOk("report at a seeded location",
  `insert into public.item_reports (report_type, title, description, category, location_key, event_date)
   values ('lost', 'Black umbrella', 'Left near the main entrance.', 'other', 'main_gate', current_date)`);

finish();
