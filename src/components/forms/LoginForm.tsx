"use client";

import { login } from "@/lib/auth/actions";
import { loginSchema } from "@/lib/validation/auth";
import { FormMessage } from "./FormMessage";
import { SubmitButton } from "./SubmitButton";
import { TextField } from "./TextField";
import { useFormAction } from "./useFormAction";

// On success the action redirects to /dashboard.
export function LoginForm() {
  const { formAction, onSubmit, pending, error, fieldErrors } = useFormAction(
    login,
    loginSchema,
  );

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
      <TextField
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        errors={fieldErrors.password}
      />
      <SubmitButton pending={pending} pendingText="Logging in…">
        Log in
      </SubmitButton>
    </form>
  );
}
