import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FormMessage } from "@/components/forms/FormMessage";
import { ReportForm } from "@/components/items/ReportForm";
import { NarrowPage } from "@/components/layout/NarrowPage";
import { getSignedInUserId } from "@/lib/auth/getSignedInUserId";
import { eventDateRange, todayInKarachi } from "@/lib/dates";
import { getActiveLocations } from "@/lib/reports/queries";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Report an item" };

export default async function ReportPage() {
  const supabase = await createClient();
  const userId = await getSignedInUserId(supabase);
  if (!userId) redirect("/login");

  const locations = await getActiveLocations();
  const today = todayInKarachi();
  const { min } = eventDateRange(today);

  return (
    <NarrowPage title="Report an item">
      {locations.length === 0 ? (
        <FormMessage kind="error">
          Reporting isn&apos;t available yet because no campus locations are set
          up. Please try again later.
        </FormMessage>
      ) : (
        <ReportForm userId={userId} locations={locations} today={today} minDate={min} />
      )}
    </NarrowPage>
  );
}
