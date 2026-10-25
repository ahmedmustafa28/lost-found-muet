const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Checked before an id from a URL or form reaches the database, so a bad id
// gives "not found" instead of a Postgres error.
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}
