import Link from "next/link";
import { REPORT_STATUS_LABELS, REPORT_TYPE_LABELS } from "@/lib/constants";
import { formatDate } from "@/lib/dates";
import type { MyReport } from "@/lib/reports/queries";

// Status is shown as text, not only colour.
export function MyReportsList({ reports }: { reports: MyReport[] }) {
  if (reports.length === 0) {
    return (
      <p>
        You haven&apos;t reported any items yet.{" "}
        <Link href="/report" className="underline">
          Report an item
        </Link>
      </p>
    );
  }

  return (
    <ul className="flex flex-col divide-y divide-neutral-300 rounded-md border border-neutral-300 dark:divide-neutral-700 dark:border-neutral-700">
      {reports.map((report) => (
        <li key={report.id}>
          <Link
            href={`/items/${report.id}`}
            className="flex flex-col gap-1 px-4 py-3 hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:hover:bg-neutral-900"
          >
            <span className="break-words font-medium underline-offset-4">{report.title}</span>
            <span className="text-sm text-neutral-700 dark:text-neutral-300">
              {REPORT_TYPE_LABELS[report.reportType]} · {REPORT_STATUS_LABELS[report.status]} ·{" "}
              {formatDate(report.eventDate)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
