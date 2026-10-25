import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "@/components/forms/ForgotPasswordForm";
import { NarrowPage } from "@/components/layout/NarrowPage";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <NarrowPage title="Forgot your password?">
      <p className="text-neutral-700 dark:text-neutral-300">
        Enter your email and we&apos;ll send you a link to choose a new
        password.
      </p>
      <ForgotPasswordForm />
      <Link href="/login" className="text-sm underline">
        Back to log in
      </Link>
    </NarrowPage>
  );
}
