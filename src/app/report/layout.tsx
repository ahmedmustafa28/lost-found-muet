import { redirect } from "next/navigation";
import { getSignedInUserId } from "@/lib/auth/getSignedInUserId";
import { createClient } from "@/lib/supabase/server";

// Checked here as well as in the page, as in /dashboard: a redirect from the
// layout happens before loading.tsx starts streaming, as a real 307.
export default async function ReportLayout({ children }: LayoutProps<"/report">) {
  const supabase = await createClient();
  if (!(await getSignedInUserId(supabase))) redirect("/login");
  return children;
}
