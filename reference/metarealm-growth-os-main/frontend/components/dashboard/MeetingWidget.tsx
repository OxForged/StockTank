import {
  CalendarDays,
  MapPin,
  Phone,
  Video,
  type LucideIcon,
} from "lucide-react";
import { WidgetCard } from "@/components/shared/WidgetCard";
import type { Meeting, MeetingKind } from "@/types";

const kindIcon: Record<MeetingKind, LucideIcon> = {
  video: Video,
  in_person: MapPin,
  call: Phone,
};

export function MeetingWidget({
  meetings,
  className,
}: {
  meetings: Meeting[];
  className?: string;
}) {
  return (
    <WidgetCard
      title="Upcoming meetings"
      icon={CalendarDays}
      action={{ label: "Calendar", href: "/meetings" }}
      className={className}
    >
      <ul className="divide-y divide-border/60">
        {meetings.map((meeting) => {
          const [day, time] = meeting.when.split(" · ");
          const Icon = kindIcon[meeting.kind];
          return (
            <li
              key={meeting.id}
              className="flex gap-3 py-3 first:pt-0 last:pb-0"
            >
              <div className="w-16 shrink-0">
                <p className="font-mono text-sm tabular-nums">{time ?? day}</p>
                <p className="text-[11px] text-muted-foreground">
                  {time ? day : ""}
                </p>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{meeting.title}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {meeting.agenda ?? meeting.company ?? "No agenda yet"}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <Icon className="size-3.5 text-muted-foreground" />
                <span className="text-[11px] text-muted-foreground">
                  {meeting.durationMin}m
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </WidgetCard>
  );
}
