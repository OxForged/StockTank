"use client";

import { useState } from "react";
import { CalendarDays, Check, Undo2 } from "lucide-react";
import { ContentStatusBadge } from "@/components/shared/ContentStatusBadge";
import { PlatformChip } from "@/components/shared/PlatformChip";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { ContentItem } from "@/types";

interface ContentDetailSheetProps {
  item: ContentItem | null;
  onOpenChange: (open: boolean) => void;
  onApprove: (id: string) => void;
  onSendBack: (id: string) => void;
  onSubmit: (id: string) => void;
  onSchedule: (id: string, dateStr: string) => void;
}

export function ContentDetailSheet({
  item,
  onOpenChange,
  onApprove,
  onSendBack,
  onSubmit,
  onSchedule,
}: ContentDetailSheetProps) {
  const [day, setDay] = useState("");
  return (
    <Sheet open={item !== null} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto">
        {item && (
          <>
            <div className="flex items-start gap-3">
              <PlatformChip platform={item.platform} className="mt-0.5" />
              <SheetHeader>
                <SheetTitle className="leading-snug">{item.title}</SheetTitle>
                <SheetDescription>
                  {item.scheduledFor ?? "Unscheduled"}
                  {item.author ? ` · ${item.author}` : ""}
                </SheetDescription>
              </SheetHeader>
            </div>

            <div className="flex items-center justify-between">
              <ContentStatusBadge status={item.status} />
            </div>

            {item.body && (
              <div>
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Draft
                </p>
                <p className="whitespace-pre-line rounded-md border border-border/60 bg-secondary/30 p-3 text-sm leading-relaxed">
                  {item.body}
                </p>
              </div>
            )}

            <Separator />

            {item.status === "awaiting_approval" && (
              <div className="grid grid-cols-2 gap-2">
                <Button onClick={() => onApprove(item.id)}>
                  <Check />
                  Approve
                </Button>
                <Button variant="outline" onClick={() => onSendBack(item.id)}>
                  <Undo2 />
                  Send back
                </Button>
              </div>
            )}

            {item.status === "draft" && (
              <Button onClick={() => onSubmit(item.id)}>
                <Check />
                Submit for approval
              </Button>
            )}

            {(item.status === "awaiting_approval" ||
              item.status === "scheduled") && (
              <div className="space-y-1.5 rounded-lg border border-border/60 p-3">
                <p className="text-xs font-medium">
                  Pick the day yourself. More than one post per day is fine.
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={day}
                    onChange={(e) => setDay(e.target.value)}
                    className="flex-1 rounded-md border border-input bg-background px-2.5 py-1.5 text-sm outline-none focus:border-primary/60"
                  />
                  <Button
                    size="sm"
                    disabled={!day}
                    onClick={() => day && onSchedule(item.id, day)}
                  >
                    <CalendarDays />
                    Add to schedule
                  </Button>
                </div>
              </div>
            )}

            {item.status === "scheduled" && (
              <Button variant="outline" onClick={() => onSendBack(item.id)}>
                <Undo2 />
                Unschedule — back to draft
              </Button>
            )}

            {item.status === "published" && (
              <p className="text-xs text-muted-foreground">
                Published — read only.
              </p>
            )}

            <SheetFooter>
              <p className="text-[11px] text-muted-foreground">
                Status changes save to your database. AI-drafted posts arrive
                with the Content Strategist in Milestone 6.
              </p>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
