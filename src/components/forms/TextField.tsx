import type { InputHTMLAttributes } from "react";

type TextFieldProps = {
  label: string;
  name: string;
  errors?: string[];
  hint?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "name">;

export function TextField({ label, name, errors, hint, ...input }: TextFieldProps) {
  const id = `field-${name}`;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = errors?.length ? `${id}-error` : undefined;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {hint && (
        <p id={hintId} className="text-sm text-neutral-600 dark:text-neutral-400">
          {hint}
        </p>
      )}
      <input
        id={id}
        name={name}
        aria-invalid={errorId ? true : undefined}
        aria-describedby={[hintId, errorId].filter(Boolean).join(" ") || undefined}
        className="rounded-md border border-neutral-400 bg-transparent px-3 py-2 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 aria-invalid:border-red-700 dark:border-neutral-600 dark:aria-invalid:border-red-400"
        {...input}
      />
      {errorId && (
        <p id={errorId} className="text-sm text-red-700 dark:text-red-400">
          {errors?.join(" ")}
        </p>
      )}
    </div>
  );
}
