"use client";

import { FormMessage } from "@/components/forms/FormMessage";
import { GENERIC_ERROR_MESSAGE } from "@/lib/constants";

// The body of a route's error.tsx. The error itself is never shown.
export function RouteError({ title, retry }: { title: string; retry: () => void }) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-start gap-4 px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <FormMessage kind="error">{GENERIC_ERROR_MESSAGE}</FormMessage>
      <button
        type="button"
        onClick={() => retry()}
        className="rounded-md border border-neutral-400 px-4 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
      >
        Try again
      </button>
    </main>
  );
}
