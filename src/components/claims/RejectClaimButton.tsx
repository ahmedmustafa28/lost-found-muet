"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { FormMessage } from "@/components/forms/FormMessage";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { rejectClaim } from "@/lib/claims/actions";

const secondaryButton =
  "rounded-md border border-neutral-400 px-4 py-2 font-medium hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:hover:bg-neutral-900";

// Asks first, on the page, like CloseReportButton. An approved claim can be
// rejected too, if the handover didn't work out (DEVELOPMENT.md 6.5).
export function RejectClaimButton({ claimId, approved }: { claimId: string; approved: boolean }) {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, pending] = useActionState(rejectClaim, null);
  const questionRef = useRef<HTMLParagraphElement>(null);

  // Keyboard and screen reader users land on the question.
  useEffect(() => {
    if (confirming) questionRef.current?.focus();
  }, [confirming]);

  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className={secondaryButton}>
        Reject
      </button>
    );
  }

  return (
    <form
      action={formAction}
      className="flex w-full flex-col gap-3 rounded-md border border-neutral-400 p-4"
    >
      <input type="hidden" name="id" value={claimId} />
      <p ref={questionRef} tabIndex={-1} className="font-medium focus:outline-none">
        {approved
          ? "Reject this approved claim? You and the claimant will no longer see each other's contact details, and you can approve another claim. This can't be undone."
          : "Reject this claim? This can't be undone."}
      </p>
      {state?.ok === false && state.error && (
        <FormMessage kind="error">{state.error}</FormMessage>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pending={pending} pendingText="Rejecting…">
          Yes, reject claim
        </SubmitButton>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={pending}
          className={secondaryButton}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
