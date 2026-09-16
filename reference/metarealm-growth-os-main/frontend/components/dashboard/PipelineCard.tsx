import { Layers } from "lucide-react";
import { WidgetCard } from "@/components/shared/WidgetCard";
import { formatMad } from "@/lib/format";
import type { OpportunityStage, PipelineStageSummary } from "@/types";

const stageColor: Record<OpportunityStage, string> = {
  lead: "bg-foreground/20",
  contacted: "bg-chart-4",
  meeting: "bg-chart-5",
  proposal: "bg-chart-3",
  negotiation: "bg-chart-1",
  closed_won: "bg-success",
  closed_lost: "bg-destructive",
};

export function PipelineCard({
  stages,
  className,
}: {
  stages: PipelineStageSummary[];
  className?: string;
}) {
  const totalValue = stages.reduce((sum, s) => sum + s.valueMad, 0);
  const totalCount = stages.reduce((sum, s) => sum + s.count, 0);

  return (
    <WidgetCard
      title="Pipeline"
      icon={Layers}
      action={{ label: "Open board", href: "/opportunities" }}
      className={className}
    >
      <div className="flex items-baseline gap-2">
        <p className="font-mono text-xl font-semibold tabular-nums">
          {formatMad(totalValue)}
        </p>
        <span className="text-xs text-muted-foreground">
          across {totalCount} open deals
        </span>
      </div>

      <div className="mt-3 flex h-2 w-full overflow-hidden rounded-full bg-secondary">
        {stages.map((stage) => (
          <div
            key={stage.stage}
            className={stageColor[stage.stage]}
            style={{ width: `${(stage.valueMad / totalValue) * 100}%` }}
            title={`${stage.label}: ${formatMad(stage.valueMad)}`}
          />
        ))}
      </div>

      <ul className="mt-4 space-y-2">
        {stages.map((stage) => (
          <li
            key={stage.stage}
            className="flex items-center justify-between gap-3 text-xs"
          >
            <span className="flex items-center gap-2">
              <span
                className={`size-2 rounded-full ${stageColor[stage.stage]}`}
              />
              {stage.label}
            </span>
            <span className="font-mono tabular-nums text-muted-foreground">
              {stage.count} · {formatMad(stage.valueMad)}
            </span>
          </li>
        ))}
      </ul>
    </WidgetCard>
  );
}
