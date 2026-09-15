"use client";

import { useState } from "react";
import {
  CalendarDays,
  ChevronRight,
  MapPin,
  Phone,
  Plus,
  CalendarPlus,
  Trash2,
  Video,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createMeeting, deleteMeeting, runAgent } from "@/lib/api/client";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
import type { Company, Meeting, MeetingKind, MeetingStatus } from "@/types";
import { MeetingDetailSheet } from "./MeetingDetailSheet";
import { NewMeetingSheet } from "./NewMeetingSheet";

const kindIcon: Record<MeetingKind, LucideIcon> = {
  video: Video,
  in_person: MapPin,
  call: Phone,
};

/**
 * Owns meeting state for the session. In Milestone 4 these handlers
 * become API calls; the presentation below does not change.
 */
export function MeetingsView({
  initialMeetings,
  companies,
}: {
  initialMeetings: Meeting[];
  companies: Company[];
}) {
  const [meetings, setMeetings] = useState(initialMeetings);
  const [tab, setTab] = useState<MeetingStatus>("upcoming");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [prepBusy, setPrepBusy] = useState(false);
  const [prepError, setPrepError] = useState<string | null>(null);

  const upcoming = meetings.filter((meeting) => meeting.status === "upcoming");
  const completed = meetings.filter(
    (meeting) => meeting.status === "completed"
  );
  const shown = tab === "upcoming" ? upcoming : completed;

  const selectedMeeting =
    meetings.find((meeting) => meeting.id === selectedId) ?? null;

  const onDelete = async (id: string, title: string) => {
    if (!confirm(`Delete the meeting "${title}"?`)) return;
    try {
      await deleteMeeting(id);
      setMeetings((prev) => prev.filter((m) => m.id !== id));
    } catch (error) {
      console.error(error);
    }
  };

  const generatePrep = async (meetingId: string) => {
    setPrepBusy(true);
    setPrepError(null);
    try {
      const result = await runAgent("meeting-assistant", { meetingId });
      const prep = result.details?.prep;
      if (result.status === "completed" && typeof prep === "string") {
        setMeetings((prev) =>
          prev.map((meeting) =>
            meeting.id === meetingId ? { ...meeting, prep } : meeting
          )
        );
      } else {
        setPrepError(result.summary);
      }
    } catch (error) {
      console.error(error);
      setPrepError("Something went wrong. Is the backend running?");
    } finally {
      setPrepBusy(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          value={tab}
          onValueChange={(value) => setTab(value as MeetingStatus)}
        >
          <TabsList>
            <TabsTrigger value="upcoming">
              Upcoming
              <span className="tabular-nums text-muted-foreground">
                {upcoming.length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="completed">
              Past
              <span className="tabular-nums text-muted-foreground">
                {completed.length}
              </span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <Button size="sm" onClick={() => setNewOpen(true)}>
          <Plus />
          New meeting
        </Button>
      </div>

      <Card className="overflow-hidden">
        <ul className="divide-y divide-border/60">
          {shown.map((meeting) => {
            const [day, time] = meeting.when.split(" · ");
            const Icon = kindIcon[meeting.kind];
            return (
              <li key={meeting.id} className="group relative">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedId(meeting.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedId(meeting.id);
                    }
                  }}
                  className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="w-20 shrink-0">
                    <p className="font-mono text-sm tabular-nums">
                      {time ?? day}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {time ? day : ""}
                    </p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {meeting.title}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {meeting.agenda ?? meeting.company ?? "No agenda yet"}
                    </p>
                  </div>
                  {meeting.prep && (
                    <span className="hidden shrink-0 rounded-md border border-primary/25 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary sm:block">
                      Prep ready
                    </span>
                  )}
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Icon className="size-3.5 text-muted-foreground" />
                    <span className="text-[11px] text-muted-foreground">
                      {meeting.durationMin}m
                    </span>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground/50" />
                </div>
                {meeting.startsAt && (
                  <a
                    href={`${API_URL}/meetings/${meeting.id}/ics`}
                    onClick={(e) => e.stopPropagation()}
                    aria-label="Add to your calendar"
                    title="Add to your calendar"
                    className="absolute right-10 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-md bg-card text-muted-foreground opacity-0 transition-all hover:bg-accent hover:text-foreground group-hover:opacity-100"
                  >
                    <CalendarPlus className="size-3.5" />
                  </a>
                )}
                <button
                  onClick={() => onDelete(meeting.id, meeting.title)}
                  aria-label={`Delete ${meeting.title}`}
                  className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-md bg-card text-muted-foreground opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
        {shown.length === 0 && (
          <div className="flex flex-col items-center gap-2 p-8 text-center text-sm text-muted-foreground">
            <CalendarDays className="size-5" />
            No meetings here yet.
          </div>
        )}
      </Card>

      <MeetingDetailSheet
        meeting={selectedMeeting}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedId(null);
            setPrepError(null);
          }
        }}
        onGeneratePrep={generatePrep}
        generatingPrep={prepBusy}
        prepError={prepError}
      />
      <NewMeetingSheet
        open={newOpen}
        onOpenChange={setNewOpen}
        companies={companies}
        onCreate={async (draft) => {
          try {
            const created = await createMeeting(draft);
            setMeetings((prev) => [created, ...prev]);
            setTab("upcoming");
          } catch (error) {
            console.error(error);
          }
        }}
      />
    </div>
  );
}
