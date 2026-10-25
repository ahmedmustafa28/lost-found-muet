"use client";

import Link from "next/link";
import { resetPassword } from "@/lib/auth/actions";
import { PASSWORD_MIN_LENGTH } from "@/lib/constants";
import { resetPasswordSchema } from "@/lib/validation/auth";
import { FormMessage } from "./FormMessage";
import { SubmitButton } from "./SubmitButton";
import { TextField } from "./TextField";
import { useFormAction } from "./useFormAction";

export function ResetPasswordForm() {
  const { formAction, onSubmit, pending, succeeded, error, fieldErrors } =
    useFormAction(resetPassword, resetPasswordSchema);

  if (succeeded) {
    return (
      <div className="flex flex-col gap-4">
        <FormMessage kind="success">Your password has been changed.</FormMessage>
        <Link href="/dashboard" className="underline">
          Go to your dashboard
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {error && <FormMessage kind="error">{error}</FormMessage>}
      <TextField
        label="New password"
        name="password"
        type="password"
        autoComplete="new-password"
        hint={`At least ${PASSWORD_MIN_LENGTH} characters`}
        required
        errors={fieldErrors.password}
      />
      <SubmitButton pending={pending} pendingText="Saving…">
        Save new password
      </SubmitButton>
    </form>
  );
}
