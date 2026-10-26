import {
  CLAIM_STATUS_TEXT,
  CLAIMANT_REOPENED_FOUND_MATCH,
  type ClaimStatus,
  type ClaimStatusText,
  type ClaimType,
  type ClaimViewer,
  type ReportStatus,
} from "@/lib/constants";

// The words for a claim's status, from the viewer's side. reportStatus is
// null when the viewer can't see the report (DEVELOPMENT.md 8.7).
export function claimStatusText(
  status: ClaimStatus,
  viewer: ClaimViewer,
  reportStatus: ReportStatus | null,
  claimType: ClaimType,
): ClaimStatusText {
  const texts = CLAIM_STATUS_TEXT[viewer];
  // resolve_report() keeps the approved claim approved; close_report() and
  // admin_hide_report() close it, so no other report status applies here.
  if (status === "approved" && reportStatus === "resolved") return texts.approvedReturned;
  if (status === "closed") {
    switch (reportStatus) {
      case "resolved":
        return texts.closedReturned;
      case "closed":
        return texts.closedReportClosed;
      case "hidden":
        return texts.closedHidden;
      // Only admin_restore_report() makes a report with closed claims
      // active again; restoring doesn't reopen them (DEVELOPMENT.md 8.6).
      case "active":
        return viewer === "claimant" && claimType === "found_match"
          ? CLAIMANT_REOPENED_FOUND_MATCH
          : texts.closedReopened;
    }
  }
  return texts[status];
}
