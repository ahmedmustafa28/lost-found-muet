import {
  ERROR_CODES,
  ERROR_MESSAGES,
  GENERIC_ERROR_MESSAGE,
  type ErrorCode,
} from "@/lib/constants";

// Database functions and triggers raise one of ERROR_CODES as the error
// message (DEVELOPMENT.md 9.10). Anything else, such as Postgres's own text
// or a constraint name, is never shown.
export function dbErrorCode(error: { message?: string }): ErrorCode | null {
  const code = ERROR_CODES.find((c) => c === error.message);
  return code ?? null;
}

export function dbErrorMessage(error: { message?: string }): string {
  const code = dbErrorCode(error);
  return code ? ERROR_MESSAGES[code] : GENERIC_ERROR_MESSAGE;
}
