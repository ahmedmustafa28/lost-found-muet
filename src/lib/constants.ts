// Single source for values that the database also enforces with check
// constraints. If you change one here, change the database in a migration
// too (DEVELOPMENT.md section 9).

// ---------- Item reports ----------

export const REPORT_TYPES = ["lost", "found"] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

export const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  lost: "Lost",
  found: "Found",
};

export const REPORT_STATUSES = [
  "active",
  "resolved",
  "closed",
  "hidden",
] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  active: "Active",
  resolved: "Resolved",
  closed: "Closed",
  hidden: "Hidden",
};

export const CATEGORIES = [
  "id_card",
  "wallet",
  "keys",
  "phone",
  "electronics",
  "books",
  "stationery",
  "bag",
  "clothing",
  "water_bottle",
  "other",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  id_card: "ID card",
  wallet: "Wallet",
  keys: "Keys",
  phone: "Phone",
  electronics: "Electronics",
  books: "Books",
  stationery: "Stationery",
  bag: "Bag",
  clothing: "Clothing",
  water_bottle: "Water bottle",
  other: "Other",
};

// ---------- Claims ----------

// `ownership` is "This is mine" on a found report; `found_match` is
// "I found this" on a lost report. The database sets it, never the client.
export const CLAIM_TYPES = ["ownership", "found_match"] as const;
export type ClaimType = (typeof CLAIM_TYPES)[number];

export const CLAIM_TYPE_LABELS: Record<ClaimType, string> = {
  ownership: "This is mine",
  found_match: "I found this",
};

export const CLAIM_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "cancelled",
  "closed",
] as const;
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

export const CLAIM_STATUS_LABELS: Record<ClaimStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  cancelled: "Cancelled",
  closed: "Closed",
};

// ---------- Abuse reports ----------

export const ABUSE_REASONS = [
  "sensitive_info",
  "fake_or_spam",
  "offensive",
  "scam",
  "other",
] as const;
export type AbuseReason = (typeof ABUSE_REASONS)[number];

export const ABUSE_REASON_LABELS: Record<AbuseReason, string> = {
  sensitive_info: "Shows sensitive information",
  fake_or_spam: "Fake or spam",
  offensive: "Offensive",
  scam: "Scam",
  other: "Other",
};

export const ABUSE_REPORT_STATUSES = [
  "open",
  "reviewing",
  "actioned",
  "dismissed",
] as const;
export type AbuseReportStatus = (typeof ABUSE_REPORT_STATUSES)[number];

export const ABUSE_REPORT_STATUS_LABELS: Record<AbuseReportStatus, string> = {
  open: "Open",
  reviewing: "Reviewing",
  actioned: "Actioned",
  dismissed: "Dismissed",
};

// ---------- Limits ----------

// Text lengths in characters; the database check constraints must match.
export const TEXT_LIMITS = {
  fullName: { min: 2, max: 80 }, // profiles.full_name
  title: { min: 3, max: 80 }, // item_reports.title
  description: { min: 10, max: 1000 }, // item_reports.description
  locationDetail: { min: 0, max: 120 }, // item_reports.location_detail
  privateDetails: { min: 1, max: 500 }, // item_private_details.details
  claimMessage: { min: 10, max: 1000 }, // claims.message
  handoverNote: { min: 5, max: 500 }, // claims.handover_note
  abuseDetails: { min: 0, max: 1000 }, // abuse_reports.details
} as const;

// "Today" and date checks use Pakistan time, whatever the server's zone.
export const APP_TIME_ZONE = "Asia/Karachi";

// item_reports.event_date: not after today, not more than this many days ago.
export const EVENT_DATE_MAX_DAYS_AGO = 365;

export const IMAGE_ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
export type ImageType = (typeof IMAGE_ALLOWED_TYPES)[number];

export const IMAGE_EXTENSIONS: Record<ImageType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const IMAGE_MAX_BYTES = 5 * 1024 * 1024; // 5 MB

// ---------- Errors ----------

// Codes raised by the database functions (DEVELOPMENT.md section 9.10).
export const ERROR_CODES = [
  "NOT_SIGNED_IN",
  "NOT_ALLOWED",
  "NOT_FOUND",
  "ITEM_NOT_ACTIVE",
  "OWN_ITEM",
  "DUPLICATE_CLAIM",
  "ALREADY_APPROVED",
  "INVALID_STATUS",
  "INVALID_INPUT",
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  NOT_SIGNED_IN: "Please sign in to continue.",
  NOT_ALLOWED: "You don't have permission to do this.",
  NOT_FOUND: "We couldn't find that. It may have been removed.",
  ITEM_NOT_ACTIVE: "This report is no longer active.",
  OWN_ITEM: "You can't claim your own report.",
  DUPLICATE_CLAIM: "You already have an open claim on this report.",
  ALREADY_APPROVED: "Another claim on this report has already been approved.",
  INVALID_STATUS: "This action isn't possible right now. Refresh the page and try again.",
  INVALID_INPUT: "Some details are missing or too long. Check the form and try again.",
};

// Shown for any error without a known code, so raw database errors never
// reach the user.
export const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";
