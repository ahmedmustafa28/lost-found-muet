// What every Server Action returns (AGENTS.md, Next.js conventions).
export type FieldErrors = Partial<Record<string, string[]>>;

export type ActionResult =
  | { ok: true }
  | { ok: false; error?: string; fieldErrors?: FieldErrors };

export type ActionFailure = Extract<ActionResult, { ok: false }>;

// The signature of a Server Action used with useActionState.
export type FormAction = (
  previous: ActionResult | null,
  formData: FormData,
) => Promise<ActionResult>;
