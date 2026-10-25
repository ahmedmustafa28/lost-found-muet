import {
  CATEGORY_LABELS,
  REPORT_STATUS_LABELS,
  REPORT_TYPE_LABELS,
} from "@/lib/constants";
import { formatDate } from "@/lib/dates";
import type { ReportView } from "@/lib/reports/queries";

// Never shows who reported the item (DEVELOPMENT.md D-08). Private details
// are only in the view for the owner.
export function ItemDetails({ report }: { report: ReportView }) {
  const typeLabel = REPORT_TYPE_LABELS[report.reportType];
  const location = [report.locationLabel ?? "Location no longer listed", report.locationDetail]
    .filter(Boolean)
    .join(", ");

  return (
    <article className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-medium uppercase tracking-wide text-neutral-600 dark:text-neutral-400">
          {typeLabel} item
          {report.status !== "active" && <> · {REPORT_STATUS_LABELS[report.status]}</>}
        </p>
        <h1 className="break-words text-2xl font-semibold tracking-tight">{report.title}</h1>
      </header>

      {report.imageUrl && (
        // A short-lived signed URL. next/image would fetch and cache it on
        // the server, keeping it past its expiry, so a plain <img> is used.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={report.imageUrl}
          alt={`Photo of the ${typeLabel.toLowerCase()} item: ${report.title}`}
          className="max-h-96 w-auto max-w-full self-start rounded-md border border-neutral-300 dark:border-neutral-700"
        />
      )}

      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-[max-content_1fr]">
        <dt className="font-medium">Category</dt>
        <dd className="break-words">{CATEGORY_LABELS[report.category]}</dd>
        <dt className="font-medium">Location</dt>
        <dd className="break-words">{location}</dd>
        <dt className="font-medium">Date {report.reportType === "lost" ? "lost" : "found"}</dt>
        <dd>{formatDate(report.eventDate)}</dd>
      </dl>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Description</h2>
        <p className="whitespace-pre-line break-words">{report.description}</p>
      </section>

      {report.isOwner && (
        <section className="flex flex-col gap-2 rounded-md border border-neutral-300 p-4 dark:border-neutral-700">
          <h2 className="text-lg font-semibold">Private details</h2>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">Only you can see this.</p>
          <p className="whitespace-pre-line break-words">
            {report.privateDetails ?? "You didn't add any private details."}
          </p>
        </section>
      )}
    </article>
  );
}
