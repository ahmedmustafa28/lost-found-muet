import * as z from "zod";
import { TEXT_LIMITS } from "@/lib/constants";
import { text } from "@/lib/validation/text";

// Used in the browser for instant errors and again in the Server Action;
// submit_claim() checks the same trimmed length. There is no claim type or
// status here: the database sets both (DEVELOPMENT.md D-02).
export const claimSchema = z.object({
  message: text()
    .trim()
    .min(
      TEXT_LIMITS.claimMessage.min,
      `Write at least ${TEXT_LIMITS.claimMessage.min} characters.`,
    )
    .max(
      TEXT_LIMITS.claimMessage.max,
      `Use ${TEXT_LIMITS.claimMessage.max} characters or fewer.`,
    ),
});

// approve_claim() checks the same trimmed length (DEVELOPMENT.md 8.4).
export const handoverSchema = z.object({
  handoverNote: text()
    .trim()
    .min(
      TEXT_LIMITS.handoverNote.min,
      `Write at least ${TEXT_LIMITS.handoverNote.min} characters.`,
    )
    .max(
      TEXT_LIMITS.handoverNote.max,
      `Use ${TEXT_LIMITS.handoverNote.max} characters or fewer.`,
    ),
});
