"use client";

import { useState } from "react";
import { Bookmark, ExternalLink, Newspaper, RefreshCw, Sparkles, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { deleteNews, runAgent, toggleSaveNews } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import type { NewsItem, NewsRegion } from "@/types";

type RegionFilter = "all" | NewsRegion;

const REGION_LABEL: Record<NewsRegion, string> = {
  morocco: "Morocco",
  mena: "MENA",
  web3: "Web3",
  gaming: "Drama",
};

export function MarketIntelligenceView({
  initialNews,
}: {
  initialNews: NewsItem[];
}) {
  const [news, setNews] = useState(initialNews);
  const [region, setRegion] = useState<RegionFilter>("all");
  const [refreshing, setRefreshing] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [researchOpen, setResearchOpen] = useState(false);
  const [topic, setTopic] = useState("");
  const [researching, setResearching] = useState(false);
  const [researchNote, setResearchNote] = useState<string | null>(null);

  const filtered =
    region === "all" ? news : news.filter((item) => item.region === region);

  const refresh = async () => {
    setRefreshing(true);
    setNote(null);
    try {
      const result = await runAgent("market-intelligence");
      setNote(result.summary);
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/news`,
        { cache: "no-store" }
      );
      if (res.ok) setNews(await res.json());
    } catch (error) {
      console.error(error);
      setNote("Something went wrong. Is the backend running?");
    } finally {
      setRefreshing(false);
    }
  };

  const research = async () => {
    if (!topic.trim()) return;
    setResearching(true);
    setResearchNote(null);
    try {
      const result = await runAgent("research-analyst", { topic: topic.trim() });
      setResearchNote(result.summary);
      if (result.status === "completed") {
        setTopic("");
      }
    } catch (error) {
      console.error(error);
      setResearchNote("Something went wrong. Is the backend running?");
    } finally {
      setResearching(false);
    }
  };

  const onToggleSave = async (id: string) => {
    try {
      const res = await toggleSaveNews(id);
      setNews((prev) =>
        prev.map((n) => (n.id === id ? { ...n, saved: res.saved } : n))
      );
    } catch (error) {
      console.error(error);
    }
  };

  const onDelete = async (id: string) => {
    try {
      await deleteNews(id);
      setNews((prev) => prev.filter((n) => n.id !== id));
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={region} onValueChange={(value) => setRegion(value as RegionFilter)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="morocco">Morocco</TabsTrigger>
            <TabsTrigger value="mena">MENA</TabsTrigger>
            <TabsTrigger value="web3">Web3</TabsTrigger>
            <TabsTrigger value="gaming">Drama</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setResearchOpen(true)}>
            <Sparkles />
            Research a topic
          </Button>
          <Button size="sm" onClick={refresh} disabled={refreshing}>
            <RefreshCw className={cn(refreshing && "animate-spin")} />
            {refreshing ? "Checking…" : "Check for news"}
          </Button>
        </div>
      </div>

      {note && (
        <p className="rounded-md border border-border/60 bg-secondary/30 px-3 py-2 text-xs text-muted-foreground">
          {note}
        </p>
      )}

      <Card className="overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-10 text-center text-sm text-muted-foreground">
            <Newspaper className="size-5" />
            No stories yet. Press Check for news to pull the latest.
          </div>
        ) : (
          <ul className="divide-y divide-border/60">
            {filtered.map((item) => (
              <li key={item.id} className="flex items-center gap-3 px-4 py-3">
                <Badge variant="outline" className="shrink-0">
                  {REGION_LABEL[item.region]}
                </Badge>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {item.source} · {item.publishedAgo}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => onToggleSave(item.id)}
                    aria-label={item.saved ? "Unsave" : "Save"}
                    className={cn(
                      "grid size-7 place-items-center rounded-md transition-colors hover:bg-accent",
                      item.saved ? "text-primary" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Bookmark className={cn("size-3.5", item.saved && "fill-current")} />
                  </button>
                  {item.url && (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      aria-label="Open story"
                      className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      <ExternalLink className="size-3.5" />
                    </a>
                  )}
                  <button
                    onClick={() => onDelete(item.id)}
                    aria-label="Delete"
                    className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <p className="text-[11px] text-muted-foreground">
        Market Intelligence reads Morocco, MENA and web3 sources for free.
        Check for news works on RSS alone. Research needs SearXNG running:
        docker compose --profile agents up -d.
      </p>

      <Sheet open={researchOpen} onOpenChange={setResearchOpen}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary" />
              Research a topic
            </SheetTitle>
            <SheetDescription>
              The Research Analyst searches the web in a few rounds, then
              saves a short cited report straight into your knowledge base.
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-1.5">
            <Label htmlFor="research-topic">Question</Label>
            <Input
              id="research-topic"
              placeholder="e.g. Who are the biggest esports sponsors in MENA right now?"
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
            />
          </div>
          {researchNote && (
            <p className="rounded-md border border-border/60 bg-secondary/30 px-3 py-2 text-xs text-muted-foreground">
              {researchNote}
            </p>
          )}
          <SheetFooter>
            <Button onClick={research} disabled={researching || !topic.trim()}>
              <Sparkles />
              {researching ? "Researching…" : "Start research"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
