import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Lightbulb } from "lucide-react";
import { CompanyActions } from "@/components/companies/CompanyActions";
import { CompanyContacts } from "@/components/companies/CompanyContacts";
import { CompanyDeals } from "@/components/companies/CompanyDeals";
import { CompanyFacts } from "@/components/companies/CompanyFacts";
import { DealIntelCard } from "@/components/companies/DealIntelCard";
import { CompanyHeader } from "@/components/companies/CompanyHeader";
import { CompanyOutreach } from "@/components/companies/CompanyOutreach";
import { ReachPanel } from "@/components/companies/ReachPanel";
import { TouchTimeline } from "@/components/companies/TouchTimeline";
import { BackendOffline } from "@/components/shared/BackendOffline";
import { WidgetCard } from "@/components/shared/WidgetCard";
import {
  getCompany,
  getContacts,
  getOpportunities,
  getOutreach,
  getTouches,
} from "@/lib/api/server";
import { isOpenStage } from "@/lib/stages";
import type { Company, Contact, Opportunity, OutreachDraft, Touch } from "@/types";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  try {
    const company = await getCompany(id);
    return { title: company?.name ?? "Company" };
  } catch {
    return { title: "Company" };
  }
}

export default async function CompanyProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let company: Company | null = null;
  let deals: Opportunity[] = [];
  let companyTouches: Touch[] = [];
  let companyContacts: Contact[] = [];
  let outreachDrafts: OutreachDraft[] = [];

  try {
    company = await getCompany(id);
    if (company) {
      [deals, companyTouches, companyContacts, outreachDrafts] =
        await Promise.all([
          getOpportunities(id),
          getTouches(id),
          getContacts(id),
          getOutreach(id),
        ]);
    }
  } catch {
    return <BackendOffline />;
  }

  if (!company) notFound();

  deals = [...deals].sort(
    (a, b) =>
      Number(isOpenStage(b.stage)) - Number(isOpenStage(a.stage)) ||
      b.valueMad - a.valueMad
  );
  const openValue = deals
    .filter((opp) => isOpenStage(opp.stage))
    .reduce((sum, opp) => sum + opp.valueMad, 0);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <Link
        href="/companies"
        className="inline-flex w-fit items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        All companies
      </Link>

      <CompanyHeader company={company} />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          {company.reasonToContact && (
            <WidgetCard title="Why contact now" icon={Lightbulb}>
              <p className="text-sm leading-relaxed [word-break:break-word]">
                {company.reasonToContact
                  .split(/(https?:\/\/[^\s]+)/)
                  .map((part, i) =>
                    part.match(/^https?:\/\//) ? (
                      <a
                        key={i}
                        href={part}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary underline underline-offset-2 hover:opacity-80"
                      >
                        {part}
                      </a>
                    ) : (
                      part
                    )
                  )}
              </p>
            </WidgetCard>
          )}
          <ReachPanel company={company} initialContacts={companyContacts} />
          <DealIntelCard company={company} />
          <CompanyDeals deals={deals} />
          <TouchTimeline touches={companyTouches} />
        </div>
        <div className="flex flex-col gap-4">
          <CompanyFacts company={company} openValueMad={openValue} />
          <CompanyContacts contacts={companyContacts} />
          <CompanyOutreach
            companyId={company.id}
            initialDrafts={outreachDrafts}
          />
          <CompanyActions />
        </div>
      </div>
    </div>
  );
}
