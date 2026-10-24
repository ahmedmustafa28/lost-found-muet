// Shared setup for the database tests. Runs Postgres in WASM (PGlite) with a
// small stand-in for the parts of Supabase the migrations rely on, so the
// tests run where `supabase db reset` can't (no Docker needed).
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

const migrationsDir = fileURLToPath(new URL("../../supabase/migrations/", import.meta.url));

export async function setup() {
  const db = new PGlite();
  let pass = 0, fail = 0;
  const ok = (name) => { pass++; console.log(`  PASS  ${name}`); };
  const bad = (name, why) => { fail++; console.log(`  FAIL  ${name}\n        ${why}`); };
  function check(name, passed, why) {
    if (passed) ok(name);
    else bad(name, why);
  }
  async function expectOk(name, sql) {
    try { await db.exec(sql); ok(name); } catch (e) { bad(name, `unexpected error: ${e.message}`); }
  }
  async function expectError(name, sql, needle) {
    try { await db.exec(sql); bad(name, `expected error containing "${needle}", but it succeeded`); }
    catch (e) { check(`${name}  [${needle}]`, e.message.includes(needle), `wrong error: ${e.message}`); }
  }
  async function expectValue(name, sql, expected) {
    let rows;
    try { ({ rows } = await db.query(sql)); }
    catch (e) { bad(`${name} = ${expected}`, `unexpected error: ${e.message}`); return; }
    const got = rows.length ? Object.values(rows[0])[0] : undefined;
    check(`${name} = ${expected}`, String(got) === String(expected), `expected ${expected}, got ${got}`);
  }
  // Switch to an API role ("anon" or "authenticated") with the given signed-in
  // user, or back to the test's superuser when role is null.
  async function actAs(role, userId = "") {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${userId}', false);`
      + (role ? ` set role ${role};` : ""));
  }
  function finish() {
    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
  }

  const ver = await db.query("select version()");
  console.log(ver.rows[0].version.split(",")[0]);

  // Stand-in for Supabase: auth.users, auth.uid(), the API roles, and the
  // default privileges that open new public tables and functions to them.
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
    alter default privileges in schema public grant all on functions to anon, authenticated;
  `);

  console.log("\nApply migrations");
  // Filenames start with a timestamp, so sorting gives the order Supabase uses.
  for (const file of readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort()) {
    await expectOk(file, readFileSync(join(migrationsDir, file), "utf8"));
  }

  return { db, ok, bad, check, expectOk, expectError, expectValue, actAs, finish };
}
