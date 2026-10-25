"use client"; // Error boundaries must be Client Components

import { RouteError } from "@/components/layout/RouteError";

// Catches errors from pages without their own error.tsx, including the home
// page. The error itself is never shown.
export default function RootError({ retry }: { error: unknown; retry: () => void }) {
  return <RouteError title="Lost & Found MUET" retry={retry} />;
}
