import type { ClaimStatus, ClaimType, ReportStatus, ReportType } from "@/lib/constants";
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

const CLAIM_REPORT_COLUMNS = "item_reports ( id, title, report_type, status )";

function toClaimReport(
  row: { id: string; title: string; report_type: string; status: string } | null,
): ClaimReport | null {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    reportType: row.report_type as ReportType,
    status: row.status as ReportStatus,
  };
}

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

// Never includes who made the claim: claimant_id is read only to decide
// isClaimant, here on the server.
export type ClaimView = {
  id: string;
  claimType: ClaimType;
  status: ClaimStatus;
  message: string;
  createdAt: string;
  isClaimant: boolean;
  report: ClaimReport | null;
};

// Null when the claim doesn't exist or the viewer isn't allowed to see it.
export async function getClaim(id: string): Promise<ClaimView | null> {
  if (!isUuid(id)) return null;

  const supabase = await createClient();
  const userId = await getSignedInUserId(supabase);
  if (!userId) return null;

  const { data: row, error } = await supabase
    .from("claims")
    .select(`id, claimant_id, claim_type, status, message, created_at, ${CLAIM_REPORT_COLUMNS}`)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("Could not load the claim.");
  if (!row) return null;

  return {
    id: row.id,
    claimType: row.claim_type as ClaimType,
    status: row.status as ClaimStatus,
    message: row.message,
    createdAt: row.created_at,
    isClaimant: row.claimant_id === userId,
    report: toClaimReport(row.item_reports),
  };
}

export type MyClaim = {
  id: string;
  claimType: ClaimType;
  status: ClaimStatus;
  createdAt: string;
  // Null when the viewer can no longer see the report.
  reportTitle: string | null;
};

// RLS also returns claims on the user's own reports, so filter by claimant.
export async function getMyClaims(userId: string): Promise<MyClaim[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("claims")
    .select(`id, claim_type, status, created_at, ${CLAIM_REPORT_COLUMNS}`)
    .eq("claimant_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error("Could not load your claims.");
  return data.map((row) => ({
    id: row.id,
    claimType: row.claim_type as ClaimType,
    status: row.status as ClaimStatus,
    createdAt: row.created_at,
    reportTitle: row.item_reports?.title ?? null,
  }));
}
