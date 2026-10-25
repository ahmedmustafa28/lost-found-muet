"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionResult } from "@/lib/actionResult";
import { authErrorMessage } from "@/lib/auth/authErrorMessage";
import { getSignedInUserId } from "@/lib/auth/getSignedInUserId";
import { AUTH_LINK_ERROR_MESSAGE } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import {
  fieldErrorsOf,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from "@/lib/validation/auth";

type FormAction = (
  previous: ActionResult | null,
  formData: FormData,
) => Promise<ActionResult>;

export const register: FormAction = async (_previous, formData) => {
  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsOf(parsed.error) };
  }

  const { fullName, email, password } = parsed.data;
  const supabase = await createClient();
  // The handle_new_user trigger copies full_name into profiles.
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });
  // An email that is already registered also gets no error (Supabase replies
  // as if it worked), so the page can't be used to find accounts.
  if (error) return { ok: false, error: authErrorMessage(error) };
  return { ok: true };
};

export const login: FormAction = async (_previous, formData) => {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsOf(parsed.error) };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { ok: false, error: authErrorMessage(error) };

  revalidatePath("/", "layout");
  redirect("/dashboard");
};

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}

export const requestPasswordReset: FormAction = async (_previous, formData) => {
  const parsed = forgotPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsOf(parsed.error) };
  }

  const supabase = await createClient();
  // The result is ignored on purpose. Any difference in the reply, even a
  // rate-limit error that only registered emails can reach, would reveal
  // whether the email has an account. The recovery email template links to
  // /auth/confirm, which signs the user in and opens /reset-password.
  await supabase.auth.resetPasswordForEmail(parsed.data.email);
  return { ok: true };
};

export const resetPassword: FormAction = async (_previous, formData) => {
  const parsed = resetPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsOf(parsed.error) };
  }

  const supabase = await createClient();
  if (!(await getSignedInUserId(supabase))) {
    return { ok: false, error: AUTH_LINK_ERROR_MESSAGE };
  }
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) return { ok: false, error: authErrorMessage(error) };
  return { ok: true };
};
