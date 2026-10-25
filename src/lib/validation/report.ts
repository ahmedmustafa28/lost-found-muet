import * as z from "zod";
import {
  CATEGORIES,
  EVENT_DATE_MAX_DAYS_AGO,
  IMAGE_UPLOAD_EXTENSION,
  REPORT_TYPES,
  TEXT_LIMITS,
} from "@/lib/constants";
import { eventDateRange, isValidDate } from "@/lib/dates";
import { text } from "@/lib/validation/text";

// Used in the browser for instant errors and again in the Server Action. The
// database checks the same limits (trimmed) and the same date range.
// There is no user_id or status here: the database sets both.

const requiredText = (
  limits: { min: number; max: number },
  tooShort: string,
) =>
  text()
    .trim()
    .min(limits.min, tooShort)
    .max(limits.max, `Use ${limits.max} characters or fewer.`);

// Empty means "not given", saved as null (or, for private details, no row).
const optionalText = (max: number) =>
  text()
    .trim()
    .max(max, `Use ${max} characters or fewer.`)
    .optional()
    .transform((value) => value || null);

// When editing, the report's saved date is accepted even if it is now more
// than EVENT_DATE_MAX_DAYS_AGO days old, as validate_item_report only checks
// the date when it changes.
const eventDateSchema = (unchanged?: string) =>
  text()
    .trim()
    .refine(isValidDate, { error: "Enter the date.", abort: true })
    .refine((date) => date === unchanged || date <= eventDateRange().max, {
      error: "The date can't be after today.",
    })
    .refine((date) => date === unchanged || date >= eventDateRange().min, {
      error: `The date can't be more than ${EVENT_DATE_MAX_DAYS_AGO} days ago.`,
    });

export const reportSchema = z.object({
  reportType: z.enum(REPORT_TYPES, { error: "Choose lost or found." }),
  title: requiredText(
    TEXT_LIMITS.title,
    `Enter a title (at least ${TEXT_LIMITS.title.min} characters).`,
  ),
  category: z.enum(CATEGORIES, { error: "Choose a category." }),
  locationKey: text().trim().min(1, "Choose a location."),
  locationDetail: optionalText(TEXT_LIMITS.locationDetail.max),
  description: requiredText(
    TEXT_LIMITS.description,
    `Enter a description (at least ${TEXT_LIMITS.description.min} characters).`,
  ),
  eventDate: eventDateSchema(),
  privateDetails: optionalText(TEXT_LIMITS.privateDetails.max),
});

export type ReportInput = z.output<typeof reportSchema>;

// Editing: the same fields without the type, which can't change.
export function editReportSchema(savedEventDate: string) {
  return reportSchema
    .omit({ reportType: true })
    .extend({ eventDate: eventDateSchema(savedEventDate) });
}

// What to do with the photo when saving an edit (DEVELOPMENT.md 11.1).
export const PHOTO_CHANGES = ["keep", "replace", "remove"] as const;
export type PhotoChange = (typeof PHOTO_CHANGES)[number];
export const photoChangeSchema = z.enum(PHOTO_CHANGES);

// The path the browser uploaded the photo to: <user_id>/<uuid>.jpg in the
// signed-in user's own folder. Checked against the session's user id, never
// one sent by the form; the storage policies and validate_item_report check
// it again.
export function imagePathSchema(userId: string) {
  const uuid = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
  const pattern = new RegExp(`^${userId}/${uuid}\\.${IMAGE_UPLOAD_EXTENSION}$`);
  return z
    .union([z.literal(""), z.string().regex(pattern)])
    .optional()
    .transform((value) => value || null);
}
