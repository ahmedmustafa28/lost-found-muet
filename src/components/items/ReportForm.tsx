"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChoiceField } from "@/components/forms/ChoiceField";
import { FormMessage } from "@/components/forms/FormMessage";
import { SelectField } from "@/components/forms/SelectField";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { TextAreaField } from "@/components/forms/TextAreaField";
import { TextField } from "@/components/forms/TextField";
import { useFormAction, type PrepareSubmit } from "@/components/forms/useFormAction";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  IMAGE_BUCKET,
  IMAGE_UPLOAD_EXTENSION,
  IMAGE_UPLOAD_TYPE,
  PRIVATE_DETAILS_HELP,
  REPORT_SAFETY_WARNING,
  REPORT_TYPES,
  REPORT_TYPE_LABELS,
  TEXT_LIMITS,
  type ReportType,
} from "@/lib/constants";
import { createReport, updateReport } from "@/lib/reports/actions";
import type { EditableReport, LocationOption } from "@/lib/reports/queries";
import { createClient } from "@/lib/supabase/client";
import { editReportSchema, reportSchema } from "@/lib/validation/report";
import { PhotoField, type PhotoSelection } from "./PhotoField";

type ReportFormProps = {
  // Only used to build the upload path; Storage and the database check it.
  userId: string;
  locations: LocationOption[];
  // Pakistan dates from the server: the default and the allowed range.
  today: string;
  minDate: string;
} & (
  | { mode: "create"; defaultType?: ReportType }
  // Editing: the saved report fills the form. Its type can't change.
  | { mode: "edit"; report: EditableReport }
);

const typeOptions = REPORT_TYPES.map((value) => ({ value, label: REPORT_TYPE_LABELS[value] }));
const categoryOptions = CATEGORIES.map((value) => ({ value, label: CATEGORY_LABELS[value] }));

// On success the Server Action redirects to the report's page.
export function ReportForm(props: ReportFormProps) {
  const { userId, locations, today, minDate } = props;
  const report = props.mode === "edit" ? props.report : null;
  const [photo, setPhoto] = useState<PhotoSelection>({ change: "keep" });

  // The photo goes straight from the browser to Storage, only once the form
  // is valid, then the Server Action gets its path (DEVELOPMENT.md 11.1).
  const uploadPhoto: PrepareSubmit = async (formData) => {
    formData.set("photoChange", photo.change);
    if (photo.change !== "replace") return null;
    const path = `${userId}/${crypto.randomUUID()}.${IMAGE_UPLOAD_EXTENSION}`;
    const { error } = await createClient()
      .storage.from(IMAGE_BUCKET)
      .upload(path, photo.photo, { contentType: IMAGE_UPLOAD_TYPE, upsert: false });
    if (error) {
      return {
        ok: false,
        fieldErrors: { photo: ["The photo couldn't be uploaded. Try again, or remove it."] },
      };
    }
    formData.set("imagePath", path);
    return null;
  };

  const schema = useMemo(
    () => (report ? editReportSchema(report.eventDate) : reportSchema),
    [report],
  );
  const { formAction, onSubmit, pending, error, fieldErrors } = useFormAction(
    report ? updateReport : createReport,
    schema,
    uploadPhoto,
  );

  return (
    <form action={formAction} onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <div
        role="note"
        className="rounded-md border border-amber-700 px-3 py-2 text-sm text-amber-900 dark:border-amber-400 dark:text-amber-200"
      >
        <strong>Keep it safe: </strong>
        {REPORT_SAFETY_WARNING}
      </div>
      {error && <FormMessage kind="error">{error}</FormMessage>}
      {report ? (
        <>
          <input type="hidden" name="id" value={report.id} />
          {/* Without JavaScript the form posts as is and keeps the photo.
              With it, uploadPhoto sets the real choice, replacing this. */}
          <input type="hidden" name="photoChange" value="keep" />
          <p>
            <span className="font-medium">Report type:</span>{" "}
            {REPORT_TYPE_LABELS[report.reportType]} item (this can&apos;t be changed)
          </p>
        </>
      ) : (
        <ChoiceField
          legend="Did you lose or find this item?"
          name="reportType"
          options={typeOptions}
          defaultValue={props.mode === "create" ? props.defaultType : undefined}
          required
          errors={fieldErrors.reportType}
        />
      )}
      <TextField
        label="Title"
        name="title"
        hint='A short name for the item, for example "Blue water bottle".'
        maxLength={TEXT_LIMITS.title.max}
        defaultValue={report?.title}
        required
        errors={fieldErrors.title}
      />
      <SelectField
        label="Category"
        name="category"
        placeholder="Choose a category"
        options={categoryOptions}
        defaultValue={report?.category ?? ""}
        required
        errors={fieldErrors.category}
      />
      <SelectField
        label="Location"
        name="locationKey"
        placeholder="Choose a location"
        options={locations.map(({ key, label }) => ({ value: key, label }))}
        defaultValue={report?.locationKey ?? ""}
        required
        errors={fieldErrors.locationKey}
      />
      <TextField
        label="Location detail (optional)"
        name="locationDetail"
        hint='For example "second floor, near the stairs".'
        maxLength={TEXT_LIMITS.locationDetail.max}
        defaultValue={report?.locationDetail ?? ""}
        errors={fieldErrors.locationDetail}
      />
      <TextAreaField
        label="Description"
        name="description"
        hint="Everyone can read this. Describe the item in general terms."
        maxLength={TEXT_LIMITS.description.max}
        defaultValue={report?.description}
        required
        errors={fieldErrors.description}
      />
      <TextField
        label="Date lost or found"
        name="eventDate"
        type="date"
        defaultValue={report?.eventDate ?? today}
        // A saved date older than the usual range stays allowed when editing.
        min={report && report.eventDate < minDate ? report.eventDate : minDate}
        max={today}
        required
        errors={fieldErrors.eventDate}
      />
      <TextAreaField
        label="Private details (optional)"
        name="privateDetails"
        hint={PRIVATE_DETAILS_HELP}
        maxLength={TEXT_LIMITS.privateDetails.max}
        defaultValue={report?.privateDetails ?? ""}
        rows={3}
        errors={fieldErrors.privateDetails}
      />
      <PhotoField
        onChange={setPhoto}
        current={report ? { hasPhoto: report.hasPhoto, url: report.imageUrl } : undefined}
        errors={fieldErrors.photo}
      />
      <div className="flex flex-wrap items-center gap-4">
        <SubmitButton pending={pending} pendingText={report ? "Saving changes…" : "Saving report…"}>
          {report ? "Save changes" : "Save report"}
        </SubmitButton>
        {report && (
          <Link href={`/items/${report.id}`} className="underline">
            Cancel
          </Link>
        )}
      </div>
    </form>
  );
}
