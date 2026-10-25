"use client"; // Error boundaries must be Client Components

import { RouteError } from "@/components/layout/RouteError";

export default function FoundError({ retry }: { error: unknown; retry: () => void }) {
  return <RouteError title="Found items" retry={retry} />;
}
