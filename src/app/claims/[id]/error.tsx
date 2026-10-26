"use client"; // Error boundaries must be Client Components

import { RouteError } from "@/components/layout/RouteError";

export default function ClaimError({ retry }: { error: unknown; retry: () => void }) {
  return <RouteError title="Claim" retry={retry} />;
}
