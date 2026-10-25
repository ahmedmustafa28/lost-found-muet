type ChoiceFieldProps = {
  legend: string;
  name: string;
  options: readonly { value: string; label: string }[];
  errors?: string[];
  required?: boolean;
  defaultValue?: string;
};

// A group of radio buttons, with the same error wiring as TextField.
export function ChoiceField({ legend, name, options, errors, required, defaultValue }: ChoiceFieldProps) {
  const errorId = errors?.length ? `field-${name}-error` : undefined;

  return (
    <fieldset aria-describedby={errorId} className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        {options.map((option) => (
          <label key={option.value} className="flex items-center gap-2">
            <input
              type="radio"
              name={name}
              value={option.value}
              defaultChecked={option.value === defaultValue}
              required={required}
              className="size-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            />
            {option.label}
          </label>
        ))}
      </div>
      {errorId && (
        <p id={errorId} className="text-sm text-red-700 dark:text-red-400">
          {errors?.join(" ")}
        </p>
      )}
    </fieldset>
  );
}
