"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { FormMessage } from "@/components/forms/FormMessage";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { closeReport } from "@/lib/reports/actions";

const secondaryButton =
  "rounded-md border border-neutral-400 px-4 py-2 font-medium hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:hover:bg-neutral-900";

// Asks first (DEVELOPMENT.md 8.1), on the page rather than in a browser
// pop-up. On success the Server Action reloads the item page, which then
// shows the report as closed.
export function CloseReportButton({ reportId }: { reportId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, pending] = useActionState(closeReport, null);
  const questionRef = useRef<HTMLParagraphElement>(null);

  // Keyboard and screen reader users land on the question.
  useEffect(() => {
    if (confirming) questionRef.current?.focus();
  }, [confirming]);

  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className={secondaryButton}>
        Close report
      </button>
    );
  }

  return (
    <form
      action={formAction}
      className="flex w-full flex-col gap-3 rounded-md border border-neutral-400 p-4"
    >
      <input type="hidden" name="id" value={reportId} />
      <p ref={questionRef} tabIndex={-1} className="font-medium focus:outline-none">
        Close this report? It will be taken off the public lists, and you
        can&apos;t reopen it.
      </p>
      {state?.ok === false && state.error && (
        <FormMessage kind="error">{state.error}</FormMessage>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pending={pending} pendingText="Closing…">
          Yes, close report
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
