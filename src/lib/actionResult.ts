// What every Server Action returns (AGENTS.md, Next.js conventions).
export type FieldErrors = Partial<Record<string, string[]>>;

export type ActionResult =
  | { ok: true }
  | { ok: false; error?: string; fieldErrors?: FieldErrors };
