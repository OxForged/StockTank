import { Building2, CalendarDays, Crosshair, Wallet } from "lucide-react";
import { ActivityTimeline } from "@/components/dashboard/ActivityTimeline";
import { CompanyWidget } from "@/components/dashboard/CompanyWidget";
import { ContentApprovalWidget } from "@/components/dashboard/ContentApprovalWidget";
import { DashboardGreeting } from "@/components/dashboard/DashboardGreeting";
import { ExecutiveBrief } from "@/components/dashboard/ExecutiveBrief";
import { MeetingWidget } from "@/components/dashboard/MeetingWidget";
import { NewsWidget } from "@/components/dashboard/NewsWidget";
import { OpportunityWidget } from "@/components/dashboard/OpportunityWidget";
import { PipelineCard } from "@/components/dashboard/PipelineCard";
import { PlanMyDayHero } from "@/components/dashboard/PlanMyDayHero";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { StatCard } from "@/components/dashboard/StatCard";
import { TodaysFocus } from "@/components/dashboard/TodaysFocus";
import { BackendOffline } from "@/components/shared/BackendOffline";
import {
  getActivity,
  getCompanies,
  getContentItems,
  getExecutiveBrief,
  getFocusTasks,
  getMeetings,
  getNews,
  getOpportunities,
} from "@/lib/api/server";
import { formatMad } from "@/lib/format";
import { OPEN_STAGES, STAGE_LABELS, isOpenStage } from "@/lib/stages";
import type { PipelineStageSummary } from "@/types";

export const dynamic = "force-dynamic";

/**
 * CEO dashboard. The page composes: it fetches from the API layer and
 * hands typed data to presentation components. Exactly the same
 * components as the mock era — only this file changed in Milestone 4.
 */
export default async function DashboardPage() {
  try {
    const [
      companies,
      opportunities,
      meetings,
      contentItems,
      news,
      brief,
      focusTasks,
      activity,
    ] = await Promise.all([
      getCompanies(),
      getOpportunities(),
      getMeetings(),
      getContentItems(),
      getNews(),
      getExecutiveBrief(),
      getFocusTasks(),
      getActivity(),
    ]);

    const openOpportunities = opportunities.filter((opp) =>
      isOpenStage(opp.stage)
    );
    const pipelineTotal = openOpportunities.reduce(
      (sum, opp) => sum + opp.valueMad,
      0
    );
    const pipelineByStage: PipelineStageSummary[] = OPEN_STAGES.map(
      (stage) => {
        const deals = openOpportunities.filter((opp) => opp.stage === stage);
        return {
          stage,
          label: STAGE_LABELS[stage],
          count: deals.length,
          valueMad: deals.reduce((sum, opp) => sum + opp.valueMad, 0),
        };
      }
    );
    const upcomingMeetings = meetings.filter(
      (meeting) => meeting.status === "upcoming"
    );
    const companiesToContact = companies
      .filter(
        (company) => company.status === "prospect" && company.reasonToContact
      )
      .slice(0, 4);
    const awaitingApproval = contentItems.filter(
      (item) => item.status === "awaiting_approval"
    );

    return (
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <DashboardGreeting name="Marouane" />
          <QuickActions />
        </div>

        <PlanMyDayHero />

        <ExecutiveBrief brief={brief} />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Open opportunities"
            value={String(openOpportunities.length)}
            icon={Crosshair}
            delta={{ label: "+2", direction: "up" }}
            hint="vs last week"
          />
          <StatCard
            label="Pipeline value"
            value={formatMad(pipelineTotal)}
            icon={Wallet}
            delta={{ label: "+330K", direction: "up" }}
            hint="Inwi entered play"
          />
          <StatCard
            label="Companies tracked"
            value={String(companies.length)}
            icon={Building2}
            hint="3 added this week"
          />
          <StatCard
            label="Meetings this week"
            value={String(upcomingMeetings.length)}
            icon={CalendarDays}
            hint="next: today 14:00"
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="flex flex-col gap-4 lg:col-span-2">
            <TodaysFocus tasks={focusTasks} />
            <OpportunityWidget opportunities={openOpportunities} />
            <CompanyWidget companies={companiesToContact} />
          </div>
          <div className="flex flex-col gap-4">
            <MeetingWidget meetings={upcomingMeetings} />
            <ContentApprovalWidget items={awaitingApproval} />
            <PipelineCard stages={pipelineByStage} />
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <NewsWidget items={news} className="lg:col-span-2" />
          <ActivityTimeline items={activity} />
        </div>
      </div>
    );
  } catch {
    return <BackendOffline />;
  }
}
