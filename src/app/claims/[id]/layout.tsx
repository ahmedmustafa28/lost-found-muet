import { redirect } from "next/navigation";
import { getSignedInUserId } from "@/lib/auth/getSignedInUserId";
import { createClient } from "@/lib/supabase/server";

// Signed-out visitors go to /login, as on /dashboard: a redirect from the
// layout happens before streaming starts, as a real 307.
export default async function ClaimLayout({ children }: LayoutProps<"/claims/[id]">) {
  const supabase = await createClient();
  if (!(await getSignedInUserId(supabase))) redirect("/login");
  return children;
}
