import Link from "next/link";
import { CLAIM_STATUS_LABELS, CLAIM_TYPE_LABELS, type ReportStatus } from "@/lib/constants";
import type { ReportClaim } from "@/lib/claims/queries";
import { claimStatusText } from "@/lib/claims/statusText";
import { formatTimestampDate } from "@/lib/dates";

// The owner's list of claims on their report. Never shows who made a claim:
// names and emails appear only on an approved claim's page. Status is shown
// as text, not only colour.
export function ReportClaimsList({
  claims,
  reportStatus,
}: {
  claims: ReportClaim[];
  reportStatus: ReportStatus;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Claims ({claims.length})</h2>
      {claims.length === 0 ? (
        <p>No claims yet.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-neutral-300 rounded-md border border-neutral-300 dark:divide-neutral-700 dark:border-neutral-700">
          {claims.map((claim) => (
            <li key={claim.id}>
              <Link
                href={`/claims/${claim.id}`}
                className="flex flex-col gap-1 px-4 py-3 hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:hover:bg-neutral-900"
              >
                <span className="font-medium">
                  {CLAIM_TYPE_LABELS[claim.claimType]} · {CLAIM_STATUS_LABELS[claim.status]}:{" "}
                  {claimStatusText(claim.status, "owner", reportStatus, claim.claimType).short}
                </span>
                <span className="text-sm text-neutral-700 dark:text-neutral-300">
                  Sent {formatTimestampDate(claim.createdAt)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
