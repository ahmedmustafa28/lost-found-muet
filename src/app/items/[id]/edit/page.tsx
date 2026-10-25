import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReportForm } from "@/components/items/ReportForm";
import { NarrowPage } from "@/components/layout/NarrowPage";
import { getSignedInUserId } from "@/lib/auth/getSignedInUserId";
import { eventDateRange, todayInKarachi } from "@/lib/dates";
import { getActiveLocations, getReportForEdit } from "@/lib/reports/queries";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Edit report" };

// Only the owner, only while the report is active. Everyone else, signed in
// or not, gets the same "Report not found" page as a missing report, so this
// never reveals that a report exists.
export default async function EditItemPage({ params }: PageProps<"/items/[id]/edit">) {
  const { id } = await params;
  const supabase = await createClient();
  const [userId, report, locations] = await Promise.all([
    getSignedInUserId(supabase),
    getReportForEdit(id),
    getActiveLocations(),
  ]);
  if (!userId || !report) notFound();

  // A retired location can't be read by name, but the report may keep it.
  const options = locations.some((l) => l.key === report.locationKey)
    ? locations
    : [{ key: report.locationKey, label: "Current location (no longer listed)" }, ...locations];

  const today = todayInKarachi();
  const { min } = eventDateRange(today);

  return (
    <NarrowPage title="Edit report">
      <ReportForm
        mode="edit"
        report={report}
        userId={userId}
        locations={options}
        today={today}
        minDate={min}
      />
    </NarrowPage>
  );
}
