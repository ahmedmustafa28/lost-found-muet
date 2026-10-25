import Link from "next/link";
import type { ReactNode } from "react";
import type { ItemSummary } from "@/lib/reports/queries";
import { ItemCard } from "./ItemCard";

type ItemListProps = {
  items: ItemSummary[];
  // Shown instead of the list when there are no items.
  empty: ReactNode;
  showType?: boolean;
  // The URL that shows the next page, or null when there's nothing more.
  loadMoreHref?: string | null;
  // There is more, but the page limit is reached.
  atLimit?: boolean;
};

export function ItemList({ items, empty, showType, loadMoreHref, atLimit }: ItemListProps) {
  if (items.length === 0) return <div>{empty}</div>;

  return (
    <div className="flex flex-col gap-4">
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <li key={item.id}>
            <ItemCard item={item} showType={showType} />
          </li>
        ))}
      </ul>
      {loadMoreHref && (
        // A link, not a button that fetches in the browser: the URL keeps the
        // count, so the back button and shared links show the same items.
        <Link
          href={loadMoreHref}
          scroll={false}
          className="self-center rounded-md border border-neutral-400 px-4 py-2 font-medium hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:hover:bg-neutral-900"
        >
          Load more
        </Link>
      )}
      {atLimit && (
        <p className="text-center text-sm text-neutral-700 dark:text-neutral-300">
          Showing the newest {items.length} items. Use search or the filters to
          narrow the list.
        </p>
      )}
    </div>
  );
}
