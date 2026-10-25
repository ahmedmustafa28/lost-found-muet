import * as z from "zod";

// Postgres text can't hold the null character (U+0000): a value containing
// it makes the query fail, which would show the error page instead of a
// form message. It is never meaningful in this app's text, so it is removed.
export function stripNul(value: string): string {
  return value.replaceAll("\u0000", "");
}

// The start of every string field in the Zod schemas. overwrite() changes the
// value but keeps it a string, so .trim(), .min() and .max() still follow.
export function text() {
  return z.string().overwrite(stripNul);
}
