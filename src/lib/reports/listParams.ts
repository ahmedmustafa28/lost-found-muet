import {
  CATEGORIES,
  LIST_MAX_PAGES,
  SEARCH_MAX_LENGTH,
  type Category,
} from "@/lib/constants";

// The /lost and /found filters live in the URL, so results can be shared and
// the back button works. Anything unexpected is ignored rather than shown as
// an error: a filter that can't be read is simply not applied.

export type ListFilters = {
  q: string;
  category: Category | null;
  location: string | null;
  page: number;
};

export type RawSearchParams = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

export function parseListParams(params: RawSearchParams): ListFilters {
  // PostgREST treats "*" as a wildcard in ilike patterns and it can't be
  // escaped, so it is removed (DEVELOPMENT.md 9.3).
  const q = (first(params.q) ?? "")
    .replaceAll("*", " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, SEARCH_MAX_LENGTH)
    .trim();

  const categoryParam = first(params.category);
  const category = CATEGORIES.find((c) => c === categoryParam) ?? null;

  // Same shape as the seeded keys; .eq() makes any value safe, this only
  // keeps junk out of the query.
  const locationParam = first(params.location);
  const location =
    locationParam && /^[a-z0-9_]{1,64}$/.test(locationParam) ? locationParam : null;

  const pageParam = Number(first(params.page));
  const page =
    Number.isInteger(pageParam) && pageParam > 1 ? Math.min(pageParam, LIST_MAX_PAGES) : 1;

  return { q, category, location, page };
}

export function hasFilters(filters: ListFilters): boolean {
  return Boolean(filters.q || filters.category || filters.location);
}

// The URL for a list with these filters; empty ones are left out.
export function listHref(path: string, filters: ListFilters): string {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.category) params.set("category", filters.category);
  if (filters.location) params.set("location", filters.location);
  if (filters.page > 1) params.set("page", String(filters.page));
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}
