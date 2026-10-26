import Link from "next/link";
import { NarrowPage } from "@/components/layout/NarrowPage";

// The same page whether the claim doesn't exist or the viewer can't see it,
// so it never reveals that someone else's claim exists.
export default function ClaimNotFound() {
  return (
    <NarrowPage title="Claim not found">
      <p>
        We couldn&apos;t find this claim. The link may be wrong, or it may
        belong to another account.
      </p>
      <Link href="/dashboard" className="underline">
        Go to your dashboard
      </Link>
    </NarrowPage>
  );
}
