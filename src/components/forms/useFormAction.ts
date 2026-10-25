import {
  startTransition,
  useActionState,
  useState,
  type FormEvent,
} from "react";
import * as z from "zod";
import type { ActionFailure, FormAction } from "@/lib/actionResult";

// Runs before the Server Action, after the form passes the browser check:
// for example, uploading a photo and adding its path to the form data.
// Returns a failure to show instead of submitting, or null to go on.
export type PrepareSubmit = (formData: FormData) => Promise<ActionFailure | null>;

// Runs the form's Zod schema in the browser first, so mistakes show before
// anything is sent; the Server Action checks again. Submitting through
// startTransition instead of the form's action also keeps what the user typed
// when the server returns an error (a form action resets the form). Without
// JavaScript the form still posts to the action.
export function useFormAction(
  action: FormAction,
  schema: z.ZodType,
  prepare?: PrepareSubmit,
) {
  const [state, formAction, pending] = useActionState(action, null);
  const [localFailure, setLocalFailure] = useState<ActionFailure | null>(null);
  const [preparing, setPreparing] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const parsed = schema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      setLocalFailure({ ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors });
      return;
    }
    setLocalFailure(null);
    if (prepare) {
      setPreparing(true);
      const failure = await prepare(formData);
      setPreparing(false);
      if (failure) {
        setLocalFailure(failure);
        return;
      }
    }
    startTransition(() => formAction(formData));
  }

  const failed = localFailure ?? (state?.ok === false ? state : null);
  return {
    formAction,
    onSubmit,
    pending: pending || preparing,
    succeeded: state?.ok === true,
    error: failed?.error,
    fieldErrors: failed?.fieldErrors ?? {},
  };
}
