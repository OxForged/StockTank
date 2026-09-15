import type { Metadata } from "next";
import { OpportunitiesView } from "@/components/opportunities/OpportunitiesView";
import { BackendOffline } from "@/components/shared/BackendOffline";
import { getCompanies, getOpportunities } from "@/lib/api/server";

export const metadata: Metadata = { title: "Opportunities" };
export const dynamic = "force-dynamic";

export default async function OpportunitiesPage() {
  try {
    const [deals, companies] = await Promise.all([
      getOpportunities(),
      getCompanies(),
    ]);
    return <OpportunitiesView initialDeals={deals} companies={companies} />;
  } catch {
    return <BackendOffline />;
  }
}
