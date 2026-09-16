import {
  CalendarDays,
  Cpu,
  Crosshair,
  History,
  Mail,
  PenSquare,
  type LucideIcon,
} from "lucide-react";
import { WidgetCard } from "@/components/shared/WidgetCard";
import { cn } from "@/lib/utils";
import type { ActivityItem, ActivityKind } from "@/types";

const kindMeta: Record<ActivityKind, { icon: LucideIcon; className: string }> = {
  opportunity: { icon: Crosshair, className: "text-chart-1" },
  meeting: { icon: CalendarDays, className: "text-chart-4" },
  content: { icon: PenSquare, className: "text-chart-5" },
  email: { icon: Mail, className: "text-chart-3" },
  system: { icon: Cpu, className: "text-muted-foreground" },
};

export function ActivityTimeline({
  items,
  className,
}: {
  items: ActivityItem[];
  className?: string;
}) {
  return (
    <WidgetCard title="Recent activity" icon={History} className={className}>
      <ul className="space-y-3">
        {items.map((item) => {
          const meta = kindMeta[item.kind];
          const Icon = meta.icon;
          return (
            <li key={item.id} className="flex items-start gap-3">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-secondary/70">
                <Icon className={cn("size-3.5", meta.className)} />
              </span>
              <p className="min-w-0 flex-1 text-sm leading-snug">
                {item.text}
              </p>
              <span className="shrink-0 text-[11px] text-muted-foreground">
                {item.time}
              </span>
            </li>
          );
        })}
      </ul>
    </WidgetCard>
  );
}
