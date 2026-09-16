import type { Metadata } from "next";
import { AnalyticsView } from "@/components/analytics/AnalyticsView";
import { BackendOffline } from "@/components/shared/BackendOffline";

export const metadata: Metadata = { title: "Analytics" };
export const dynamic = "force-dynamic";

async function getAnalytics() {
  const API_URL =
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  const res = await fetch(`${API_URL}/analytics`, { cache: "no-store" });
  if (!res.ok) throw new Error("analytics");
  return res.json();
}

export default async function AnalyticsPage() {
  try {
    const data = await getAnalytics();
    return <AnalyticsView data={data} />;
  } catch {
    return <BackendOffline />;
  }
}
