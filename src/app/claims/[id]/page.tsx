import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ApproveClaimForm } from "@/components/claims/ApproveClaimForm";
import { CancelClaimButton } from "@/components/claims/CancelClaimButton";
import { ClaimDetails } from "@/components/claims/ClaimDetails";
import { HandoverContact } from "@/components/claims/HandoverContact";
import { RejectClaimButton } from "@/components/claims/RejectClaimButton";
import { getClaim } from "@/lib/claims/queries";
import { CLAIM_ERROR_MESSAGES } from "@/lib/constants";

export const metadata: Metadata = { title: "Claim" };

export default async function ClaimPage({ params }: PageProps<"/claims/[id]">) {
  const { id } = await params;
  // Null for signed-out visitors too; the layout has already sent them to
  // /login.
  const claim = await getClaim(id);
  if (!claim) notFound();

  // The rules of cancel_claim(), approve_claim() and reject_claim()
  // (DEVELOPMENT.md 8.7). Hiding the buttons is for convenience; the
  // database enforces the same rules.
  const open = claim.status === "pending" || claim.status === "approved";
  const reportActive = claim.report?.status === "active";
  const canCancel = claim.isClaimant && open && reportActive;
  const canReview = claim.isReportOwner && open && reportActive;
  const canApprove = canReview && claim.status === "pending" && !claim.otherApprovedClaimId;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10">
      <ClaimDetails claim={claim} />
      {claim.contact && (
        <HandoverContact
          handoverNote={claim.handoverNote}
          contact={claim.contact}
          otherPersonLabel={claim.isClaimant ? "The person who posted the report" : "The claimant"}
        />
      )}
      {canReview && (
        <section aria-label="Review this claim" className="flex flex-col gap-3">
          {claim.otherApprovedClaimId && (
            <p>
              {CLAIM_ERROR_MESSAGES.alreadyApproved}{" "}
              <Link href={`/claims/${claim.otherApprovedClaimId}`} className="underline">
                View the approved claim
              </Link>
            </p>
          )}
          <div className="flex flex-wrap items-start gap-3">
            {canApprove && <ApproveClaimForm claimId={claim.id} />}
            <RejectClaimButton claimId={claim.id} approved={claim.status === "approved"} />
          </div>
        </section>
      )}
      {canCancel && (
        <section aria-label="Manage your claim" className="flex flex-wrap items-start gap-3">
          <CancelClaimButton claimId={claim.id} />
        </section>
      )}
    </main>
  );
}
