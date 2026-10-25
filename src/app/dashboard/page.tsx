import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSignedInUserId } from "@/lib/auth/getSignedInUserId";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const supabase = await createClient();
  const userId = await getSignedInUserId(supabase);
  if (!userId) redirect("/login");

  // RLS lets a user read only their own profile.
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", userId)
    .maybeSingle();
  // error.tsx shows a friendly message; the database error is not shown.
  if (error || typeof profile?.full_name !== "string") {
    throw new Error("Could not load the profile.");
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
      <p>
        Signed in as <strong>{profile.full_name}</strong>
      </p>
    </main>
  );
}
