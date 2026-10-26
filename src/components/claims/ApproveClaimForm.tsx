"use client";

import { useEffect, useRef, useState } from "react";
import { FormMessage } from "@/components/forms/FormMessage";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { TextAreaField } from "@/components/forms/TextAreaField";
import { useFormAction } from "@/components/forms/useFormAction";
import { CLAIM_CONTACT_NOTICE, HANDOVER_NOTE_HINT, TEXT_LIMITS } from "@/lib/constants";
import { approveClaim } from "@/lib/claims/actions";
import { handoverSchema } from "@/lib/validation/claim";

const primaryButton =
  "rounded-md bg-neutral-900 px-4 py-2 font-medium text-white hover:bg-neutral-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300";

const secondaryButton =
  "rounded-md border border-neutral-400 px-4 py-2 font-medium hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:hover:bg-neutral-900";

// Approving needs a handover note and shows the contact-sharing warning
// first (DEVELOPMENT.md D-03, 8.4). On success the Server Action reloads the
// claim page, which then shows the contact details.
export function ApproveClaimForm({ claimId }: { claimId: string }) {
  const [open, setOpen] = useState(false);
  const { formAction, onSubmit, pending, error, fieldErrors } = useFormAction(
    approveClaim,
    handoverSchema,
  );
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Keyboard and screen reader users land on the form's heading.
  useEffect(() => {
    if (open) headingRef.current?.focus();
  }, [open]);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={primaryButton}>
        Approve
      </button>
    );
  }

  return (
    <form
      action={formAction}
      onSubmit={onSubmit}
      noValidate
      className="flex w-full flex-col gap-4 rounded-md border border-neutral-400 p-4"
    >
      <h2 ref={headingRef} tabIndex={-1} className="text-lg font-semibold focus:outline-none">
        Approve this claim
      </h2>
      <input type="hidden" name="id" value={claimId} />
      {error && <FormMessage kind="error">{error}</FormMessage>}
      <TextAreaField
        label="Handover note"
        name="handoverNote"
        hint={HANDOVER_NOTE_HINT}
        maxLength={TEXT_LIMITS.handoverNote.max}
        rows={3}
        required
        errors={fieldErrors.handoverNote}
      />
      <p className="text-sm">{CLAIM_CONTACT_NOTICE}</p>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pending={pending} pendingText="Approving…">
          Approve claim
        </SubmitButton>
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={pending}
          className={secondaryButton}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
