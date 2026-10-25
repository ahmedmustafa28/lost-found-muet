"use client"; // Error boundaries must be Client Components

import { RouteError } from "@/components/layout/RouteError";

export default function LostError({ retry }: { error: unknown; retry: () => void }) {
  return <RouteError title="Lost items" retry={retry} />;
}
