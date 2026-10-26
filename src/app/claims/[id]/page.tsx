import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CancelClaimButton } from "@/components/claims/CancelClaimButton";
import { ClaimDetails } from "@/components/claims/ClaimDetails";
import { getClaim } from "@/lib/claims/queries";

export const metadata: Metadata = { title: "Claim" };

export default async function ClaimPage({ params }: PageProps<"/claims/[id]">) {
  const { id } = await params;
  // Null for signed-out visitors too; the layout has already sent them to
  // /login.
  const claim = await getClaim(id);
  if (!claim) notFound();

  // cancel_claim() allows only the claimant, only for an open claim, and
  // only while the report is active (DEVELOPMENT.md 8.7). Hiding the button
  // is for convenience; the database enforces the same rule.
  const canCancel =
    claim.isClaimant &&
    (claim.status === "pending" || claim.status === "approved") &&
    claim.report?.status === "active";

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10">
      <ClaimDetails claim={claim} />
      {canCancel && (
        <section aria-label="Manage your claim" className="flex flex-wrap items-start gap-3">
          <CancelClaimButton claimId={claim.id} />
        </section>
      )}
    </main>
  );
}
