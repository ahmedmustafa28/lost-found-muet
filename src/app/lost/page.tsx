import type { Metadata } from "next";
import { ItemListPage } from "@/components/items/ItemListPage";

export const metadata: Metadata = { title: "Lost items" };

export default function LostPage({ searchParams }: PageProps<"/lost">) {
  return <ItemListPage reportType="lost" searchParams={searchParams} />;
}
