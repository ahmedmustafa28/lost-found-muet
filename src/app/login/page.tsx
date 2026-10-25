import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FormMessage } from "@/components/forms/FormMessage";
import { LoginForm } from "@/components/forms/LoginForm";
import { NarrowPage } from "@/components/layout/NarrowPage";
import { getSignedInUserId } from "@/lib/auth/getSignedInUserId";
import { AUTH_LINK_ERROR_MESSAGE } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const supabase = await createClient();
  if (await getSignedInUserId(supabase)) redirect("/dashboard");

  // /auth/confirm sends people here when an email link can't be used. Only
  // this fixed key is read, so the page never shows text from the URL.
  const { error } = await searchParams;

  return (
    <NarrowPage title="Log in">
      {error === "link" && <FormMessage kind="error">{AUTH_LINK_ERROR_MESSAGE}</FormMessage>}
      <LoginForm />
      <div className="flex flex-col gap-2 text-sm">
        <Link href="/forgot-password" className="underline">
          Forgot your password?
        </Link>
        <p>
          New here?{" "}
          <Link href="/register" className="underline">
            Create an account
          </Link>
        </p>
      </div>
    </NarrowPage>
  );
}
