import { AUTH_ERROR_MESSAGES, GENERIC_ERROR_MESSAGE } from "@/lib/constants";

// Supabase's own messages are never shown; only known codes get a specific
// message.
export function authErrorMessage(error: { code?: string }): string {
  return (error.code && AUTH_ERROR_MESSAGES[error.code]) || GENERIC_ERROR_MESSAGE;
}
