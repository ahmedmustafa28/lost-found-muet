import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MyClaimsList } from "@/components/claims/MyClaimsList";
import { MyReportsList } from "@/components/items/MyReportsList";
import { getSignedInUserId } from "@/lib/auth/getSignedInUserId";
import { getMyClaims } from "@/lib/claims/queries";
import { getMyReports } from "@/lib/reports/queries";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const supabase = await createClient();
  const userId = await getSignedInUserId(supabase);
  if (!userId) redirect("/login");

  // RLS lets a user read only their own profile.
  const [{ data: profile, error }, reports, claims] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", userId).maybeSingle(),
    getMyReports(userId),
    getMyClaims(userId),
  ]);
  // error.tsx shows a friendly message; the database error is not shown.
  if (error || typeof profile?.full_name !== "string") {
    throw new Error("Could not load the profile.");
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p>
          Signed in as <strong>{profile.full_name}</strong>
        </p>
      </div>
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">My reports</h2>
          <Link href="/report" className="text-sm underline">
            Report an item
          </Link>
        </div>
        <MyReportsList reports={reports} />
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">My claims</h2>
        <MyClaimsList claims={claims} />
      </section>
    </main>
  );
}
