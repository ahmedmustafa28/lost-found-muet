import * as z from "zod";
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  STUDENT_EMAIL_MESSAGE,
  STUDENT_EMAIL_PATTERN,
  TEXT_LIMITS,
} from "@/lib/constants";

// Used in the browser for instant errors and again in the Server Actions.

const fullName = z
  .string()
  .trim()
  .min(
    TEXT_LIMITS.fullName.min,
    `Enter your full name (at least ${TEXT_LIMITS.fullName.min} characters).`,
  )
  .max(
    TEXT_LIMITS.fullName.max,
    `Use ${TEXT_LIMITS.fullName.max} characters or fewer.`,
  );

const studentEmail = z
  .string()
  .trim()
  .regex(new RegExp(STUDENT_EMAIL_PATTERN, "i"), STUDENT_EMAIL_MESSAGE);

// Login and password reset accept any email: accounts added in the dashboard
// may not be student emails, and a stricter check here would only reveal
// which emails can exist.
const email = z.string().trim().min(1, "Enter your email address.");

// Not trimmed: a password may start or end with a space.
const newPassword = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters.`)
  .max(PASSWORD_MAX_LENGTH, `Use ${PASSWORD_MAX_LENGTH} characters or fewer.`);

export const registerSchema = z.object({
  fullName,
  email: studentEmail,
  password: newPassword,
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password."),
});

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z.object({ password: newPassword });

export function fieldErrorsOf(error: z.ZodError) {
  return z.flattenError(error).fieldErrors;
}
