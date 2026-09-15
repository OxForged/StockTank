import { Crosshair } from "lucide-react";
import { StageBadge } from "@/components/shared/StageBadge";
import { WidgetCard } from "@/components/shared/WidgetCard";
import { formatMad } from "@/lib/format";
import type { Opportunity } from "@/types";

export function OpportunityWidget({
  opportunities,
  className,
}: {
  opportunities: Opportunity[];
  className?: string;
}) {
  const top = [...opportunities]
    .sort((a, b) => b.valueMad - a.valueMad)
    .slice(0, 5);

  return (
    <WidgetCard
      title="Open opportunities"
      icon={Crosshair}
      action={{ label: "View pipeline", href: "/opportunities" }}
      className={className}
    >
      <ul className="divide-y divide-border/60">
        {top.map((opp) => (
          <li key={opp.id} className="py-3 first:pt-0 last:pb-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{opp.company}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {opp.title}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="font-mono text-sm tabular-nums">
                  {formatMad(opp.valueMad)}
                </span>
                <StageBadge stage={opp.stage} />
              </div>
            </div>
            <p className="mt-1.5 truncate text-xs text-muted-foreground">
              <span className="text-foreground/70">Next:</span>{" "}
              {opp.nextAction} · {opp.nextActionDue}
            </p>
          </li>
        ))}
      </ul>
    </WidgetCard>
  );
}
