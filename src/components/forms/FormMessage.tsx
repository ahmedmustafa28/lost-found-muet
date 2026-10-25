import type { ReactNode } from "react";

type FormMessageProps = {
  kind: "error" | "success";
  children: ReactNode;
};

// The word before the message carries the meaning, not only the colour.
export function FormMessage({ kind, children }: FormMessageProps) {
  const isError = kind === "error";
  return (
    <div
      role={isError ? "alert" : "status"}
      className={
        isError
          ? "rounded-md border border-red-700 px-3 py-2 text-sm text-red-800 dark:border-red-400 dark:text-red-300"
          : "rounded-md border border-green-700 px-3 py-2 text-sm text-green-800 dark:border-green-400 dark:text-green-300"
      }
    >
      <strong>{isError ? "Error: " : "Done: "}</strong>
      {children}
    </div>
  );
}
