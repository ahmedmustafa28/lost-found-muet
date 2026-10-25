// Checks the restrict_signup_domain migration: the sign-up hook, who can run
// it, the email-change trigger on auth.users, and that the database and the
// app use the identical student email pattern.
// Usage: npm run test:db
//
// Node runs src/lib/constants.ts directly (type stripping), so the app's
// pattern is tested as written.
import { isDeepStrictEqual } from "node:util";
import { setup } from "./harness.mjs";
import { STUDENT_EMAIL_PATTERN, STUDENT_EMAIL_MESSAGE } from "../../src/lib/constants.ts";

const { db, check, expectOk, expectError, expectValue, actAs, finish } = await setup();

const ACCEPTED = ["23sw016", "19ce01", "22tele123"].flatMap((roll) => {
  const email = `${roll}@students.muet.edu.pk`;
  return [email, email.toUpperCase(), `${roll.toUpperCase()}@Students.Muet.Edu.Pk`];
});
const REJECTED = [
  "23sw016@muet.edu.pk",
  "23sw016@fake.students.muet.edu.pk",
  "23sw016@students.muet.edu.pk.evil.com",
  "ali.khan@students.muet.edu.pk",
  "ali.khan@muet.edu.pk",
  "admissions@muet.edu.pk",
  "19ce01@gmail.com",
  "19ce01@fakemuet.edu.pk",
  "19ce01@muet.edu.pk.evil.com",
];
const REJECTION = { error: { http_code: 403, message: STUDENT_EMAIL_MESSAGE } };
const sqlText = (s) => `'${s.replaceAll("'", "''")}'`;
const hook = async (user) => {
  const event = { metadata: { name: "before-user-created" }, user };
  const { rows } = await db.query("select public.restrict_signup_domain($1::jsonb) as result", [JSON.stringify(event)]);
  return rows[0].result;
};

console.log("\nSame pattern in the app and the database");
await expectValue("private.student_email_pattern() equals STUDENT_EMAIL_PATTERN",
  `select private.student_email_pattern() = ${sqlText(STUDENT_EMAIL_PATTERN)}`, true);
const appPattern = new RegExp(STUDENT_EMAIL_PATTERN, "i");
for (const email of ACCEPTED) check(`app accepts ${email}`, appPattern.test(email), "rejected");
for (const email of REJECTED) check(`app rejects ${email}`, !appPattern.test(email), "accepted");

console.log("\nSign-up hook");
for (const email of ACCEPTED) {
  const result = await hook({ email });
  check(`hook allows ${email}`, isDeepStrictEqual(result, {}), `got ${JSON.stringify(result)}`);
}
for (const [label, user] of [
  ...REJECTED.map((email) => [email, { email }]),
  ["a missing email", { phone: "923001234567" }],
  ["a null email", { email: null }],
  ["an empty email", { email: "" }],
  ["no user at all", undefined],
]) {
  const result = await hook(user);
  check(`hook rejects ${label}`, isDeepStrictEqual(result, REJECTION), `got ${JSON.stringify(result)}`);
}

console.log("\nWho can run the hook");
await db.exec("create role some_other_role nologin"); // has only what public has
for (const [role, expected] of [["supabase_auth_admin", true], ["anon", false], ["authenticated", false], ["some_other_role", false]]) {
  await expectValue(`${role} can execute the hook`,
    `select has_function_privilege('${role}', 'public.restrict_signup_domain(jsonb)', 'execute')`, expected);
}
await expectValue("supabase_auth_admin can read the pattern",
  "select has_function_privilege('supabase_auth_admin', 'private.student_email_pattern()', 'execute')", true);
for (const role of ["anon", "authenticated", "some_other_role"]) {
  await expectValue(`${role} can read the pattern`,
    `select has_function_privilege('${role}', 'private.student_email_pattern()', 'execute')`, false);
}
await actAs("authenticated", "00000000-0000-0000-0000-000000000001");
await expectError("signed-in user calls the hook", "select public.restrict_signup_domain('{}'::jsonb)", "permission denied");
await actAs("anon");
await expectError("visitor calls the hook", "select public.restrict_signup_domain('{}'::jsonb)", "permission denied");
await actAs("supabase_auth_admin");
await expectValue("Supabase Auth calls the hook",
  `select public.restrict_signup_domain('{"user": {"email": "19ce01@students.muet.edu.pk"}}'::jsonb)::text`, "{}");

console.log("\nEmail changes on auth.users (as Supabase Auth)");
const STUDENT = "00000000-0000-0000-0000-000000000001";
const DASHBOARD_USER = "00000000-0000-0000-0000-000000000002"; // added by hand, not a student email
await actAs(null);
await db.exec(`insert into auth.users (id, email, raw_user_meta_data) values
  ('${STUDENT}', '19ce01@students.muet.edu.pk', '{"full_name": "Student Person"}'),
  ('${DASHBOARD_USER}', 'helper@example.com', '{"full_name": "Dashboard Person"}');`);
await actAs("supabase_auth_admin");
const updateUser = (id, set) => `update auth.users set ${set} where id = '${id}'`;
await expectOk("sign-in updates last_sign_in_at", updateUser(STUDENT, "last_sign_in_at = now()"));
await expectOk("sign-in updates last_sign_in_at (non-student email)", updateUser(DASHBOARD_USER, "last_sign_in_at = now()"));
await expectOk("update that rewrites email unchanged (non-student email)",
  updateUser(DASHBOARD_USER, "email = email, email_change = email_change, last_sign_in_at = now()"));
await expectOk("other metadata update (non-student email)",
  updateUser(DASHBOARD_USER, `raw_user_meta_data = '{"full_name": "Renamed Person"}'`));
await expectError("request a change to a gmail address", updateUser(STUDENT, "email_change = '19ce01@gmail.com'"), "INVALID_INPUT");
await expectError("request a change to a look-alike domain", updateUser(STUDENT, "email_change = '19ce01@students.muet.edu.pk.evil.com'"), "INVALID_INPUT");
await expectError("request a change to the old muet.edu.pk domain", updateUser(STUDENT, "email_change = '23sw016@muet.edu.pk'"), "INVALID_INPUT");
await expectError("set email to a non-student address", updateUser(STUDENT, "email = 'admissions@students.muet.edu.pk'"), "INVALID_INPUT");
await expectError("non-student account moves to another non-student address",
  updateUser(DASHBOARD_USER, "email = 'other@example.com'"), "INVALID_INPUT");
await expectOk("request a change to another student email", updateUser(STUDENT, "email_change = '23SW016@Students.Muet.Edu.Pk'"));
await expectOk("confirm it: email set, email_change cleared",
  updateUser(STUDENT, "email = email_change, email_change = ''"));
await expectValue("email after the change", `select email from auth.users where id = '${STUDENT}'`, "23SW016@Students.Muet.Edu.Pk");
await expectOk("clear email_change to null", updateUser(STUDENT, "email_change = null"));

finish();
