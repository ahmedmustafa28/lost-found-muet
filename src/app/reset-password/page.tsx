import type { Metadata } from "next";
import Link from "next/link";
import { FormMessage } from "@/components/forms/FormMessage";
import { ResetPasswordForm } from "@/components/forms/ResetPasswordForm";
import { NarrowPage } from "@/components/layout/NarrowPage";
import { getSignedInUser } from "@/lib/auth/getSignedInUserId";
import { AUTH_LINK_ERROR_MESSAGE } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Choose a new password" };

// Reached only from the reset email: /auth/confirm checks the link, signs the
// user in and sends them here. Nothing in the app links to this page.
export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const user = await getSignedInUser(supabase);

  return (
    <NarrowPage title="Choose a new password">
      {user ? (
        <>
          {/* A reset link signs in whoever's link it was, so say whose
              password this is (DEVELOPMENT.md 10.1). */}
          <p className="break-all">
            You are setting a new password for{" "}
            <strong>{user.email ?? "your account"}</strong>.
          </p>
          <ResetPasswordForm />
        </>
      ) : (
        <>
          <FormMessage kind="error">{AUTH_LINK_ERROR_MESSAGE}</FormMessage>
          <Link href="/forgot-password" className="text-sm underline">
            Request a new reset link
          </Link>
        </>
      )}
    </NarrowPage>
  );
}
