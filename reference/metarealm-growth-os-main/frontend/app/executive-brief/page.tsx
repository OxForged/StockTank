import type { Metadata } from "next";
import { ExecutiveBriefView } from "@/components/executive-brief/ExecutiveBriefView";
import { BackendOffline } from "@/components/shared/BackendOffline";
import { getExecutiveBrief } from "@/lib/api/server";

export const metadata: Metadata = { title: "Executive Brief" };
export const dynamic = "force-dynamic";

export default async function ExecutiveBriefPage() {
  try {
    const brief = await getExecutiveBrief();
    return <ExecutiveBriefView initialBrief={brief} />;
  } catch {
    return <BackendOffline />;
  }
}
