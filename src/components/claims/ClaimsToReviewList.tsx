import Link from "next/link";
import { CLAIM_STATUS_LABELS, CLAIM_TYPE_LABELS } from "@/lib/constants";
import type { ClaimToReview } from "@/lib/claims/queries";
import { claimStatusText } from "@/lib/claims/statusText";
import { formatTimestampDate } from "@/lib/dates";

// Pending claims on the user's active reports. Never shows who made a claim.
export function ClaimsToReviewList({ claims }: { claims: ClaimToReview[] }) {
  if (claims.length === 0) {
    return <p>No claims are waiting for your review.</p>;
  }

  return (
    <ul className="flex flex-col divide-y divide-neutral-300 rounded-md border border-neutral-300 dark:divide-neutral-700 dark:border-neutral-700">
      {claims.map((claim) => (
        <li key={claim.id}>
          <Link
            href={`/claims/${claim.id}`}
            className="flex flex-col gap-1 px-4 py-3 hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:hover:bg-neutral-900"
          >
            <span className="break-words font-medium underline-offset-4">{claim.reportTitle}</span>
            <span className="text-sm text-neutral-700 dark:text-neutral-300">
              {CLAIM_TYPE_LABELS[claim.claimType]} · {CLAIM_STATUS_LABELS.pending}:{" "}
              {claimStatusText("pending", "owner", "active", claim.claimType).short} · Sent{" "}
              {formatTimestampDate(claim.createdAt)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
