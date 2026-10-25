import type { Category, ReportStatus, ReportType } from "@/lib/constants";
import { IMAGE_BUCKET, IMAGE_SIGNED_URL_SECONDS } from "@/lib/constants";
import { getSignedInUserId } from "@/lib/auth/getSignedInUserId";
import { createClient } from "@/lib/supabase/server";

// Reads for Server Components. RLS decides what each viewer can see
// (DEVELOPMENT.md 9.12); these only shape the rows for the pages. A failed
// read throws, so the route's error.tsx shows a friendly message.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type LocationOption = { key: string; label: string };

// The RLS policy also lets admins read retired locations, which the
// validate_item_report trigger rejects, so filter them here too.
export async function getActiveLocations(): Promise<LocationOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("campus_locations")
    .select("key, label")
    .eq("is_active", true)
    .order("sort_order")
    .order("label");
  if (error) throw new Error("Could not load campus locations.");
  return data;
}

// Never includes who reported the item: user_id is read only to decide
// isOwner, here on the server (DEVELOPMENT.md D-08).
export type ReportView = {
  id: string;
  reportType: ReportType;
  title: string;
  description: string;
  category: Category;
  // Null when the location has been retired: only admins can read those.
  locationLabel: string | null;
  locationDetail: string | null;
  eventDate: string;
  status: ReportStatus;
  imageUrl: string | null;
  isOwner: boolean;
  // Only ever set for the owner.
  privateDetails: string | null;
};

// Null when the report doesn't exist or the viewer isn't allowed to see it.
export async function getReport(id: string): Promise<ReportView | null> {
  if (!UUID.test(id)) return null;

  const supabase = await createClient();
  const userId = await getSignedInUserId(supabase);
  const { data: row, error } = await supabase
    .from("item_reports")
    .select(
      "id, user_id, report_type, title, description, category, location_detail, event_date, status, image_path, campus_locations ( label )",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("Could not load the report.");
  if (!row) return null;

  const isOwner = userId !== null && row.user_id === userId;

  let imageUrl: string | null = null;
  if (row.image_path) {
    const { data } = await supabase.storage
      .from(IMAGE_BUCKET)
      .createSignedUrl(row.image_path, IMAGE_SIGNED_URL_SECONDS);
    // Without a URL the page simply shows no photo.
    imageUrl = data?.signedUrl ?? null;
  }

  let privateDetails: string | null = null;
  if (isOwner) {
    const { data, error: detailsError } = await supabase
      .from("item_private_details")
      .select("details")
      .eq("item_id", id)
      .maybeSingle();
    if (detailsError) throw new Error("Could not load the private details.");
    privateDetails = data?.details ?? null;
  }

  return {
    id: row.id,
    reportType: row.report_type as ReportType,
    title: row.title,
    description: row.description,
    category: row.category as Category,
    locationLabel: row.campus_locations?.label ?? null,
    locationDetail: row.location_detail,
    eventDate: row.event_date,
    status: row.status as ReportStatus,
    imageUrl,
    isOwner,
    privateDetails,
  };
}

export type MyReport = {
  id: string;
  title: string;
  reportType: ReportType;
  status: ReportStatus;
  eventDate: string;
};

// RLS also returns other people's active reports, so filter by owner.
export async function getMyReports(userId: string): Promise<MyReport[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("item_reports")
    .select("id, title, report_type, status, event_date")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error("Could not load your reports.");
  return data.map((row) => ({
    id: row.id,
    title: row.title,
    reportType: row.report_type as ReportType,
    status: row.status as ReportStatus,
    eventDate: row.event_date,
  }));
}
