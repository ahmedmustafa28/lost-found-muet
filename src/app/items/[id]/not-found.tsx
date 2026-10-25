import Link from "next/link";
import { NarrowPage } from "@/components/layout/NarrowPage";

// The same page whether the report doesn't exist or the viewer can't see it,
// so it never reveals that a hidden or closed report exists.
export default function ItemNotFound() {
  return (
    <NarrowPage title="Report not found">
      <p>
        We couldn&apos;t find this report. It may have been closed or removed,
        or the link may be wrong.
      </p>
      <Link href="/" className="underline">
        Go to the home page
      </Link>
    </NarrowPage>
  );
}
