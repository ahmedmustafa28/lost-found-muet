import Link from "next/link";
import { logout } from "@/lib/auth/actions";
import { getSignedInUser } from "@/lib/auth/getSignedInUserId";
import { createClient } from "@/lib/supabase/server";

const linkClass =
  "rounded-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";

export async function Header() {
  const supabase = await createClient();
  const user = await getSignedInUser(supabase);

  return (
    <header className="border-b border-neutral-300 dark:border-neutral-700">
      <nav
        aria-label="Main"
        className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3"
      >
        <Link href="/" className={`${linkClass} font-semibold`}>
          Lost &amp; Found MUET
        </Link>
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <li>
            <Link href="/lost" className={linkClass}>
              Lost items
            </Link>
          </li>
          <li>
            <Link href="/found" className={linkClass}>
              Found items
            </Link>
          </li>
          {user ? (
            <>
              {/* Always visible, so nobody uses someone else's account
                  without noticing (DEVELOPMENT.md 10.1). */}
              {user.email && (
                <li className="break-all text-neutral-700 dark:text-neutral-300">
                  Signed in as {user.email}
                </li>
              )}
              <li>
                <Link href="/report" className={linkClass}>
                  Report an item
                </Link>
              </li>
              <li>
                <Link href="/dashboard" className={linkClass}>
                  Dashboard
                </Link>
              </li>
              <li>
                <form action={logout}>
                  <button type="submit" className={linkClass}>
                    Log out
                  </button>
                </form>
              </li>
            </>
          ) : (
            <>
              <li>
                <Link href="/login" className={linkClass}>
                  Log in
                </Link>
              </li>
              <li>
                <Link href="/register" className={linkClass}>
                  Register
                </Link>
              </li>
            </>
          )}
        </ul>
      </nav>
    </header>
  );
}
