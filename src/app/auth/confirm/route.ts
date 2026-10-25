import type { EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Email links land here (supabase/templates): sign-up confirmation with
// type=email, password reset with type=recovery. This follows the Supabase
// Next.js server-side auth guide, except that the destination comes only from
// this table: no value from the URL ever reaches a redirect, so a crafted link
// can't send people to another site.
const DESTINATIONS = {
  email: "/dashboard",
  recovery: "/reset-password",
} as const satisfies Partial<Record<EmailOtpType, string>>;

type LinkType = keyof typeof DESTINATIONS;

function isLinkType(value: string | null): value is LinkType {
  return value === "email" || value === "recovery";
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  if (tokenHash && isLinkType(type)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) redirect(DESTINATIONS[type]);
  }

  // Expired, already used, malformed, or an unknown type. The reason isn't
  // shown.
  redirect("/login?error=link");
}
