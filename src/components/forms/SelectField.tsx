import type { SelectHTMLAttributes } from "react";

type SelectFieldProps = {
  label: string;
  name: string;
  options: readonly { value: string; label: string }[];
  // Shown first with an empty value, so nothing is chosen by accident.
  placeholder: string;
  errors?: string[];
  hint?: string;
} & Omit<SelectHTMLAttributes<HTMLSelectElement>, "name">;

// Same layout and accessibility wiring as TextField.
export function SelectField({
  label,
  name,
  options,
  placeholder,
  errors,
  hint,
  ...select
}: SelectFieldProps) {
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
      <select
        id={id}
        name={name}
        defaultValue=""
        aria-invalid={errorId ? true : undefined}
        aria-describedby={[hintId, errorId].filter(Boolean).join(" ") || undefined}
        className="rounded-md border border-neutral-400 bg-transparent px-3 py-2 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 aria-invalid:border-red-700 dark:border-neutral-600 dark:bg-neutral-950 dark:aria-invalid:border-red-400"
        {...select}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {errorId && (
        <p id={errorId} className="text-sm text-red-700 dark:text-red-400">
          {errors?.join(" ")}
        </p>
      )}
    </div>
  );
}
