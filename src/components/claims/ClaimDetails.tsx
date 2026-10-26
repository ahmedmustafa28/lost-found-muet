import Link from "next/link";
import {
  CLAIM_ERROR_MESSAGES,
  CLAIM_STATUS_LABELS,
  CLAIM_TYPE_LABELS,
  REPORT_STATUS_LABELS,
  REPORT_TYPE_LABELS,
} from "@/lib/constants";
import type { ClaimView } from "@/lib/claims/queries";
import { claimStatusText } from "@/lib/claims/statusText";
import { formatTimestampDate } from "@/lib/dates";

// Never shows who made the claim or who posted the report; contact details
// are in HandoverContact. The status explanations are worded for the
// claimant or the owner, so admins see only the status.
export function ClaimDetails({ claim }: { claim: ClaimView }) {
  const { report } = claim;
  const viewer = claim.isClaimant ? "claimant" : claim.isReportOwner ? "owner" : null;
  const statusDescription = viewer
    ? claimStatusText(claim.status, viewer, report?.status ?? null).long
    : null;

  return (
    <article className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-medium uppercase tracking-wide text-neutral-600 dark:text-neutral-400">
          {CLAIM_TYPE_LABELS[claim.claimType]}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          {claim.isClaimant ? "Your claim" : "Claim"}
        </h1>
      </header>

      <section className="flex flex-col gap-2 rounded-md border border-neutral-300 p-4 dark:border-neutral-700">
        <h2 className="text-lg font-semibold">{claim.isReportOwner ? "Your report" : "Report"}</h2>
        {report ? (
          <p className="flex flex-col gap-1">
            <Link href={`/items/${report.id}`} className="break-words underline">
              {report.title}
            </Link>
            <span className="text-sm text-neutral-700 dark:text-neutral-300">
              {REPORT_TYPE_LABELS[report.reportType]} item
              {report.status !== "active" && <> · {REPORT_STATUS_LABELS[report.status]}</>}
            </span>
          </p>
        ) : (
          <p>{CLAIM_ERROR_MESSAGES.reportUnavailable}</p>
        )}
      </section>

      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-[max-content_1fr]">
        <dt className="font-medium">Status</dt>
        <dd>
          <strong>{CLAIM_STATUS_LABELS[claim.status]}</strong>
          {statusDescription && <>. {statusDescription}</>}
        </dd>
        <dt className="font-medium">Sent</dt>
        <dd>{formatTimestampDate(claim.createdAt)}</dd>
      </dl>

      {/* The owner compares the message with their private details
          (DEVELOPMENT.md 6.3, 6.4), so they sit side by side. */}
      <div className={claim.isReportOwner ? "grid grid-cols-1 gap-4 md:grid-cols-2" : undefined}>
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">
            {claim.isReportOwner ? "Claimant's message" : "Message"}
          </h2>
          <p className="whitespace-pre-line break-words">{claim.message}</p>
        </section>
        {claim.isReportOwner && (
          <section className="flex flex-col gap-2 rounded-md border border-neutral-300 p-4 dark:border-neutral-700">
            <h2 className="text-lg font-semibold">Your private details</h2>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              Only you and site admins can see this. The claimant can&apos;t.
            </p>
            <p className="whitespace-pre-line break-words">
              {claim.privateDetails ?? "You didn't add any private details."}
            </p>
          </section>
        )}
      </div>
    </article>
  );
}
