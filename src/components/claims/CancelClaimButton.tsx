"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { FormMessage } from "@/components/forms/FormMessage";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { cancelClaim } from "@/lib/claims/actions";

const secondaryButton =
  "rounded-md border border-neutral-400 px-4 py-2 font-medium hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:hover:bg-neutral-900";

// Asks first, on the page, like CloseReportButton. On success the Server
// Action reloads the claim page, which then shows the claim as cancelled.
export function CancelClaimButton({ claimId }: { claimId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, pending] = useActionState(cancelClaim, null);
  const questionRef = useRef<HTMLParagraphElement>(null);

  // Keyboard and screen reader users land on the question.
  useEffect(() => {
    if (confirming) questionRef.current?.focus();
  }, [confirming]);

  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className={secondaryButton}>
        Cancel claim
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
        Cancel this claim? The person who posted the report will no longer be
        able to approve it. You can send a new claim while the report is
        still active.
      </p>
      {state?.ok === false && state.error && (
        <FormMessage kind="error">{state.error}</FormMessage>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pending={pending} pendingText="Cancelling…">
          Yes, cancel claim
        </SubmitButton>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={pending}
          className={secondaryButton}
        >
          Keep claim
        </button>
      </div>
    </form>
  );
}
