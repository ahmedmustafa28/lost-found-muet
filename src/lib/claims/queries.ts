import type { ClaimStatus, ClaimType, ReportStatus, ReportType } from "@/lib/constants";
import { DEFAULT_FULL_NAME } from "@/lib/constants";
import { getSignedInUserId } from "@/lib/auth/getSignedInUserId";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/uuid";

// Reads for Server Components. RLS decides what each viewer can see
// (DEVELOPMENT.md 9.12): claims are readable by the claimant, the report
// owner and admins. A failed read throws, so the route's error.tsx shows a
// friendly message.

// The claim's report as the viewer may see it. The embedded report is null
// when RLS hides it, for example after a claim on a closed report was
// rejected (DEVELOPMENT.md 8.7).
type ClaimReport = {
  id: string;
  title: string;
  reportType: ReportType;
  status: ReportStatus;
};

// The caller's pending or approved claim on a report, if any. Admins can read
// every claim, so the claimant filter is needed, not just safe. The database
// allows at most one open claim per person per report.
export async function getOpenClaimId(itemId: string, userId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("claims")
    .select("id")
    .eq("item_id", itemId)
    .eq("claimant_id", userId)
    .in("status", ["pending", "approved"])
    .maybeSingle();
  if (error) throw new Error("Could not load your claim.");
  return data?.id ?? null;
}

// The other person in an approved claim, from get_claim_contact()
// (DEVELOPMENT.md D-03). "unavailable" when the call failed: the page says so
// rather than failing as a whole.
export type ClaimContact =
  | { status: "loaded"; fullName: string; email: string | null }
  | { status: "unavailable" };

// Never includes who made the claim or who posted the report: claimant_id and
// the report's user_id are read only to decide the viewer's role, here on the
// server.
export type ClaimView = {
  id: string;
  claimType: ClaimType;
  status: ClaimStatus;
  message: string;
  createdAt: string;
  isClaimant: boolean;
  isReportOwner: boolean;
  report: ClaimReport | null;
  // Only for the claimant and the report owner, and only while approved.
  handoverNote: string | null;
  contact: ClaimContact | null;
  // Only ever set for the report owner.
  privateDetails: string | null;
  // The report's approved claim when it is another one; only for the owner
  // of a pending claim (DEVELOPMENT.md 8.7: one approved claim per report).
  otherApprovedClaimId: string | null;
};

// Null when the claim doesn't exist or the viewer isn't allowed to see it.
export async function getClaim(id: string): Promise<ClaimView | null> {
  if (!isUuid(id)) return null;

  const supabase = await createClient();
  const userId = await getSignedInUserId(supabase);
  if (!userId) return null;

  const { data: row, error } = await supabase
    .from("claims")
    .select(
      "id, item_id, claimant_id, claim_type, status, message, handover_note, created_at, item_reports ( id, user_id, title, report_type, status )",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("Could not load the claim.");
  if (!row) return null;

  const report = row.item_reports;
  const isClaimant = row.claimant_id === userId;
  const isReportOwner = report !== null && report.user_id === userId;
  // Admins can read the claim but aren't a party to it.
  const isParty = isClaimant || isReportOwner;
  const approved = row.status === "approved";

  const [privateDetails, otherApprovedClaimId, contact] = await Promise.all([
    isReportOwner ? getPrivateDetails(row.item_id) : null,
    isReportOwner && row.status === "pending" ? getApprovedClaimId(row.item_id) : null,
    isParty && approved ? getContact(id) : null,
  ]);

  return {
    id: row.id,
    claimType: row.claim_type as ClaimType,
    status: row.status as ClaimStatus,
    message: row.message,
    createdAt: row.created_at,
    isClaimant,
    isReportOwner,
    report: report && {
      id: report.id,
      title: report.title,
      reportType: report.report_type as ReportType,
      status: report.status as ReportStatus,
    },
    handoverNote: isParty && approved ? row.handover_note : null,
    contact,
    privateDetails,
    otherApprovedClaimId,
  };
}

async function getPrivateDetails(itemId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("item_private_details")
    .select("details")
    .eq("item_id", itemId)
    .maybeSingle();
  if (error) throw new Error("Could not load the private details.");
  return data?.details ?? null;
}

async function getApprovedClaimId(itemId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("claims")
    .select("id")
    .eq("item_id", itemId)
    .eq("status", "approved")
    .maybeSingle();
  if (error) throw new Error("Could not load the report's claims.");
  return data?.id ?? null;
}

// The result is never logged: it holds a name and an email.
async function getContact(claimId: string): Promise<ClaimContact> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_claim_contact", { p_claim_id: claimId });
  const contact = data?.[0];
  if (error || !contact) return { status: "unavailable" };
  return {
    status: "loaded",
    // The profile join can come back empty; the trigger gives the same name.
    fullName: contact.full_name || DEFAULT_FULL_NAME,
    email: contact.email || null,
  };
}

export type MyClaim = {
  id: string;
  claimType: ClaimType;
  status: ClaimStatus;
  createdAt: string;
  // Both null when the viewer can no longer see the report.
  reportTitle: string | null;
  reportStatus: ReportStatus | null;
};

// RLS also returns claims on the user's own reports, so filter by claimant.
export async function getMyClaims(userId: string): Promise<MyClaim[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("claims")
    .select("id, claim_type, status, created_at, item_reports ( title, status )")
    .eq("claimant_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error("Could not load your claims.");
  return data.map((row) => ({
    id: row.id,
    claimType: row.claim_type as ClaimType,
    status: row.status as ClaimStatus,
    createdAt: row.created_at,
    reportTitle: row.item_reports?.title ?? null,
    reportStatus: (row.item_reports?.status as ReportStatus | undefined) ?? null,
  }));
}

// One row in the owner's Claims list on the item page. Never includes who
// made the claim.
export type ReportClaim = {
  id: string;
  claimType: ClaimType;
  status: ClaimStatus;
  createdAt: string;
};

// Every claim on a report, newest first. Only called for the report owner;
// RLS would also return them to an admin.
export async function getReportClaims(itemId: string): Promise<ReportClaim[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("claims")
    .select("id, claim_type, status, created_at")
    .eq("item_id", itemId)
    .order("created_at", { ascending: false });
  if (error) throw new Error("Could not load the claims.");
  return data.map((row) => ({
    id: row.id,
    claimType: row.claim_type as ClaimType,
    status: row.status as ClaimStatus,
    createdAt: row.created_at,
  }));
}

export type ClaimToReview = {
  id: string;
  claimType: ClaimType;
  createdAt: string;
  reportTitle: string;
};

// Pending claims on the user's own active reports, oldest first so nobody
// waits longest. Admins can read every claim, so the owner filter on the
// joined report is needed, not just safe.
export async function getClaimsToReview(userId: string): Promise<ClaimToReview[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("claims")
    .select("id, claim_type, created_at, item_reports!inner ( title, user_id, status )")
    .eq("status", "pending")
    .eq("item_reports.user_id", userId)
    .eq("item_reports.status", "active")
    .order("created_at", { ascending: true });
  if (error) throw new Error("Could not load the claims waiting for your review.");
  return data.map((row) => ({
    id: row.id,
    claimType: row.claim_type as ClaimType,
    createdAt: row.created_at,
    reportTitle: row.item_reports.title,
  }));
}

// The same claims as getClaimsToReview, counted for the header. Null if the
// count fails: the header then shows no number rather than an error page.
export async function countClaimsToReview(userId: string): Promise<number | null> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("claims")
    .select("id, item_reports!inner ( user_id, status )", { count: "exact", head: true })
    .eq("status", "pending")
    .eq("item_reports.user_id", userId)
    .eq("item_reports.status", "active");
  if (error) return null;
  return count;
}
