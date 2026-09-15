import { Crosshair } from "lucide-react";
import { StageBadge } from "@/components/shared/StageBadge";
import { WidgetCard } from "@/components/shared/WidgetCard";
import { formatMad } from "@/lib/format";
import type { Opportunity } from "@/types";

export function CompanyDeals({ deals }: { deals: Opportunity[] }) {
  return (
    <WidgetCard
      title="Opportunities"
      icon={Crosshair}
      action={{ label: "Open board", href: "/opportunities" }}
    >
      {deals.length === 0 ? (
        <div className="rounded-md border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
          No deals yet — create one from the pipeline board.
        </div>
      ) : (
        <ul className="divide-y divide-border/60">
          {deals.map((deal) => (
            <li key={deal.id} className="py-3 first:pt-0 last:pb-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{deal.title}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    <span className="text-foreground/70">Next:</span>{" "}
                    {deal.nextAction} · {deal.nextActionDue}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="font-mono text-sm tabular-nums">
                    {formatMad(deal.valueMad)}
                  </span>
                  <StageBadge stage={deal.stage} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </WidgetCard>
  );
}
