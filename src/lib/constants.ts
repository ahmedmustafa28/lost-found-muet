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
  // "Resolved" means the item was returned (DEVELOPMENT.md 8.6); the UI
  // always calls it "Returned".
  resolved: "Returned",
  closed: "Closed",
  hidden: "Hidden",
};

// Shown on the item page to anyone who can still see a report that isn't
// active.
export const REPORT_STATUS_NOTICES: Record<Exclude<ReportStatus, "active">, string> = {
  resolved: "This item has been returned.",
  closed: "This report is closed.",
  hidden: "This report has been hidden by an admin.",
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

// What a claim's status means and what happens next, in words
// (DEVELOPMENT.md 8.7). `long` is for the claim page, `short` for lists.
// Picked by claimStatusText() in src/lib/claims/statusText.ts: approved and
// closed claims also depend on the report's status. The claimant of a closed
// claim can't see the report any more, so their text doesn't say why it
// ended.
export type ClaimViewer = "claimant" | "owner";
export type ClaimStatusCase =
  | ClaimStatus
  | "approvedReturned"
  | "closedReturned"
  | "closedReportClosed"
  | "closedHidden"
  // An admin hid the report (closing its claims), then restored it.
  | "closedReopened";
export type ClaimStatusText = { long: string; short: string };

const RETURNED_WITH_CLAIM: ClaimStatusText = {
  long: "The item has been marked as returned. This claim is the record of the handover, and the details below stay available.",
  short: "Item returned",
};

const CLAIMANT_CLOSED: ClaimStatusText = {
  long: "Closed because the report ended: the item was returned, or the report was closed or taken down. There's nothing more to do with this claim.",
  short: "Report ended",
};

export const CLAIM_STATUS_TEXT: Record<ClaimViewer, Record<ClaimStatusCase, ClaimStatusText>> = {
  claimant: {
    pending: {
      long: "Waiting for the person who posted the report to review it. Check back here for the result. You can cancel the claim while it's waiting.",
      short: "Waiting for review",
    },
    approved: {
      long: "Accepted. Use the details below to arrange the handover. The person who posted the report will mark the item as returned afterwards.",
      short: "Arrange the handover",
    },
    approvedReturned: RETURNED_WITH_CLAIM,
    rejected: {
      long: "This claim was declined. If the report is still active, you can send a new claim with more detail.",
      short: "Declined",
    },
    cancelled: {
      long: "You withdrew this claim. You can send a new one while the report is active.",
      short: "Withdrawn",
    },
    closed: CLAIMANT_CLOSED,
    closedReturned: CLAIMANT_CLOSED,
    closedReportClosed: CLAIMANT_CLOSED,
    closedHidden: CLAIMANT_CLOSED,
    closedReopened: {
      long: "This claim was closed when the report was hidden. The report is open again, so you can send a new claim if it's still yours.",
      short: "Closed: report reopened",
    },
  },
  owner: {
    pending: {
      long: "Waiting for your review. Compare the message with your private details, then approve or reject it.",
      short: "Needs your review",
    },
    approved: {
      long: "You approved this claim. Arrange the handover using the details below, then mark the item as returned on your report's page.",
      short: "Arrange the handover",
    },
    approvedReturned: RETURNED_WITH_CLAIM,
    rejected: {
      long: "This claim was declined. There's nothing more to do.",
      short: "Declined",
    },
    cancelled: {
      long: "The claimant withdrew this claim. There's nothing more to do.",
      short: "Withdrawn by the claimant",
    },
    closed: {
      long: "Closed automatically when the report ended. There's nothing more to do.",
      short: "Report ended",
    },
    closedReturned: {
      long: "Closed automatically when you marked the item as returned. There's nothing more to do.",
      short: "Closed: item returned",
    },
    closedReportClosed: {
      long: "Closed automatically when the report was closed. There's nothing more to do.",
      short: "Closed: report closed",
    },
    closedHidden: {
      long: "Closed because an admin hid the report. There's nothing more to do.",
      short: "Closed: report hidden",
    },
    closedReopened: {
      long: "This claim was closed when the report was hidden. The report is open again, so new claims can come in.",
      short: "Closed: report reopened",
    },
  },
};

export const HANDOVER_NOTE_HINT =
  "Where and when to meet, for example \"Library entrance, Monday 2 pm\". Choose a public place on campus.";

// Shown next to the contact details of an approved claim (DEVELOPMENT.md 6.5).
export const HANDOVER_SAFETY_TIPS = [
  "Meet in a public place on campus, during the day if you can.",
  "Never pay anyone to get an item back.",
  "Use these details only to arrange the handover.",
] as const;

// Claim form guidance (DEVELOPMENT.md 6.3, 6.4), by claim type.
export const CLAIM_MESSAGE_HINTS: Record<ClaimType, string> = {
  ownership:
    "Describe something about the item that isn't in the public description or photo, so the finder can tell it's yours.",
  found_match:
    "Say where and when you found it, and what it looks like.",
};

// Shown before submitting or approving a claim (DEVELOPMENT.md D-03, 8.4).
export const CLAIM_CONTACT_NOTICE =
  "If this claim is approved, you and the other person will see each other's name and email so you can arrange the handover.";

// Clearer wording than ERROR_MESSAGES for these codes on the claim forms.
export const CLAIM_ERROR_MESSAGES = {
  duplicate: "You've already sent a claim on this report.",
  notTakingClaims: "This report is no longer taking claims.",
  cannotCancelEnded: "This claim can't be cancelled because the report has ended.",
  alreadyEnded: "This claim is already closed.",
  reportUnavailable: "This report is no longer available.",
  alreadyApproved:
    "You've already approved another claim on this report. Reject it first if the handover didn't work out.",
  noLongerPending: "This claim is no longer pending. Refresh the page.",
  cannotReviewEnded: "This report is no longer active, so its claims can't be reviewed.",
  contactNotLoaded: "Contact details couldn't be loaded. Refresh the page.",
} as const;

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

// close_report() and resolve_report() raise INVALID_STATUS when the report
// has already ended.
export const REPORT_ALREADY_ENDED_MESSAGE =
  "This report is already closed or marked as returned.";

// Asked before resolve_report() (DEVELOPMENT.md 6.5, 8.6). "Other" only
// when a claim is approved, as that one stays open.
export const RESOLVE_REPORT_QUESTION =
  "Has this item been returned? Any pending claims will be closed.";
export const RESOLVE_REPORT_QUESTION_WITH_APPROVED =
  "Has this item been returned? Any other pending claims will be closed.";
export const RESOLVE_REPORT_KEEPS_APPROVED =
  "The approved claim stays as the record of the handover.";

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
