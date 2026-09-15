import type { Metadata } from "next";
import { MarketIntelligenceView } from "@/components/market-intelligence/MarketIntelligenceView";
import { BackendOffline } from "@/components/shared/BackendOffline";
import { getNews } from "@/lib/api/server";

export const metadata: Metadata = { title: "Market Intelligence" };
export const dynamic = "force-dynamic";

export default async function MarketIntelligencePage() {
  try {
    const news = await getNews();
    return <MarketIntelligenceView initialNews={news} />;
  } catch {
    return <BackendOffline />;
  }
}
