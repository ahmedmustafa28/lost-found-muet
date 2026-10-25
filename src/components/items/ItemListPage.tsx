import Link from "next/link";
import { LIST_MAX_PAGES, LIST_PAGE_SIZE, type ReportType } from "@/lib/constants";
import {
  hasFilters,
  listHref,
  parseListParams,
  type RawSearchParams,
} from "@/lib/reports/listParams";
import { getActiveLocations, listActiveReports } from "@/lib/reports/queries";
import { ItemList } from "./ItemList";
import { SearchFilters } from "./SearchFilters";

const COPY: Record<ReportType, { title: string; intro: string; none: string; reportLabel: string }> = {
  lost: {
    title: "Lost items",
    intro: "Things people have lost on campus. If you've found one of them, open it to see the details.",
    none: "No lost items have been reported yet.",
    reportLabel: "Report a lost item",
  },
  found: {
    title: "Found items",
    intro: "Things people have found on campus. If one of them is yours, open it to see the details.",
    none: "No found items have been reported yet.",
    reportLabel: "Report a found item",
  },
};

// The body of /lost and /found: search, filters and the list. The URL holds
// the filters and how many pages are shown.
export async function ItemListPage({
  reportType,
  searchParams,
}: {
  reportType: ReportType;
  searchParams: Promise<RawSearchParams>;
}) {
  const path = `/${reportType}`;
  const copy = COPY[reportType];
  const filters = parseListParams(await searchParams);
  const [locations, { items, hasMore }] = await Promise.all([
    getActiveLocations(),
    listActiveReports({ reportType, filters, limit: filters.page * LIST_PAGE_SIZE }),
  ]);
  const canLoadMore = hasMore && filters.page < LIST_MAX_PAGES;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{copy.title}</h1>
        <p className="text-neutral-700 dark:text-neutral-300">{copy.intro}</p>
      </div>
      <SearchFilters path={path} filters={filters} locations={locations} />
      {/* The cards use h3, so the list needs an h2 above them. */}
      <section aria-labelledby="results-heading" className="flex flex-col gap-3">
        <h2 id="results-heading" className="text-lg font-semibold">
          {hasFilters(filters) ? "Search results" : "Newest first"}
        </h2>
        <ItemList
          items={items}
          loadMoreHref={canLoadMore ? listHref(path, { ...filters, page: filters.page + 1 }) : null}
          atLimit={hasMore && !canLoadMore}
          empty={
            hasFilters(filters) ? (
              <p>
                No items match your search.{" "}
                <Link href={path} className="underline">
                  Clear search and filters
                </Link>
              </p>
            ) : (
              <p>
                {copy.none}{" "}
                <Link href={`/report?type=${reportType}`} className="underline">
                  {copy.reportLabel}
                </Link>
              </p>
            )
          }
        />
      </section>
    </main>
  );
}
