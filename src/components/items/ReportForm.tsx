"use client";

import { useState } from "react";
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
} from "@/lib/constants";
import { createReport } from "@/lib/reports/actions";
import type { LocationOption } from "@/lib/reports/queries";
import { createClient } from "@/lib/supabase/client";
import { reportSchema } from "@/lib/validation/report";
import { PhotoField } from "./PhotoField";

type ReportFormProps = {
  // Only used to build the upload path; Storage and the database check it.
  userId: string;
  locations: LocationOption[];
  // Pakistan dates from the server: the default and the allowed range.
  today: string;
  minDate: string;
};

const typeOptions = REPORT_TYPES.map((value) => ({ value, label: REPORT_TYPE_LABELS[value] }));
const categoryOptions = CATEGORIES.map((value) => ({ value, label: CATEGORY_LABELS[value] }));

// On success the Server Action redirects to the new report's page.
export function ReportForm({ userId, locations, today, minDate }: ReportFormProps) {
  const [photo, setPhoto] = useState<Blob | null>(null);

  // The photo goes straight from the browser to Storage, only once the form
  // is valid, then the Server Action gets its path (DEVELOPMENT.md 11.1).
  const uploadPhoto: PrepareSubmit = async (formData) => {
    if (!photo) return null;
    const path = `${userId}/${crypto.randomUUID()}.${IMAGE_UPLOAD_EXTENSION}`;
    const { error } = await createClient()
      .storage.from(IMAGE_BUCKET)
      .upload(path, photo, { contentType: IMAGE_UPLOAD_TYPE, upsert: false });
    if (error) {
      return {
        ok: false,
        fieldErrors: { photo: ["The photo couldn't be uploaded. Try again, or remove it."] },
      };
    }
    formData.set("imagePath", path);
    return null;
  };

  const { formAction, onSubmit, pending, error, fieldErrors } = useFormAction(
    createReport,
    reportSchema,
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
      <ChoiceField
        legend="Did you lose or find this item?"
        name="reportType"
        options={typeOptions}
        required
        errors={fieldErrors.reportType}
      />
      <TextField
        label="Title"
        name="title"
        hint='A short name for the item, for example "Blue water bottle".'
        maxLength={TEXT_LIMITS.title.max}
        required
        errors={fieldErrors.title}
      />
      <SelectField
        label="Category"
        name="category"
        placeholder="Choose a category"
        options={categoryOptions}
        required
        errors={fieldErrors.category}
      />
      <SelectField
        label="Location"
        name="locationKey"
        placeholder="Choose a location"
        options={locations.map(({ key, label }) => ({ value: key, label }))}
        required
        errors={fieldErrors.locationKey}
      />
      <TextField
        label="Location detail (optional)"
        name="locationDetail"
        hint='For example "second floor, near the stairs".'
        maxLength={TEXT_LIMITS.locationDetail.max}
        errors={fieldErrors.locationDetail}
      />
      <TextAreaField
        label="Description"
        name="description"
        hint="Everyone can read this. Describe the item in general terms."
        maxLength={TEXT_LIMITS.description.max}
        required
        errors={fieldErrors.description}
      />
      <TextField
        label="Date lost or found"
        name="eventDate"
        type="date"
        defaultValue={today}
        min={minDate}
        max={today}
        required
        errors={fieldErrors.eventDate}
      />
      <TextAreaField
        label="Private details (optional)"
        name="privateDetails"
        hint={PRIVATE_DETAILS_HELP}
        maxLength={TEXT_LIMITS.privateDetails.max}
        rows={3}
        errors={fieldErrors.privateDetails}
      />
      <PhotoField onChange={setPhoto} errors={fieldErrors.photo} />
      <SubmitButton pending={pending} pendingText="Saving report…">
        Save report
      </SubmitButton>
    </form>
  );
}
