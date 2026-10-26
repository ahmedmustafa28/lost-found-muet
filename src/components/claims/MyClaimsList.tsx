import Link from "next/link";
import { CLAIM_STATUS_LABELS, CLAIM_TYPE_LABELS } from "@/lib/constants";
import type { MyClaim } from "@/lib/claims/queries";
import { claimStatusText } from "@/lib/claims/statusText";
import { formatTimestampDate } from "@/lib/dates";

// Status is shown as text, not only colour.
export function MyClaimsList({ claims }: { claims: MyClaim[] }) {
  if (claims.length === 0) {
    return <p>You haven&apos;t sent any claims yet.</p>;
  }

  return (
    <ul className="flex flex-col divide-y divide-neutral-300 rounded-md border border-neutral-300 dark:divide-neutral-700 dark:border-neutral-700">
      {claims.map((claim) => (
        <li key={claim.id}>
          <Link
            href={`/claims/${claim.id}`}
            className="flex flex-col gap-1 px-4 py-3 hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:hover:bg-neutral-900"
          >
            <span className="break-words font-medium underline-offset-4">
              {claim.reportTitle ?? "Report no longer available"}
            </span>
            <span className="text-sm text-neutral-700 dark:text-neutral-300">
              {CLAIM_TYPE_LABELS[claim.claimType]} · {CLAIM_STATUS_LABELS[claim.status]}:{" "}
              {claimStatusText(claim.status, "claimant", claim.reportStatus).short} · Sent{" "}
              {formatTimestampDate(claim.createdAt)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
