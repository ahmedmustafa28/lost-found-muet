import Link from "next/link";
import { CLAIM_TYPE_LABELS, type ClaimType, type ReportType } from "@/lib/constants";
import { ClaimButton } from "./ClaimButton";

type ClaimPanelProps = {
  reportId: string;
  reportType: ReportType;
  reportIsActive: boolean;
  signedIn: boolean;
  // The viewer's pending or approved claim on this report.
  openClaimId: string | null;
};

// The claim part of the item page for anyone but the owner. Hiding the
// button is for convenience; submit_claim() enforces the same rules
// (DEVELOPMENT.md 8.7).
export function ClaimPanel({
  reportId,
  reportType,
  reportIsActive,
  signedIn,
  openClaimId,
}: ClaimPanelProps) {
  const claimType: ClaimType = reportType === "found" ? "ownership" : "found_match";

  // Shown even once the report has ended: a claimant with an approved claim
  // still sees a resolved report.
  if (openClaimId) {
    return (
      <section aria-label="Your claim" className="rounded-md border border-neutral-400 p-4">
        <p>
          You&apos;ve already sent a claim.{" "}
          <Link href={`/claims/${openClaimId}`} className="underline">
            View your claim
          </Link>
        </p>
      </section>
    );
  }

  if (!reportIsActive) return null;

  return (
    <section aria-label="Claim this item" className="flex flex-wrap items-start gap-3">
      {signedIn ? (
        <ClaimButton reportId={reportId} claimType={claimType} />
      ) : (
        <Link
          href="/login"
          className="rounded-md bg-neutral-900 px-4 py-2 font-medium text-white hover:bg-neutral-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
        >
          {CLAIM_TYPE_LABELS[claimType]}
        </Link>
      )}
    </section>
  );
}
