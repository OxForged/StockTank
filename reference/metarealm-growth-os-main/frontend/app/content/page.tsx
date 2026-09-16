import type { Metadata } from "next";
import { ContentStudioView } from "@/components/content/ContentStudioView";
import { BackendOffline } from "@/components/shared/BackendOffline";
import { getContentItems } from "@/lib/api/server";

export const metadata: Metadata = { title: "Content Studio" };
export const dynamic = "force-dynamic";

export default async function ContentStudioPage() {
  try {
    const items = await getContentItems();
    return <ContentStudioView initialItems={items} />;
  } catch {
    return <BackendOffline />;
  }
}
