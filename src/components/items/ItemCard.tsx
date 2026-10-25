import Link from "next/link";
import { CATEGORY_LABELS, REPORT_TYPE_LABELS } from "@/lib/constants";
import { formatDate } from "@/lib/dates";
import type { ItemSummary } from "@/lib/reports/queries";

type ItemCardProps = {
  item: ItemSummary;
  // On lists that mix lost and found reports (the home page).
  showType?: boolean;
};

// One report in a list. Never shows who reported the item (DEVELOPMENT.md
// D-08). Everything is text, so nothing depends on colour.
export function ItemCard({ item, showType = false }: ItemCardProps) {
  const typeLabel = REPORT_TYPE_LABELS[item.reportType];
  const location = [item.locationLabel ?? "Location no longer listed", item.locationDetail]
    .filter(Boolean)
    .join(", ");

  return (
    <Link
      href={`/items/${item.id}`}
      className="flex h-full gap-3 rounded-md border border-neutral-300 p-3 hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:border-neutral-700 dark:hover:bg-neutral-900"
    >
      <div className="size-20 shrink-0 overflow-hidden rounded bg-neutral-100 dark:bg-neutral-800">
        {item.imageUrl ? (
          // A signed URL, which next/image would cache on the server past its
          // expiry. Lazy, so a long list only loads the photos people reach.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.imageUrl}
            alt={`Photo: ${item.title}`}
            width={80}
            height={80}
            loading="lazy"
            className="size-full object-cover"
          />
        ) : (
          <span className="flex size-full items-center justify-center text-center text-xs text-neutral-600 dark:text-neutral-400">
            No photo
          </span>
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        {showType && (
          <span className="text-xs font-medium uppercase tracking-wide text-neutral-600 dark:text-neutral-400">
            {typeLabel}
          </span>
        )}
        <h3 className="break-words font-medium leading-snug">{item.title}</h3>
        <p className="text-sm text-neutral-700 dark:text-neutral-300">
          {CATEGORY_LABELS[item.category]} · {formatDate(item.eventDate)}
        </p>
        <p className="break-words text-sm text-neutral-700 dark:text-neutral-300">{location}</p>
      </div>
    </Link>
  );
}
