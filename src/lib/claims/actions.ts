"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FormAction } from "@/lib/actionResult";
import { CLAIM_ERROR_MESSAGES, ERROR_MESSAGES, TEXT_LIMITS } from "@/lib/constants";
import { dbErrorCode, dbErrorMessage } from "@/lib/dbErrorMessage";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/uuid";
import { fieldErrorsOf } from "@/lib/validation/auth";
import { claimSchema, handoverSchema } from "@/lib/validation/claim";

// Creates a pending claim through submit_claim(), which checks the caller,
// the report and duplicates itself and sets the claim type from the report
// type (DEVELOPMENT.md 8.7, 9.10). Only the report id and message are sent.
export const submitClaim: FormAction = async (_previous, formData) => {
  const itemId = formData.get("id");
  if (!isUuid(itemId)) return { ok: false, error: ERROR_MESSAGES.NOT_FOUND };

  const parsed = claimSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsOf(parsed.error) };

  const supabase = await createClient();
  const { data: claimId, error } = await supabase.rpc("submit_claim", {
    p_item_id: itemId,
    p_message: parsed.data.message,
  });
  if (error) {
    switch (dbErrorCode(error)) {
      case "DUPLICATE_CLAIM":
        return { ok: false, error: CLAIM_ERROR_MESSAGES.duplicate };
      case "ITEM_NOT_ACTIVE":
        return { ok: false, error: CLAIM_ERROR_MESSAGES.notTakingClaims };
      case "NOT_FOUND":
        return { ok: false, error: CLAIM_ERROR_MESSAGES.reportUnavailable };
      case "INVALID_INPUT":
        if (error.details === "message") {
          return {
            ok: false,
            fieldErrors: {
              message: [
                `Write between ${TEXT_LIMITS.claimMessage.min} and ${TEXT_LIMITS.claimMessage.max} characters.`,
              ],
            },
          };
        }
    }
    return { ok: false, error: dbErrorMessage(error) };
  }

  revalidatePath(`/items/${itemId}`);
  revalidatePath("/dashboard");
  redirect(`/claims/${claimId}`);
};

// pending or approved → cancelled through cancel_claim(), which allows only
// the claimant, and only while the report is active (DEVELOPMENT.md 8.7).
export const cancelClaim: FormAction = async (_previous, formData) => {
  const id = formData.get("id");
  if (!isUuid(id)) return { ok: false, error: ERROR_MESSAGES.NOT_FOUND };

  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_claim", { p_claim_id: id });
  if (error) {
    switch (dbErrorCode(error)) {
      case "INVALID_STATUS":
        return { ok: false, error: CLAIM_ERROR_MESSAGES.alreadyEnded };
      case "ITEM_NOT_ACTIVE":
        return { ok: false, error: CLAIM_ERROR_MESSAGES.cannotCancelEnded };
    }
    return { ok: false, error: dbErrorMessage(error) };
  }

  // The item page shows the claim button again once no claim is open.
  revalidatePath(`/claims/${id}`);
  revalidatePath("/dashboard");
  revalidatePath("/items/[id]", "page");
  redirect(`/claims/${id}`);
};

// pending → approved through approve_claim(), which allows the report owner
// (or an admin, not on their own claim) while the report is active and no
// other claim is approved (DEVELOPMENT.md 8.7). The handover note is required.
export const approveClaim: FormAction = async (_previous, formData) => {
  const id = formData.get("id");
  if (!isUuid(id)) return { ok: false, error: ERROR_MESSAGES.NOT_FOUND };

  const parsed = handoverSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsOf(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.rpc("approve_claim", {
    p_claim_id: id,
    p_handover_note: parsed.data.handoverNote,
  });
  if (error) {
    switch (dbErrorCode(error)) {
      case "ALREADY_APPROVED":
        return { ok: false, error: CLAIM_ERROR_MESSAGES.alreadyApproved };
      case "INVALID_STATUS":
        return { ok: false, error: CLAIM_ERROR_MESSAGES.noLongerPending };
      case "ITEM_NOT_ACTIVE":
        return { ok: false, error: CLAIM_ERROR_MESSAGES.cannotReviewEnded };
      case "INVALID_INPUT":
        if (error.details === "handover_note") {
          return {
            ok: false,
            fieldErrors: {
              handoverNote: [
                `Write between ${TEXT_LIMITS.handoverNote.min} and ${TEXT_LIMITS.handoverNote.max} characters.`,
              ],
            },
          };
        }
    }
    return { ok: false, error: dbErrorMessage(error) };
  }

  revalidateAfterReview();
  redirect(`/claims/${id}`);
};

// pending or approved → rejected through reject_claim(), while the report is
// active. Rejecting an approved claim (the handover didn't work out) hides
// the contact details again and lets the owner approve another claim.
export const rejectClaim: FormAction = async (_previous, formData) => {
  const id = formData.get("id");
  if (!isUuid(id)) return { ok: false, error: ERROR_MESSAGES.NOT_FOUND };

  const supabase = await createClient();
  const { error } = await supabase.rpc("reject_claim", { p_claim_id: id });
  if (error) {
    switch (dbErrorCode(error)) {
      case "INVALID_STATUS":
        return { ok: false, error: CLAIM_ERROR_MESSAGES.alreadyEnded };
      case "ITEM_NOT_ACTIVE":
        return { ok: false, error: CLAIM_ERROR_MESSAGES.cannotReviewEnded };
    }
    return { ok: false, error: dbErrorMessage(error) };
  }

  revalidateAfterReview();
  redirect(`/claims/${id}`);
};

// A review changes the claim page, the item page's Claims list, the
// dashboard and the header's review count (in the root layout). The claim
// functions don't return the report's id, so everything under the root
// layout is refreshed.
function revalidateAfterReview() {
  revalidatePath("/", "layout");
}
