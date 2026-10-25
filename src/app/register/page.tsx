import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { RegisterForm } from "@/components/forms/RegisterForm";
import { NarrowPage } from "@/components/layout/NarrowPage";
import { getSignedInUserId } from "@/lib/auth/getSignedInUserId";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Register" };

export default async function RegisterPage() {
  const supabase = await createClient();
  if (await getSignedInUserId(supabase)) redirect("/dashboard");

  return (
    <NarrowPage title="Create an account">
      <p className="text-neutral-700 dark:text-neutral-300">
        Only MUET students can register, with the email address made from
        their roll number.
      </p>
      <RegisterForm />
      <p className="text-sm">
        Already have an account?{" "}
        <Link href="/login" className="underline">
          Log in
        </Link>
      </p>
    </NarrowPage>
  );
}
