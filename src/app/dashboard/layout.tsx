import { redirect } from "next/navigation";
import { getSignedInUserId } from "@/lib/auth/getSignedInUserId";
import { createClient } from "@/lib/supabase/server";

// Checked here as well as in the page: the page streams behind loading.tsx,
// so its redirect reaches the browser only as a client-side redirect. A
// redirect from the layout happens before streaming starts, as a real 307.
export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const supabase = await createClient();
  if (!(await getSignedInUserId(supabase))) redirect("/login");
  return children;
}
