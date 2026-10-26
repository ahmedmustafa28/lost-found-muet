import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ClaimPanel } from "@/components/claims/ClaimPanel";
import { FormMessage } from "@/components/forms/FormMessage";
import { CloseReportButton } from "@/components/items/CloseReportButton";
import { ItemDetails } from "@/components/items/ItemDetails";
import { getSignedInUserId } from "@/lib/auth/getSignedInUserId";
import { getOpenClaimId } from "@/lib/claims/queries";
import { PRIVATE_DETAILS_NOT_SAVED_MESSAGE } from "@/lib/constants";
import { getReport } from "@/lib/reports/queries";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Item" };

export default async function ItemPage({ params, searchParams }: PageProps<"/items/[id]">) {
  const { id } = await params;
  const report = await getReport(id);
  if (!report) notFound();

  // Set by createReport and updateReport. Only this fixed key is read, so the
  // page never shows text from the URL.
  const { notice } = await searchParams;
  const privateDetailsNotSaved = report.isOwner && notice === "private-details-not-saved";

  // Owners can change a report only while it is active (DEVELOPMENT.md 8.6).
  // Hiding these is for convenience; the database enforces the same rule.
  const canChange = report.isOwner && report.status === "active";

  // Owners can't claim their own report (OWN_ITEM), so they get no claim part.
  const userId = report.isOwner ? null : await getSignedInUserId(await createClient());
  const openClaimId = userId ? await getOpenClaimId(report.id, userId) : null;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10">
      {privateDetailsNotSaved && (
        <FormMessage kind="error">{PRIVATE_DETAILS_NOT_SAVED_MESSAGE}</FormMessage>
      )}
      <ItemDetails report={report} />
      {canChange && (
        <section aria-label="Manage your report" className="flex flex-wrap items-start gap-3">
          <Link
            href={`/items/${report.id}/edit`}
            className="rounded-md bg-neutral-900 px-4 py-2 font-medium text-white hover:bg-neutral-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
          >
            Edit
          </Link>
          <CloseReportButton reportId={report.id} />
        </section>
      )}
      {!report.isOwner && (
        <ClaimPanel
          reportId={report.id}
          reportType={report.reportType}
          reportIsActive={report.status === "active"}
          signedIn={userId !== null}
          openClaimId={openClaimId}
        />
      )}
    </main>
  );
}
