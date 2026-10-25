// Checks that a Supabase project's "before user created" hook is on
// (DEVELOPMENT.md 10.1 and 19). The register form rejects non-student emails
// itself, so testing through the form never reaches the hook; this sends the
// sign-up straight to the Supabase Auth API instead.
//
// Usage:
//   node --env-file=.env.local scripts/check-signup-hook.mjs <email>
//
// Use an email that has no account yet. For an existing account Supabase
// replies as if the sign-up worked, whatever the hook would say.
//
// A sign-up that is accepted creates a real, unconfirmed user and sends a
// confirmation email. Delete that user afterwards in the dashboard
// (Authentication → Users).
//
// Prints only the outcome: never the key, the random password, or the user
// Supabase sends back.
import { randomBytes } from "node:crypto";
import { STUDENT_EMAIL_PATTERN } from "../src/lib/constants.ts";

const email = process.argv[2]?.trim();
if (!email) {
  console.error("Usage: node --env-file=.env.local scripts/check-signup-hook.mjs <email>");
  process.exit(2);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const missing = [
  ["NEXT_PUBLIC_SUPABASE_URL", url],
  ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", key],
].filter(([, value]) => !value).map(([name]) => name);
if (missing.length) {
  console.error(`Missing ${missing.join(" and ")}. Run with --env-file=.env.local.`);
  process.exit(2);
}

const isStudentEmail = new RegExp(STUDENT_EMAIL_PATTERN, "i").test(email);
const expected = isStudentEmail ? "accepted" : "rejected";

// Strong and thrown away, so a password check can't be why it's rejected.
const password = `${randomBytes(24).toString("base64url")}aA1!`;

let response;
try {
  response = await fetch(new URL("/auth/v1/signup", url), {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    signal: AbortSignal.timeout(15_000),
  });
} catch (error) {
  console.error(`Could not reach Supabase Auth: ${error.message}`);
  process.exit(2);
}

const body = await response.json().catch(() => ({}));
const code = body.error_code ?? body.code ?? "none";
const message = body.msg ?? body.message ?? body.error_description ?? "";

console.log(`Project:  ${new URL(url).host}`);
console.log(`Email:    ${isStudentEmail ? "matches" : "does not match"} the student pattern, so it should be ${expected}`);

let outcome;
if (response.ok) {
  outcome = "accepted";
  console.log(`Result:   ACCEPTED (${response.status}). Supabase created the user.`);
} else if (response.status === 403) {
  outcome = "rejected";
  console.log(`Result:   REJECTED (403) by the hook: ${message}`);
} else if (response.status === 429) {
  console.log(`Result:   RATE LIMITED (429, ${code}). Wait and try again.`);
  process.exit(2);
} else {
  console.log(`Result:   FAILED for another reason (${response.status}, ${code}): ${message}`);
  console.log("          This is not the hook's answer, so it says nothing about the hook.");
  process.exit(2);
}

if (outcome === expected) {
  console.log("PASS: the hook behaves as expected.");
  if (outcome === "accepted") {
    console.log("Delete the new user in the dashboard (Authentication → Users).");
  }
} else {
  console.log(`FAIL: expected ${expected}.`);
  if (outcome === "accepted") {
    console.log("The hook is probably off. See DEVELOPMENT.md 10.1, step 1.");
    console.log("Delete the new user in the dashboard (Authentication → Users).");
  }
  process.exitCode = 1;
}
