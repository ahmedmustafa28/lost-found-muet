"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import {
  IMAGE_ALLOWED_TYPES,
  IMAGE_MAX_BYTES,
  IMAGE_ORIGINAL_MAX_BYTES,
} from "@/lib/constants";
import { reencodeImage } from "@/lib/images/reencodeImage";

// What should happen to the report's photo on save.
export type PhotoSelection =
  | { change: "keep" }
  | { change: "replace"; photo: Blob }
  | { change: "remove" };

type PhotoFieldProps = {
  onChange: (selection: PhotoSelection) => void;
  // When editing a report that already has a photo.
  current?: { hasPhoto: boolean; url: string | null };
  errors?: string[];
};

const MB = 1024 * 1024;
const removeButton =
  "text-sm underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";

// The file input has no name, so the original file is never sent with the
// form. Only the re-encoded copy is kept, shown as the preview and uploaded
// on submit (DEVELOPMENT.md 11.1).
export function PhotoField({ onChange, current, errors }: PhotoFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [newPhoto, setNewPhoto] = useState<{ blob: Blob; url: string } | null>(null);
  const [removeCurrent, setRemoveCurrent] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    return () => {
      if (newPhoto) URL.revokeObjectURL(newPhoto.url);
    };
  }, [newPhoto]);

  function update(photo: { blob: Blob; url: string } | null, remove: boolean) {
    setNewPhoto(photo);
    setRemoveCurrent(remove);
    onChange(
      photo
        ? { change: "replace", photo: photo.blob }
        : remove
          ? { change: "remove" }
          : { change: "keep" },
    );
  }

  // Back to the saved photo (or none), optionally with an error.
  function clearNewPhoto(error: string | null = null) {
    if (inputRef.current) inputRef.current.value = "";
    setLocalError(error);
    update(null, removeCurrent);
  }

  async function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return clearNewPhoto();
    if (!IMAGE_ALLOWED_TYPES.some((type) => type === file.type)) {
      return clearNewPhoto("Choose a JPEG, PNG or WebP photo.");
    }
    if (file.size > IMAGE_ORIGINAL_MAX_BYTES) {
      return clearNewPhoto(`Choose a photo smaller than ${IMAGE_ORIGINAL_MAX_BYTES / MB} MB.`);
    }

    setBusy(true);
    try {
      const blob = await reencodeImage(file);
      if (blob.size > IMAGE_MAX_BYTES) {
        return clearNewPhoto(
          `This photo is still larger than ${IMAGE_MAX_BYTES / MB} MB after shrinking. Try another one.`,
        );
      }
      setLocalError(null);
      update({ blob, url: URL.createObjectURL(blob) }, removeCurrent);
    } catch {
      clearNewPhoto("This photo couldn't be read. Try another one.");
    } finally {
      setBusy(false);
    }
  }

  const id = "field-photo";
  const hintId = `${id}-hint`;
  const shownErrors = localError ? [localError] : errors;
  const errorId = shownErrors?.length ? `${id}-error` : undefined;
  const hasCurrent = current?.hasPhoto ?? false;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {hasCurrent ? "Replace photo (optional)" : "Photo (optional)"}
      </label>
      <p id={hintId} className="text-sm text-neutral-600 dark:text-neutral-400">
        JPEG, PNG or WebP. It is shrunk and its hidden data, such as location,
        is removed before upload. Crop or cover any names or numbers first.
      </p>
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={IMAGE_ALLOWED_TYPES.join(",")}
        onChange={handleChange}
        disabled={busy}
        aria-invalid={errorId ? true : undefined}
        aria-describedby={[hintId, errorId].filter(Boolean).join(" ")}
        className="text-sm file:mr-3 file:rounded-md file:border file:border-neutral-400 file:bg-transparent file:px-3 file:py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
      />
      {busy && <p role="status" className="text-sm">Preparing photo…</p>}
      {errorId && (
        <p id={errorId} className="text-sm text-red-700 dark:text-red-400">
          {shownErrors?.join(" ")}
        </p>
      )}

      {newPhoto ? (
        <div className="mt-2 flex flex-col items-start gap-2">
          {/* A local blob: URL, which next/image can't optimize. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={newPhoto.url}
            alt="Preview of the photo that will be uploaded"
            className="max-h-64 w-auto max-w-full rounded-md border border-neutral-300 dark:border-neutral-700"
          />
          <button type="button" onClick={() => clearNewPhoto()} className={removeButton}>
            {hasCurrent ? "Don't use this photo" : "Remove photo"}
          </button>
        </div>
      ) : hasCurrent && removeCurrent ? (
        <p role="status" className="mt-2 text-sm">
          The current photo will be removed when you save.{" "}
          <button type="button" onClick={() => update(null, false)} className={removeButton}>
            Undo
          </button>
        </p>
      ) : hasCurrent ? (
        <div className="mt-2 flex flex-col items-start gap-2">
          {current?.url ? (
            // A short-lived signed URL; see ItemDetails.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={current.url}
              alt="The report's current photo"
              className="max-h-64 w-auto max-w-full rounded-md border border-neutral-300 dark:border-neutral-700"
            />
          ) : (
            <p className="text-sm">This report has a photo, but it can&apos;t be shown right now.</p>
          )}
          <button type="button" onClick={() => update(null, true)} className={removeButton}>
            Remove photo
          </button>
        </div>
      ) : null}
    </div>
  );
}
