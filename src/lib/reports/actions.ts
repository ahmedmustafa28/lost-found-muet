"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionFailure, FormAction } from "@/lib/actionResult";
import { getSignedInUserId } from "@/lib/auth/getSignedInUserId";
import {
  ERROR_MESSAGES,
  GENERIC_ERROR_MESSAGE,
  IMAGE_BUCKET,
  PRIVATE_DETAILS_CANNOT_REMOVE,
  REPORT_ALREADY_ENDED_MESSAGE,
} from "@/lib/constants";
import { dbErrorCode, dbErrorMessage } from "@/lib/dbErrorMessage";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/uuid";
import { fieldErrorsOf } from "@/lib/validation/auth";
import {
  editReportSchema,
  imagePathSchema,
  photoChangeSchema,
  reportSchema,
} from "@/lib/validation/report";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

const PHOTO_NOT_SAVED = "The photo couldn't be saved. Please choose it again.";
const PRIVATE_DETAILS_NOT_SAVED = "?notice=private-details-not-saved";

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
    await removeImage(supabase, imagePath);
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
    await removeImage(supabase, imagePath);
    return error ? writeFailure(error) : { ok: false, error: GENERIC_ERROR_MESSAGE };
  }

  // A separate insert, so it can fail after the report is saved. The report
  // is kept and its page says so (DEVELOPMENT.md 8.3).
  let notice = "";
  if (input.privateDetails) {
    const { error: detailsError } = await supabase
      .from("item_private_details")
      .insert({ item_id: report.id, details: input.privateDetails });
    if (detailsError) notice = PRIVATE_DETAILS_NOT_SAVED;
  }

  revalidatePath("/dashboard");
  redirect(`/items/${report.id}${notice}`);
};

// Edits the owner's active report. The type can't change (there is no
// update grant on report_type). The photo follows DEVELOPMENT.md 11.1: the
// browser uploads a new one first, this updates image_path, and only then is
// the old file deleted, so the report always points to a file that exists.
export const updateReport: FormAction = async (_previous, formData) => {
  const supabase = await createClient();
  const userId = await getSignedInUserId(supabase);
  if (!userId) return { ok: false, error: ERROR_MESSAGES.NOT_SIGNED_IN };

  const image = imagePathSchema(userId).safeParse(formData.get("imagePath") ?? undefined);
  if (!image.success) {
    return { ok: false, fieldErrors: { photo: [PHOTO_NOT_SAVED] } };
  }
  const newImagePath = image.data;

  // From here on, any failure deletes the new upload: no report points to it.
  const fail = async (failure: ActionFailure): Promise<ActionFailure> => {
    await removeImage(supabase, newImagePath);
    return failure;
  };

  const id = formData.get("id");
  if (!isUuid(id)) return fail({ ok: false, error: ERROR_MESSAGES.NOT_FOUND });

  const photo = photoChangeSchema.safeParse(formData.get("photoChange"));
  if (!photo.success || (photo.data === "replace") !== (newImagePath !== null)) {
    return fail({ ok: false, fieldErrors: { photo: [PHOTO_NOT_SAVED] } });
  }

  const { data: current, error: readError } = await supabase
    .from("item_reports")
    .select("user_id, status, event_date, image_path")
    .eq("id", id)
    .maybeSingle();
  if (readError) return fail({ ok: false, error: GENERIC_ERROR_MESSAGE });
  if (!current || current.user_id !== userId) {
    return fail({ ok: false, error: ERROR_MESSAGES.NOT_FOUND });
  }
  if (current.status !== "active") {
    return fail({ ok: false, error: ERROR_MESSAGES.ITEM_NOT_ACTIVE });
  }

  const parsed = editReportSchema(current.event_date).safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return fail({ ok: false, fieldErrors: fieldErrorsOf(parsed.error) });
  }
  const input = parsed.data;

  // Checked before anything is written, so a refused removal changes nothing.
  const { data: savedDetails, error: detailsReadError } = await supabase
    .from("item_private_details")
    .select("item_id")
    .eq("item_id", id)
    .maybeSingle();
  if (detailsReadError) return fail({ ok: false, error: GENERIC_ERROR_MESSAGE });
  if (savedDetails && !input.privateDetails) {
    return fail({ ok: false, fieldErrors: { privateDetails: [PRIVATE_DETAILS_CANNOT_REMOVE] } });
  }

  // The update returns the row, so zero rows (the report was closed in the
  // meantime, so RLS skipped it) counts as a failure.
  const { data: updated, error } = await supabase
    .from("item_reports")
    .update({
      title: input.title,
      category: input.category,
      location_key: input.locationKey,
      location_detail: input.locationDetail,
      description: input.description,
      event_date: input.eventDate,
      ...(photo.data === "keep" ? {} : { image_path: newImagePath }),
    })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) return fail(writeFailure(error));
  if (!updated) return fail({ ok: false, error: ERROR_MESSAGES.ITEM_NOT_ACTIVE });

  // The report no longer points to the old photo, so it can be deleted now.
  if (photo.data !== "keep") await removeImage(supabase, current.image_path);

  // Users can't change item_id, so this is an update or an insert, not an
  // upsert (which would also write item_id).
  let notice = "";
  if (input.privateDetails) {
    const { error: detailsError } = savedDetails
      ? await supabase
          .from("item_private_details")
          .update({ details: input.privateDetails })
          .eq("item_id", id)
      : await supabase
          .from("item_private_details")
          .insert({ item_id: id, details: input.privateDetails });
    if (detailsError) notice = PRIVATE_DETAILS_NOT_SAVED;
  }

  revalidatePath(`/items/${id}`);
  revalidatePath("/dashboard");
  redirect(`/items/${id}${notice}`);
};

// active → closed through close_report(), which checks the caller and the
// status itself (DEVELOPMENT.md 8.6, 9.10).
export const closeReport: FormAction = async (_previous, formData) => {
  const id = formData.get("id");
  if (!isUuid(id)) return { ok: false, error: ERROR_MESSAGES.NOT_FOUND };

  const supabase = await createClient();
  const { error } = await supabase.rpc("close_report", { p_item_id: id });
  if (error) {
    return {
      ok: false,
      error:
        dbErrorCode(error) === "INVALID_STATUS"
          ? REPORT_ALREADY_ENDED_MESSAGE
          : dbErrorMessage(error),
    };
  }

  revalidateAfterStatusChange();
  redirect(`/items/${id}`);
};

// active → resolved ("Returned" in the UI) through resolve_report(), which
// checks the caller and the status itself. It works with or without an
// approved claim; pending claims are closed and an approved one stays
// approved (DEVELOPMENT.md 8.6, 9.10).
export const resolveReport: FormAction = async (_previous, formData) => {
  const id = formData.get("id");
  if (!isUuid(id)) return { ok: false, error: ERROR_MESSAGES.NOT_FOUND };

  const supabase = await createClient();
  const { error } = await supabase.rpc("resolve_report", { p_item_id: id });
  if (error) {
    return {
      ok: false,
      error:
        dbErrorCode(error) === "INVALID_STATUS"
          ? REPORT_ALREADY_ENDED_MESSAGE
          : dbErrorMessage(error),
    };
  }

  revalidateAfterStatusChange();
  redirect(`/items/${id}`);
};

// Ending a report changes its page, the lists, the dashboard, its claims'
// pages and the header's review count (in the root layout), so everything
// under the root layout is refreshed.
function revalidateAfterStatusChange() {
  revalidatePath("/", "layout");
}

// validate_item_report raises INVALID_INPUT with the field in the detail
// (DEVELOPMENT.md 9.11), so these show next to the right field.
function writeFailure(error: { message?: string; details?: string }): ActionFailure {
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

// Deletes a photo no report points to: an upload whose report wasn't saved,
// or a photo that was just replaced or removed. Storage gives no error when a
// policy blocks a delete (for example, if a report still points to the
// file), so the result isn't checked; files left behind are a P1 clean-up
// item.
async function removeImage(supabase: ServerClient, path: string | null) {
  if (path) await supabase.storage.from(IMAGE_BUCKET).remove([path]);
}
