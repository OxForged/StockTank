"use client";

import { useState } from "react";
import { Bookmark, ChevronRight, Plus, Sparkles, Sun, Trash2 } from "lucide-react";
import { ContentStatusBadge } from "@/components/shared/ContentStatusBadge";
import { PlatformChip } from "@/components/shared/PlatformChip";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  createContentItem,
  deleteContent,
  listContentItems,
  runAgent,
  toggleSaveContent,
  updateContentItem,
} from "@/lib/api/client";
import type { ContentItem, ContentStatus } from "@/types";
import { AiDraftSheet } from "./AiDraftSheet";
import { cn } from "@/lib/utils";
import { ContentDetailSheet } from "./ContentDetailSheet";
import { ContentWeekView } from "./ContentWeekView";
import { NewContentSheet } from "./NewContentSheet";

type StatusFilter = "all" | ContentStatus;
type ViewMode = "queue" | "week";

const TOPIC_LABELS: Record<string, string> = {
  company: "Company",
  morocco: "Morocco",
  mena: "MENA",
  web3: "Web3",
  drama: "Drama",
};

const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "awaiting_approval", label: "Needs approval" },
  { value: "draft", label: "Drafts" },
  { value: "scheduled", label: "Scheduled" },
  { value: "published", label: "Published" },
];

/**
 * Owns content state for the session and persists status moves and new
 * drafts through the API. AI drafting arrives in Milestone 6.
 */
export function ContentStudioView({
  initialItems,
}: {
  initialItems: ContentItem[];
}) {
  const [items, setItems] = useState(initialItems);
  const [view, setView] = useState<ViewMode>("queue");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [fillingMorning, setFillingMorning] = useState(false);
  const [morningNote, setMorningNote] = useState<string | null>(null);

  const fillMorning = async () => {
    setFillingMorning(true);
    setMorningNote(null);
    try {
      const result = await runAgent("content-strategist", { batch: true });
      setMorningNote(result.summary);
      if (result.status === "completed") {
        setItems(await listContentItems());
        setView("queue");
        setStatus("awaiting_approval");
      }
    } catch (error) {
      console.error(error);
      setMorningNote("Something went wrong. Is Ollama running?");
    } finally {
      setFillingMorning(false);
    }
  };

  const setItemSchedule = (id: string, dateStr: string) => {
    // dateStr is yyyy-mm-dd from the picker. The week board groups by
    // short day names, so convert. More than one post per day is fine.
    const day = new Date(`${dateStr}T00:00`).toLocaleDateString("en-US", {
      weekday: "short",
    });
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, status: "scheduled", scheduledFor: day } : item
      )
    );
    updateContentItem(id, { status: "scheduled", scheduledFor: day }).catch(
      console.error
    );
  };

  const setItemStatus = (id: string, next: ContentStatus) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: next } : item))
    );
    updateContentItem(id, { status: next }).catch(console.error);
  };

  const countFor = (filter: StatusFilter) =>
    filter === "all"
      ? items.length
      : items.filter((item) => item.status === filter).length;

  const filtered =
    status === "all" ? items : items.filter((item) => item.status === status);

  const selectedItem = items.find((item) => item.id === selectedId) ?? null;

  const onSave = async (id: string) => {
    try {
      const res = await toggleSaveContent(id);
      setItems((prev) =>
        prev.map((it) => (it.id === id ? { ...it, saved: res.saved } : it))
      );
    } catch (error) {
      console.error(error);
    }
  };

  const onDelete = async (id: string) => {
    try {
      await deleteContent(id);
      setItems((prev) => prev.filter((it) => it.id !== id));
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          value={view}
          onValueChange={(value) => setView(value as ViewMode)}
        >
          <TabsList>
            <TabsTrigger value="queue">Queue</TabsTrigger>
            <TabsTrigger value="week">This week</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={fillMorning} disabled={fillingMorning}>
            <Sun />
            {fillingMorning ? "Filling…" : "Fill my morning"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setAiOpen(true)}>
            <Sparkles />
            AI draft
          </Button>
          <Button size="sm" variant="outline" onClick={() => setNewOpen(true)}>
            <Plus />
            New draft
          </Button>
        </div>
      </div>

      {morningNote && (
        <p className="rounded-md border border-border/60 bg-secondary/30 px-3 py-2 text-xs text-muted-foreground">
          {morningNote}
        </p>
      )}
      <p className="text-[11px] text-muted-foreground">
        Drafts you do not save or schedule are cleared next morning. Press the
        bookmark to keep one, or schedule it, and it stays.
      </p>

      {view === "queue" ? (
        <>
          <Tabs
            value={status}
            onValueChange={(value) => setStatus(value as StatusFilter)}
          >
            <TabsList>
              {FILTERS.map((filter) => (
                <TabsTrigger key={filter.value} value={filter.value}>
                  {filter.label}
                  <span className="tabular-nums text-muted-foreground">
                    {countFor(filter.value)}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <Card className="overflow-hidden">
            <ul className="divide-y divide-border/60">
              {filtered.map((item) => (
                <li key={item.id}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedId(item.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedId(item.id);
                      }
                    }}
                    className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <PlatformChip platform={item.platform} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {item.title}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {item.scheduledFor
                          ? `${item.scheduledFor}${item.author ? ` · ${item.author}` : ""}`
                          : (item.author ?? "Unscheduled")}
                      </p>
                    </div>
                    {item.topic && TOPIC_LABELS[item.topic] && (
                      <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                        {TOPIC_LABELS[item.topic]}
                      </span>
                    )}
                    <ContentStatusBadge status={item.status} />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSave(item.id);
                      }}
                      aria-label={item.saved ? "Unsave" : "Save"}
                      className={cn(
                        "grid size-7 shrink-0 place-items-center rounded-md transition-colors hover:bg-accent",
                        item.saved ? "text-primary" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Bookmark className={cn("size-3.5", item.saved && "fill-current")} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(item.id);
                      }}
                      aria-label="Delete"
                      className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            {filtered.length === 0 && (
              <div className="p-8 text-center text-sm text-muted-foreground">
                Nothing in this list.
              </div>
            )}
          </Card>
        </>
      ) : (
        <ContentWeekView items={items} onSelect={setSelectedId} />
      )}

      <ContentDetailSheet
        item={selectedItem}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
        onApprove={(id) =>
          setItemSchedule(id, new Date().toISOString().slice(0, 10))
        }
        onSchedule={setItemSchedule}
        onSendBack={(id) => setItemStatus(id, "draft")}
        onSubmit={(id) => setItemStatus(id, "awaiting_approval")}
      />
      <AiDraftSheet
        open={aiOpen}
        onOpenChange={setAiOpen}
        onDrafted={async () => {
          setItems(await listContentItems());
          setView("queue");
          setStatus("awaiting_approval");
        }}
      />
      <NewContentSheet
        open={newOpen}
        onOpenChange={setNewOpen}
        onCreate={async (draft) => {
          try {
            const created = await createContentItem(draft);
            setItems((prev) => [created, ...prev]);
            setView("queue");
            setStatus("draft");
          } catch (error) {
            console.error(error);
          }
        }}
      />
    </div>
  );
}
