import type { createClient } from "@/lib/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

export type SignedInUser = {
  id: string;
  // Shown to the user themselves (header, /reset-password) so someone who
  // opened another person's email link can see whose account they are in
  // (DEVELOPMENT.md 10.1). Null only for an account without an email, which
  // this app doesn't create.
  email: string | null;
};

// getClaims() verifies the session's token; getSession() would only read the
// cookie, which the browser controls (AGENTS.md security rule 4).
export async function getSignedInUser(
  supabase: ServerClient,
): Promise<SignedInUser | null> {
  const { data } = await supabase.auth.getClaims();
  if (!data) return null;
  const { sub, email } = data.claims;
  return { id: sub, email: email || null };
}

export async function getSignedInUserId(
  supabase: ServerClient,
): Promise<string | null> {
  return (await getSignedInUser(supabase))?.id ?? null;
}
