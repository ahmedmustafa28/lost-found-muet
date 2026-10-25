import type { ReactNode } from "react";

type SubmitButtonProps = {
  pending: boolean;
  children: ReactNode;
  pendingText: string;
};

export function SubmitButton({ pending, children, pendingText }: SubmitButtonProps) {
  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      className="rounded-md bg-neutral-900 px-4 py-2 font-medium text-white hover:bg-neutral-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
    >
      {pending ? pendingText : children}
    </button>
  );
}
