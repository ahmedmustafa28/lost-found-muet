import Link from "next/link";
import { TextField } from "@/components/forms/TextField";
import { ItemList } from "@/components/items/ItemList";
import { HOME_RECENT_COUNT, SEARCH_MAX_LENGTH } from "@/lib/constants";
import { listActiveReports } from "@/lib/reports/queries";

const primaryButton =
  "rounded-md bg-neutral-900 px-4 py-2 text-center font-medium text-white hover:bg-neutral-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300";
const secondaryButton =
  "rounded-md border border-neutral-400 px-4 py-2 text-center font-medium hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:hover:bg-neutral-900";

// DEVELOPMENT.md 8.2. In the (home) group so its loading.tsx covers only
// this page, not every route.
export default async function Home() {
  const { items } = await listActiveReports({ reportType: null, limit: HOME_RECENT_COUNT });

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-4 py-10">
      <section className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Lost something? Found something? Help reunite it with its owner.
        </h1>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link href="/report?type=lost" className={primaryButton}>
            Report Lost Item
          </Link>
          <Link href="/report?type=found" className={primaryButton}>
            Report Found Item
          </Link>
        </div>
      </section>

      {/* Each button sends the search to its own list; works without
          JavaScript. */}
      <form action="/lost" method="get" role="search" className="flex flex-col gap-3">
        <TextField
          label="Search reports"
          name="q"
          type="search"
          maxLength={SEARCH_MAX_LENGTH}
          hint="Words in the title or description, for example “blue bottle”"
        />
        <div className="flex flex-col gap-3 sm:flex-row">
          <button type="submit" formAction="/lost" className={secondaryButton}>
            Search lost items
          </button>
          <button type="submit" formAction="/found" className={secondaryButton}>
            Search found items
          </button>
        </div>
      </form>

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xl font-semibold">Recently reported</h2>
          <p className="flex gap-4 text-sm">
            <Link href="/lost" className="underline">
              All lost items
            </Link>
            <Link href="/found" className="underline">
              All found items
            </Link>
          </p>
        </div>
        <ItemList items={items} showType empty={<p>Nothing has been reported yet.</p>} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">How it works</h2>
        <ol className="flex list-decimal flex-col gap-2 pl-5">
          <li>
            <strong>Report it.</strong> Say what you lost or found, where and
            when, with a photo if you can. Details only you should know stay
            private.
          </li>
          <li>
            <strong>Search.</strong> Browse the lost and found lists, or search
            by words, category and location.
          </li>
          <li>
            <strong>Hand it over.</strong> Once you know who the item belongs
            to, meet on campus to return it.
          </li>
        </ol>
      </section>

      <section className="flex flex-col gap-3 rounded-md border border-amber-700 p-4 dark:border-amber-400">
        <h2 className="text-xl font-semibold">Stay safe</h2>
        <ul className="flex list-disc flex-col gap-2 pl-5">
          <li>Meet in a public place on campus, ideally in daylight.</li>
          <li>
            <strong>Never pay anyone to get your item back.</strong>
          </li>
          <li>
            Don&apos;t post ID numbers, phone numbers, addresses or card
            details in a report or a photo.
          </li>
          <li>
            Before handing something over, check that the person can describe
            details only the owner would know.
          </li>
        </ul>
      </section>
    </main>
  );
}
