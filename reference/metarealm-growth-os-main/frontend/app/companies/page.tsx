import type { Metadata } from "next";
import { CompanyDirectory } from "@/components/companies/CompanyDirectory";
import { BackendOffline } from "@/components/shared/BackendOffline";
import { getCompanies, getOpportunities } from "@/lib/api/server";

export const metadata: Metadata = { title: "Companies" };
export const dynamic = "force-dynamic";

export default async function CompaniesPage() {
  try {
    const [companies, opportunities] = await Promise.all([
      getCompanies(),
      getOpportunities(),
    ]);
    return (
      <CompanyDirectory companies={companies} opportunities={opportunities} />
    );
  } catch {
    return <BackendOffline />;
  }
}
