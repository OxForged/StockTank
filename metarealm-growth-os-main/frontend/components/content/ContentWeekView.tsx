"use client";

import { PlatformChip } from "@/components/shared/PlatformChip";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ContentItem } from "@/types";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/**
 * Simple week strip over the mock schedule labels ("Tue · 09:00").
 * Becomes a real calendar once dates are ISO in Milestone 4.
 */
export function ContentWeekView({
  items,
  onSelect,
}: {
  items: ContentItem[];
  onSelect: (id: string) => void;
}) {
  const slotted = items.filter(
    (item) =>
      (item.status === "scheduled" || item.status === "awaiting_approval") &&
      item.scheduledFor
  );

  const forDay = (day: string) =>
    slotted.filter((item) => item.scheduledFor?.startsWith(day));

  const placedIds = new Set(
    DAYS.flatMap((day) => forDay(day).map((item) => item.id))
  );
  const unplacedCount = slotted.length - placedIds.size;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {DAYS.map((day) => {
          const dayItems = forDay(day);
          return (
            <Card key={day} className="flex min-h-32 flex-col gap-2 p-2.5">
              <p className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                {day}
                {dayItems.length > 0 && (
                  <span className="tabular-nums">{dayItems.length}</span>
                )}
              </p>
              {dayItems.map((item) => {
                const time = item.scheduledFor?.split(" · ")[1] ?? "";
                return (
                  <div
                    key={item.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelect(item.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onSelect(item.id);
                      }
                    }}
                    className={cn(
                      "cursor-pointer rounded-md border border-border/60 border-l-2 bg-card p-2 transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      item.status === "awaiting_approval"
                        ? "border-l-warning"
                        : "border-l-chart-4"
                    )}
                  >
                    <div className="flex items-center gap-1.5">
                      <PlatformChip
                        platform={item.platform}
                        className="size-5 text-[9px]"
                      />
                      <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                        {time}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs leading-snug">
                      {item.title}
                    </p>
                  </div>
                );
              })}
            </Card>
          );
        })}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Amber rail = waiting for approval · blue rail = scheduled.
        {unplacedCount > 0 &&
          ` ${unplacedCount} scheduled item(s) fall outside this week.`}
      </p>
    </div>
  );
}
