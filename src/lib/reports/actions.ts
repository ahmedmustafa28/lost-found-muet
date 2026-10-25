"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionFailure, FormAction } from "@/lib/actionResult";
import { getSignedInUserId } from "@/lib/auth/getSignedInUserId";
import { ERROR_MESSAGES, GENERIC_ERROR_MESSAGE, IMAGE_BUCKET } from "@/lib/constants";
import { dbErrorCode, dbErrorMessage } from "@/lib/dbErrorMessage";
import { createClient } from "@/lib/supabase/server";
import { fieldErrorsOf } from "@/lib/validation/auth";
import { imagePathSchema, reportSchema } from "@/lib/validation/report";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

const PHOTO_NOT_SAVED = "The photo couldn't be saved. Please choose it again.";

// The browser has already uploaded the photo (if any) to Storage and sends
// only its path (DEVELOPMENT.md 11.1). The database sets user_id and status.
export const createReport: FormAction = async (_previous, formData) => {
  const supabase = await createClient();
  const userId = await getSignedInUserId(supabase);
  if (!userId) return { ok: false, error: ERROR_MESSAGES.NOT_SIGNED_IN };

  const image = imagePathSchema(userId).safeParse(formData.get("imagePath") ?? undefined);
  if (!image.success) {
    // Not a path in this user's folder, so it isn't ours to delete.
    return { ok: false, fieldErrors: { photo: [PHOTO_NOT_SAVED] } };
  }
  const imagePath = image.data;

  const parsed = reportSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    await removeUploadedImage(supabase, imagePath);
    return { ok: false, fieldErrors: fieldErrorsOf(parsed.error) };
  }
  const input = parsed.data;

  const { data: report, error } = await supabase
    .from("item_reports")
    .insert({
      report_type: input.reportType,
      title: input.title,
      category: input.category,
      location_key: input.locationKey,
      location_detail: input.locationDetail,
      description: input.description,
      event_date: input.eventDate,
      image_path: imagePath,
    })
    .select("id")
    .single();
  if (error || !report) {
    await removeUploadedImage(supabase, imagePath);
    return error ? insertFailure(error) : { ok: false, error: GENERIC_ERROR_MESSAGE };
  }

  // A separate insert, so it can fail after the report is saved. The report
  // is kept and its page says so (DEVELOPMENT.md 8.3).
  let notice = "";
  if (input.privateDetails) {
    const { error: detailsError } = await supabase
      .from("item_private_details")
      .insert({ item_id: report.id, details: input.privateDetails });
    if (detailsError) notice = "?notice=private-details-not-saved";
  }

  revalidatePath("/dashboard");
  redirect(`/items/${report.id}${notice}`);
};

// validate_item_report raises INVALID_INPUT with the field in the detail
// (DEVELOPMENT.md 9.11), so these show next to the right field.
function insertFailure(error: { message?: string; details?: string }): ActionFailure {
  if (dbErrorCode(error) === "INVALID_INPUT") {
    switch (error.details) {
      case "event_date":
        return { ok: false, fieldErrors: { eventDate: ["Choose a date from the last year, not after today."] } };
      case "location_key":
        return { ok: false, fieldErrors: { locationKey: ["Choose a location from the list."] } };
      case "image_path":
        return { ok: false, fieldErrors: { photo: [PHOTO_NOT_SAVED] } };
    }
  }
  return { ok: false, error: dbErrorMessage(error) };
}

// If the report isn't saved, its uploaded photo would be left unused.
// Storage gives no error when a policy blocks a delete, so the result isn't
// checked; files that are left behind are a P1 clean-up item.
async function removeUploadedImage(supabase: ServerClient, path: string | null) {
  if (path) await supabase.storage.from(IMAGE_BUCKET).remove([path]);
}
