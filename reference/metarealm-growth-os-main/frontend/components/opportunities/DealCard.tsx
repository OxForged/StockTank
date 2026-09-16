"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatMad, initials } from "@/lib/format";
import { OPEN_STAGES, nextStage, prevStage } from "@/lib/stages";
import type { Opportunity, OpportunityStage } from "@/types";

interface DealCardProps {
  deal: Opportunity;
  onMove: (id: string, stage: OpportunityStage) => void;
  onSelect: (id: string) => void;
}

export function DealCard({ deal, onMove, onSelect }: DealCardProps) {
  const isFirst = deal.stage === OPEN_STAGES[0];
  const isLast = deal.stage === OPEN_STAGES[OPEN_STAGES.length - 1];

  return (
    <div
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData("text/plain", deal.id);
        event.dataTransfer.effectAllowed = "move";
      }}
      onClick={() => onSelect(deal.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(deal.id);
        }
      }}
      role="button"
      tabIndex={0}
      className="group cursor-grab rounded-md border border-border bg-card p-3 shadow-sm transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="truncate text-sm font-medium">{deal.company}</p>
        <span className="shrink-0 font-mono text-sm tabular-nums">
          {formatMad(deal.valueMad)}
        </span>
      </div>
      <p className="mt-0.5 truncate text-xs text-muted-foreground">
        {deal.title}
      </p>
      <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
        <span className="text-foreground/70">Next:</span> {deal.nextAction}
      </p>
      <div className="mt-2.5 flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <span className="grid size-5 place-items-center rounded-full bg-secondary text-[10px] font-medium">
            {initials(deal.owner)}
          </span>
          <span className="text-[11px] text-muted-foreground">
            {deal.nextActionDue}
          </span>
        </span>
        <span className="flex opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
          <button
            onClick={(event) => {
              event.stopPropagation();
              onMove(deal.id, prevStage(deal.stage));
            }}
            disabled={isFirst}
            aria-label="Move to previous stage"
            className="grid size-6 place-items-center rounded transition-colors hover:bg-accent disabled:opacity-30"
          >
            <ChevronLeft className="size-3.5" />
          </button>
          <button
            onClick={(event) => {
              event.stopPropagation();
              onMove(deal.id, nextStage(deal.stage));
            }}
            disabled={isLast}
            aria-label="Move to next stage"
            className="grid size-6 place-items-center rounded transition-colors hover:bg-accent disabled:opacity-30"
          >
            <ChevronRight className="size-3.5" />
          </button>
        </span>
      </div>
    </div>
  );
}
