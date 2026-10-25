"use client";

import { requestPasswordReset } from "@/lib/auth/actions";
import { PASSWORD_RESET_SENT_MESSAGE } from "@/lib/constants";
import { forgotPasswordSchema } from "@/lib/validation/auth";
import { FormMessage } from "./FormMessage";
import { SubmitButton } from "./SubmitButton";
import { TextField } from "./TextField";
import { useFormAction } from "./useFormAction";

export function ForgotPasswordForm() {
  const { formAction, onSubmit, pending, succeeded, error, fieldErrors } =
    useFormAction(requestPasswordReset, forgotPasswordSchema);

  if (succeeded) {
    return <FormMessage kind="success">{PASSWORD_RESET_SENT_MESSAGE}</FormMessage>;
  }

  return (
    <form action={formAction} onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {error && <FormMessage kind="error">{error}</FormMessage>}
      <TextField
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        required
        errors={fieldErrors.email}
      />
      <SubmitButton pending={pending} pendingText="Sending…">
        Send reset link
      </SubmitButton>
    </form>
  );
}
