import type { Category, ReportStatus, ReportType } from "@/lib/constants";
import {
  IMAGE_BUCKET,
  IMAGE_LIST_SIGNED_URL_SECONDS,
  IMAGE_SIGNED_URL_SECONDS,
} from "@/lib/constants";
import { getSignedInUserId } from "@/lib/auth/getSignedInUserId";
import type { ListFilters } from "@/lib/reports/listParams";
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

// One card in a list (ItemCard). Never includes who reported the item.
export type ItemSummary = {
  id: string;
  reportType: ReportType;
  title: string;
  category: Category;
  locationLabel: string | null;
  locationDetail: string | null;
  eventDate: string;
  imageUrl: string | null;
};

type ListOptions = {
  // Null for both types (the home page).
  reportType: ReportType | null;
  filters?: Pick<ListFilters, "q" | "category" | "location">;
  limit: number;
};

// ilike pattern for "contains this text": LIKE's own wildcards and its
// escape character are escaped, so they match literally (DEVELOPMENT.md 9.3).
function containsPattern(text: string): string {
  return `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

// A value inside PostgREST's or=(...) filter. Commas, dots and brackets would
// end the value, so it is quoted, with \ and " escaped inside the quotes.
function filterValue(value: string): string {
  return `"${value.replace(/[\\"]/g, (c) => `\\${c}`)}"`;
}

// Active reports only, newest first. RLS also lets signed-in users read their
// own closed reports, so the status filter is needed here, not just safe.
export async function listActiveReports({
  reportType,
  filters,
  limit,
}: ListOptions): Promise<{ items: ItemSummary[]; hasMore: boolean }> {
  const supabase = await createClient();
  let query = supabase
    .from("item_reports")
    .select(
      "id, report_type, title, category, location_detail, event_date, image_path, campus_locations ( label )",
    )
    .eq("status", "active");
  if (reportType) query = query.eq("report_type", reportType);
  if (filters?.category) query = query.eq("category", filters.category);
  if (filters?.location) query = query.eq("location_key", filters.location);
  if (filters?.q) {
    const pattern = filterValue(containsPattern(filters.q));
    query = query.or(`title.ilike.${pattern},description.ilike.${pattern}`);
  }

  // One extra row says whether there is more to load.
  const { data, error } = await query
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1);
  if (error) throw new Error("Could not load the reports.");

  const rows = data.slice(0, limit);
  const imageUrls = await signImages(
    rows.flatMap((row) => (row.image_path ? [row.image_path] : [])),
  );

  return {
    hasMore: data.length > limit,
    items: rows.map((row) => ({
      id: row.id,
      reportType: row.report_type as ReportType,
      title: row.title,
      category: row.category as Category,
      locationLabel: row.campus_locations?.label ?? null,
      locationDetail: row.location_detail,
      eventDate: row.event_date,
      imageUrl: row.image_path ? (imageUrls.get(row.image_path) ?? null) : null,
    })),
  };
}

// One Storage call for a whole page of photos (DEVELOPMENT.md 18). A photo
// that can't be signed is left out and its card shows "No photo".
async function signImages(paths: string[]): Promise<Map<string, string>> {
  const urls = new Map<string, string>();
  if (paths.length === 0) return urls;
  const supabase = await createClient();
  const { data } = await supabase.storage
    .from(IMAGE_BUCKET)
    .createSignedUrls(paths, IMAGE_LIST_SIGNED_URL_SECONDS);
  for (const entry of data ?? []) {
    if (!entry.error && entry.path && entry.signedUrl) urls.set(entry.path, entry.signedUrl);
  }
  return urls;
}
