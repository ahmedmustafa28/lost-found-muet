"use client";

import { useEffect, useRef, useState } from "react";
import { FormMessage } from "@/components/forms/FormMessage";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { TextAreaField } from "@/components/forms/TextAreaField";
import { useFormAction } from "@/components/forms/useFormAction";
import {
  CLAIM_CONTACT_NOTICE,
  CLAIM_MESSAGE_HINTS,
  CLAIM_TYPE_LABELS,
  TEXT_LIMITS,
  type ClaimType,
} from "@/lib/constants";
import { submitClaim } from "@/lib/claims/actions";
import { claimSchema } from "@/lib/validation/claim";

const primaryButton =
  "rounded-md bg-neutral-900 px-4 py-2 font-medium text-white hover:bg-neutral-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300";

const secondaryButton =
  "rounded-md border border-neutral-400 px-4 py-2 font-medium hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:hover:bg-neutral-900";

// The button opens the form on the item page. claimType only picks the
// wording: the database sets the real claim type from the report type
// (DEVELOPMENT.md D-02). On success the Server Action goes to the new claim.
export function ClaimButton({ reportId, claimType }: { reportId: string; claimType: ClaimType }) {
  const [open, setOpen] = useState(false);
  const { formAction, onSubmit, pending, error, fieldErrors } = useFormAction(
    submitClaim,
    claimSchema,
  );
  const headingRef = useRef<HTMLHeadingElement>(null);
  const label = CLAIM_TYPE_LABELS[claimType];

  // Keyboard and screen reader users land on the form's heading.
  useEffect(() => {
    if (open) headingRef.current?.focus();
  }, [open]);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={primaryButton}>
        {label}
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
        {label}
      </h2>
      <input type="hidden" name="id" value={reportId} />
      {error && <FormMessage kind="error">{error}</FormMessage>}
      <TextAreaField
        label="Message"
        name="message"
        hint={`${CLAIM_MESSAGE_HINTS[claimType]} Only the person who posted the report and site admins can read it.`}
        maxLength={TEXT_LIMITS.claimMessage.max}
        rows={5}
        required
        errors={fieldErrors.message}
      />
      <p className="text-sm">{CLAIM_CONTACT_NOTICE}</p>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pending={pending} pendingText="Sending…">
          Send claim
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
