import {
  CalendarDays,
  History,
  Mail,
  Phone,
  StickyNote,
  Ticket,
  type LucideIcon,
} from "lucide-react";
import { WidgetCard } from "@/components/shared/WidgetCard";
import { cn } from "@/lib/utils";
import type { Touch, TouchKind } from "@/types";

const kindMeta: Record<TouchKind, { icon: LucideIcon; className: string }> = {
  email: { icon: Mail, className: "text-chart-3" },
  call: { icon: Phone, className: "text-chart-4" },
  meeting: { icon: CalendarDays, className: "text-chart-5" },
  event: { icon: Ticket, className: "text-chart-2" },
  note: { icon: StickyNote, className: "text-muted-foreground" },
};

export function TouchTimeline({
  touches,
  className,
}: {
  touches: Touch[];
  className?: string;
}) {
  return (
    <WidgetCard title="Touch history" icon={History} className={className}>
      {touches.length === 0 ? (
        <div className="rounded-md border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
          No touches logged yet.
        </div>
      ) : (
        <ul className="space-y-3">
          {touches.map((touch) => {
            const meta = kindMeta[touch.kind];
            const Icon = meta.icon;
            return (
              <li key={touch.id} className="flex items-start gap-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-secondary/70">
                  <Icon className={cn("size-3.5", meta.className)} />
                </span>
                <p className="min-w-0 flex-1 text-sm leading-snug">
                  {touch.summary}
                </p>
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  {touch.when}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </WidgetCard>
  );
}
