import type { Metadata } from "next";
import { ItemListPage } from "@/components/items/ItemListPage";

export const metadata: Metadata = { title: "Found items" };

export default function FoundPage({ searchParams }: PageProps<"/found">) {
  return <ItemListPage reportType="found" searchParams={searchParams} />;
}
