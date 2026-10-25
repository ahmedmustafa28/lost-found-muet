"use client"; // Error boundaries must be Client Components

import { RouteError } from "@/components/layout/RouteError";

export default function ItemError({ retry }: { error: unknown; retry: () => void }) {
  return <RouteError title="Report" retry={retry} />;
}
