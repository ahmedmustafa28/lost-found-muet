import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FormMessage } from "@/components/forms/FormMessage";
import { ItemDetails } from "@/components/items/ItemDetails";
import { PRIVATE_DETAILS_NOT_SAVED_MESSAGE } from "@/lib/constants";
import { getReport } from "@/lib/reports/queries";

export const metadata: Metadata = { title: "Item" };

export default async function ItemPage({ params, searchParams }: PageProps<"/items/[id]">) {
  const { id } = await params;
  const report = await getReport(id);
  if (!report) notFound();

  // Set by createReport. Only this fixed key is read, so the page never shows
  // text from the URL.
  const { notice } = await searchParams;
  const privateDetailsNotSaved = report.isOwner && notice === "private-details-not-saved";

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10">
      {privateDetailsNotSaved && (
        <FormMessage kind="error">{PRIVATE_DETAILS_NOT_SAVED_MESSAGE}</FormMessage>
      )}
      <ItemDetails report={report} />
    </main>
  );
}
