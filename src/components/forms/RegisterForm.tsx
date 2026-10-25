"use client";

import { register } from "@/lib/auth/actions";
import { PASSWORD_MIN_LENGTH } from "@/lib/constants";
import { registerSchema } from "@/lib/validation/auth";
import { FormMessage } from "./FormMessage";
import { SubmitButton } from "./SubmitButton";
import { TextField } from "./TextField";
import { useFormAction } from "./useFormAction";

export function RegisterForm() {
  const { formAction, onSubmit, pending, succeeded, error, fieldErrors } =
    useFormAction(register, registerSchema);

  if (succeeded) {
    return (
      <FormMessage kind="success">
        Check your MUET email to confirm your account.
      </FormMessage>
    );
  }

  return (
    <form action={formAction} onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {error && <FormMessage kind="error">{error}</FormMessage>}
      <TextField
        label="Full name"
        name="fullName"
        autoComplete="name"
        required
        errors={fieldErrors.fullName}
      />
      <TextField
        label="MUET student email"
        name="email"
        type="email"
        autoComplete="email"
        hint="Your roll number, for example 23sw016@students.muet.edu.pk"
        required
        errors={fieldErrors.email}
      />
      <TextField
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        hint={`At least ${PASSWORD_MIN_LENGTH} characters`}
        required
        errors={fieldErrors.password}
      />
      <SubmitButton pending={pending} pendingText="Creating account…">
        Create account
      </SubmitButton>
    </form>
  );
}
