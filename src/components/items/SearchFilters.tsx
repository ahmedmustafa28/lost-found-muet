import Link from "next/link";
import { SelectField } from "@/components/forms/SelectField";
import { TextField } from "@/components/forms/TextField";
import { CATEGORIES, CATEGORY_LABELS, SEARCH_MAX_LENGTH } from "@/lib/constants";
import { hasFilters, type ListFilters } from "@/lib/reports/listParams";
import type { LocationOption } from "@/lib/reports/queries";

type SearchFiltersProps = {
  // The list page the form submits to, for example "/lost".
  path: string;
  filters: ListFilters;
  locations: LocationOption[];
};

const categoryOptions = CATEGORIES.map((value) => ({ value, label: CATEGORY_LABELS[value] }));

// A plain GET form: the filters end up in the URL, and it works without
// JavaScript. Submitting starts again from the first page.
export function SearchFilters({ path, filters, locations }: SearchFiltersProps) {
  return (
    <form
      action={path}
      method="get"
      role="search"
      className="flex flex-col gap-3 rounded-md border border-neutral-300 p-4 dark:border-neutral-700"
    >
      <TextField
        label="Search"
        name="q"
        type="search"
        defaultValue={filters.q}
        maxLength={SEARCH_MAX_LENGTH}
        hint="Words in the title or description"
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <SelectField
          label="Category"
          name="category"
          placeholder="All categories"
          placeholderSelectable
          options={categoryOptions}
          defaultValue={filters.category ?? ""}
        />
        <SelectField
          label="Location"
          name="location"
          placeholder="All locations"
          placeholderSelectable
          options={locations.map(({ key, label }) => ({ value: key, label }))}
          defaultValue={filters.location ?? ""}
        />
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          className="rounded-md bg-neutral-900 px-4 py-2 font-medium text-white hover:bg-neutral-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
        >
          Search
        </button>
        {hasFilters(filters) && (
          <Link href={path} className="text-sm underline">
            Clear search and filters
          </Link>
        )}
      </div>
    </form>
  );
}
