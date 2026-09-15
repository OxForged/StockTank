"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  MapPin,
  Phone,
  RefreshCw,
  Sparkles,
  Video,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Meeting, MeetingKind } from "@/types";

const kindMeta: Record<MeetingKind, { icon: LucideIcon; label: string }> = {
  video: { icon: Video, label: "Video call" },
  in_person: { icon: MapPin, label: "In person" },
  call: { icon: Phone, label: "Phone call" },
};

export function MeetingDetailSheet({
  meeting,
  onOpenChange,
  onGeneratePrep,
  generatingPrep = false,
  prepError = null,
}: {
  meeting: Meeting | null;
  onOpenChange: (open: boolean) => void;
  onGeneratePrep?: (meetingId: string) => void;
  generatingPrep?: boolean;
  prepError?: string | null;
}) {
  const meta = meeting ? kindMeta[meeting.kind] : null;
  const KindIcon = meta?.icon;

  return (
    <Sheet open={meeting !== null} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto">
        {meeting && meta && KindIcon && (
          <>
            <SheetHeader>
              <SheetTitle>{meeting.title}</SheetTitle>
              <SheetDescription className="flex items-center gap-1.5">
                <KindIcon className="size-3.5" />
                {meeting.when} · {meeting.durationMin} min · {meta.label}
              </SheetDescription>
            </SheetHeader>

            {meeting.companyId && meeting.company && (
              <Link
                href={`/companies/${meeting.companyId}`}
                className="group inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                {meeting.company}
                <ArrowUpRight className="size-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </Link>
            )}

            {meeting.attendees && meeting.attendees.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Attendees
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {meeting.attendees.map((attendee) => (
                    <span
                      key={attendee}
                      className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2 py-1 text-xs"
                    >
                      <span className="grid size-4 place-items-center rounded-full bg-background text-[9px] font-medium">
                        {initials(attendee)}
                      </span>
                      {attendee}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {meeting.agenda && (
              <div>
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Agenda
                </p>
                <p className="rounded-md border border-border/60 bg-secondary/30 p-3 text-sm leading-relaxed">
                  {meeting.agenda}
                </p>
              </div>
            )}

            <Separator />

            {meeting.status === "upcoming" && (
              <div>
                <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <Sparkles className="size-3.5 text-primary" />
                  Prep brief
                </p>
                {meeting.prep ? (
                  <div className="rounded-md border-l-2 border-l-primary border border-border/60 bg-primary/[0.04] p-3">
                    <p className="text-sm leading-relaxed">{meeting.prep}</p>
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      Sample brief — the Meeting Assistant generates these
                      automatically from Milestone 6.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-border/60 p-4 text-center">
                    <p className="text-xs text-muted-foreground">
                      No prep brief yet for this meeting.
                    </p>
                    {onGeneratePrep && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={generatingPrep}
                        onClick={() => onGeneratePrep(meeting.id)}
                      >
                        <RefreshCw className={cn(generatingPrep && "animate-spin")} />
                        {generatingPrep ? "Writing…" : "Generate prep brief"}
                      </Button>
                    )}
                    {prepError && (
                      <p className="text-[11px] text-warning">{prepError}</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {meeting.status === "completed" && (
              <div>
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Notes
                </p>
                {meeting.notes ? (
                  <p className="rounded-md border border-border/60 bg-secondary/30 p-3 text-sm leading-relaxed">
                    {meeting.notes}
                  </p>
                ) : (
                  <div className="rounded-md border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">
                    No notes were logged for this meeting.
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
