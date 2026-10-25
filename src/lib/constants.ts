// Single source for values that the database also enforces with check
// constraints. If you change one here, change the database in a migration
// too (DEVELOPMENT.md section 9).

// ---------- Accounts ----------

// Only MUET students can register (DEVELOPMENT.md D-14): a roll number at
// students.muet.edu.pk, for example 23sw016@students.muet.edu.pk. Matched
// case-insensitively.
// Kept as a string so the database's copy (private.student_email_pattern())
// can be compared with it exactly; tests/db/signupEmail.mjs fails if they
// differ.
export const STUDENT_EMAIL_PATTERN =
  "^[0-9]{2}[a-z]{2,4}[0-9]{1,3}@students\\.muet\\.edu\\.pk$";

// Also the database hook's message, so the form and the server agree.
export const STUDENT_EMAIL_MESSAGE =
  "Use your MUET student email (your roll number, for example 23sw016@students.muet.edu.pk).";

// Must match minimum_password_length in supabase/config.toml and in the
// dashboard (DEVELOPMENT.md 10.1). Supabase can't use more than 72.
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72;

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
  adminReason: { min: 1, max: 500 }, // p_reason in admin functions; admin_audit_log.reason
} as const;

// Given by the handle_new_user trigger when sign-up has no valid name (for
// example, users added in the Supabase dashboard). Must match the migration.
export const DEFAULT_FULL_NAME = "MUET user";

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

// The private Storage bucket for report photos (DEVELOPMENT.md 11.1).
export const IMAGE_BUCKET = "item-images";

// The photo someone picks may be larger than IMAGE_MAX_BYTES: phone photos
// often are. Only the re-encoded copy is uploaded, and that copy must fit
// IMAGE_MAX_BYTES (the bucket enforces it too).
export const IMAGE_ORIGINAL_MAX_BYTES = 20 * 1024 * 1024; // 20 MB

// The browser re-encodes every photo before upload: longest side at most this
// many pixels, saved as JPEG. Re-encoding drops EXIF data, including GPS.
export const IMAGE_MAX_DIMENSION = 1600;
export const IMAGE_UPLOAD_TYPE = "image/jpeg";
export const IMAGE_UPLOAD_EXTENSION = "jpg";
export const IMAGE_UPLOAD_QUALITY = 0.85;

// Signed URLs work for anyone who has them until they expire, so keep this
// short (DEVELOPMENT.md 11.1).
export const IMAGE_SIGNED_URL_SECONDS = 300;

// List photos load lazily as people scroll, often minutes after the page was
// made, so they get longer. Lists only show active, public reports; a report
// hidden later keeps a working photo link until this expires.
export const IMAGE_LIST_SIGNED_URL_SECONDS = 30 * 60;

// ---------- Lists and search ----------

// "Load more" adds this many items each time, up to LIST_MAX_PAGES pages;
// after that people narrow the list with search (DEVELOPMENT.md 18).
export const LIST_PAGE_SIZE = 20;
export const LIST_MAX_PAGES = 10;

// Recent active reports on the home page.
export const HOME_RECENT_COUNT = 6;

export const SEARCH_MAX_LENGTH = 100;

// Shown on the report form (DEVELOPMENT.md 8.3 and 11.2).
export const REPORT_SAFETY_WARNING =
  "Don't publish ID numbers, phone numbers, addresses or financial details (such as card or account numbers), in the text or in the photo. Keep the public description general.";
export const PRIVATE_DETAILS_HELP =
  "Only you and site admins can see this. Use it to check claims later, for example \"my name is written inside the front cover\". Once added, private details can't be removed, but you can change the text.";

// The database has no delete rule for private details and doesn't allow
// empty ones (DEVELOPMENT.md 9.4).
export const PRIVATE_DETAILS_CANNOT_REMOVE =
  "Private details can't be removed once added. You can change the text instead.";

// close_report() raises INVALID_STATUS when the report has already ended.
export const REPORT_ALREADY_ENDED_MESSAGE = "This report is already closed or resolved.";

// Shown to the owner on the item page when the report was saved but its
// private details weren't.
export const PRIVATE_DETAILS_NOT_SAVED_MESSAGE =
  "Your report was saved, but the private details weren't. Edit the report to add them again.";

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
  INVALID_INPUT: "Some details are missing or not valid. Check the form and try again.",
};

// Shown for any error without a known code, so raw database errors never
// reach the user.
export const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

// Supabase Auth error codes (error.code) the app expects; any other code gets
// GENERIC_ERROR_MESSAGE.
export const AUTH_ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: "Your email or password is incorrect.",
  email_not_confirmed:
    "Please confirm your email first. Check your MUET inbox for the link.",
  weak_password: "Choose a stronger password.",
  same_password: "Your new password must be different from your old one.",
  over_email_send_rate_limit:
    "Too many emails were sent. Please wait a few minutes and try again.",
  over_request_rate_limit:
    "Too many attempts. Please wait a few minutes and try again.",
  email_address_invalid: STUDENT_EMAIL_MESSAGE,
  signup_disabled: "Registration is closed at the moment.",
};

// Shown on /login when an email link can't be used.
export const AUTH_LINK_ERROR_MESSAGE =
  "This link is invalid or has expired. Please try again or request a new email.";

// The same whatever happens, so the page never reveals whether an email is
// registered.
export const PASSWORD_RESET_SENT_MESSAGE =
  "If an account exists for that email, we've sent a link to reset your password. Check your MUET inbox.";
