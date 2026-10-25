import {
  startTransition,
  useActionState,
  useState,
  type FormEvent,
} from "react";
import * as z from "zod";
import type { ActionResult, FieldErrors } from "@/lib/actionResult";

type FormAction = (
  previous: ActionResult | null,
  formData: FormData,
) => Promise<ActionResult>;

// Runs the form's Zod schema in the browser first, so mistakes show before
// anything is sent; the Server Action checks again. Submitting through
// startTransition instead of the form's action also keeps what the user typed
// when the server returns an error (a form action resets the form). Without
// JavaScript the form still posts to the action.
export function useFormAction(action: FormAction, schema: z.ZodType) {
  const [state, formAction, pending] = useActionState(action, null);
  const [clientErrors, setClientErrors] = useState<FieldErrors | null>(null);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const parsed = schema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      setClientErrors(z.flattenError(parsed.error).fieldErrors);
      return;
    }
    setClientErrors(null);
    startTransition(() => formAction(formData));
  }

  const failed = state?.ok === false ? state : null;
  return {
    formAction,
    onSubmit,
    pending,
    succeeded: state?.ok === true,
    error: clientErrors ? undefined : failed?.error,
    fieldErrors: clientErrors ?? failed?.fieldErrors ?? {},
  };
}
