import { BarChart3, FileText, HeartHandshake, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMad } from "@/lib/format";

interface Analytics {
  pipeline: {
    stages: { stage: string; count: number; valueMad: number }[];
    totalValueMad: number;
    wonValueMad: number;
    dealCount: number;
  };
  relationships: { byStatus: Record<string, number>; companyCount: number };
  content: {
    byStatus: Record<string, number>;
    byTopic: Record<string, number>;
    byPlatform: Record<string, number>;
    total: number;
  };
  work: { tasksDone: number; tasksOpen: number };
  news: { total: number };
}

const LABEL: Record<string, string> = {
  prospect: "Prospects", contacted: "Contacted", in_talks: "In talks",
  proposal: "Proposal sent", won: "Won", lost: "Lost",
  awaiting_approval: "Waiting approval", draft: "Drafts",
  scheduled: "Scheduled", published: "Published",
  company: "Company", morocco: "Morocco", mena: "MENA",
  web3: "Web3", drama: "Drama", general: "General",
  x: "X", linkedin: "LinkedIn",
};

function Bars({ data }: { data: Record<string, number> }) {
  const entries = Object.entries(data).filter(([, v]) => v > 0);
  const max = Math.max(1, ...entries.map(([, v]) => v));
  if (entries.length === 0)
    return <p className="text-xs text-muted-foreground">Nothing yet.</p>;
  return (
    <div className="space-y-2">
      {entries.map(([key, value]) => (
        <div key={key} className="flex items-center gap-2 text-xs">
          <span className="w-28 shrink-0 text-muted-foreground">
            {LABEL[key] ?? key}
          </span>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${(value / max) * 100}%` }}
            />
          </div>
          <span className="w-6 text-right font-mono tabular-nums">{value}</span>
        </div>
      ))}
    </div>
  );
}

export function AnalyticsView({ data }: { data: Analytics }) {
  const stageMap = Object.fromEntries(
    data.pipeline.stages.map((s) => [s.stage, s.count])
  );
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <BarChart3 className="size-5 text-primary" />
          Analytics
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your real numbers, pipeline, content, relationships. Updated live
          from your data.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">Open pipeline value</p>
            <p className="mt-1 font-mono text-xl tabular-nums">
              {formatMad(data.pipeline.totalValueMad - data.pipeline.wonValueMad)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">Won so far</p>
            <p className="mt-1 font-mono text-xl tabular-nums text-primary">
              {formatMad(data.pipeline.wonValueMad)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">Tasks finished</p>
            <p className="mt-1 font-mono text-xl tabular-nums">
              {data.work.tasksDone}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[13px]">
              <Wallet className="size-4 text-primary" />
              Pipeline, deals by stage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Bars data={stageMap} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[13px]">
              <HeartHandshake className="size-4 text-primary" />
              Relationships, companies by status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Bars data={data.relationships.byStatus} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[13px]">
              <FileText className="size-4 text-primary" />
              Content, by status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Bars data={data.content.byStatus} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[13px]">
              <FileText className="size-4 text-primary" />
              Content, by topic
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Bars data={data.content.byTopic} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
