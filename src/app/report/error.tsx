"use client"; // Error boundaries must be Client Components

import { RouteError } from "@/components/layout/RouteError";

export default function ReportError({ retry }: { error: unknown; retry: () => void }) {
  return <RouteError title="Report an item" retry={retry} />;
}
