"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FormAction } from "@/lib/actionResult";
import { CLAIM_ERROR_MESSAGES, ERROR_MESSAGES, TEXT_LIMITS } from "@/lib/constants";
import { dbErrorCode, dbErrorMessage } from "@/lib/dbErrorMessage";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/uuid";
import { fieldErrorsOf } from "@/lib/validation/auth";
import { claimSchema } from "@/lib/validation/claim";

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
