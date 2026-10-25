"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import {
  IMAGE_ALLOWED_TYPES,
  IMAGE_MAX_BYTES,
  IMAGE_ORIGINAL_MAX_BYTES,
} from "@/lib/constants";
import { reencodeImage } from "@/lib/images/reencodeImage";

type PhotoFieldProps = {
  // The re-encoded photo, or null when there is none.
  onChange: (photo: Blob | null) => void;
  errors?: string[];
};

const MB = 1024 * 1024;

// The file input has no name, so the original file is never sent with the
// form. Only the re-encoded copy is kept, shown as the preview and uploaded
// on submit (DEVELOPMENT.md 11.1).
export function PhotoField({ onChange, errors }: PhotoFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function clear(error: string | null = null) {
    if (inputRef.current) inputRef.current.value = "";
    setPreviewUrl(null);
    setLocalError(error);
    onChange(null);
  }

  async function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return clear();
    if (!IMAGE_ALLOWED_TYPES.some((type) => type === file.type)) {
      return clear("Choose a JPEG, PNG or WebP photo.");
    }
    if (file.size > IMAGE_ORIGINAL_MAX_BYTES) {
      return clear(`Choose a photo smaller than ${IMAGE_ORIGINAL_MAX_BYTES / MB} MB.`);
    }

    setBusy(true);
    try {
      const photo = await reencodeImage(file);
      if (photo.size > IMAGE_MAX_BYTES) {
        return clear(`This photo is still larger than ${IMAGE_MAX_BYTES / MB} MB after shrinking. Try another one.`);
      }
      setLocalError(null);
      setPreviewUrl(URL.createObjectURL(photo));
      onChange(photo);
    } catch {
      clear("This photo couldn't be read. Try another one.");
    } finally {
      setBusy(false);
    }
  }

  const id = "field-photo";
  const hintId = `${id}-hint`;
  const shownErrors = localError ? [localError] : errors;
  const errorId = shownErrors?.length ? `${id}-error` : undefined;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        Photo (optional)
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
      {previewUrl && (
        <div className="mt-2 flex flex-col items-start gap-2">
          {/* A local blob: URL, which next/image can't optimize. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="Preview of the photo that will be uploaded"
            className="max-h-64 w-auto max-w-full rounded-md border border-neutral-300 dark:border-neutral-700"
          />
          <button
            type="button"
            onClick={() => clear()}
            className="text-sm underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            Remove photo
          </button>
        </div>
      )}
    </div>
  );
}
