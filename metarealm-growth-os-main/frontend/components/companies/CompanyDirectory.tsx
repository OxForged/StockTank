"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, RefreshCw, Search, Sparkles, Trash2 } from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { deleteCompany, runAgent } from "@/lib/api/client";
import { formatMad, initials } from "@/lib/format";
import { isOpenStage } from "@/lib/stages";
import type { Company, CompanyStatus, Opportunity } from "@/types";

type StatusFilter = "all" | CompanyStatus;

const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "prospect", label: "Prospects" },
  { value: "in_talks", label: "In talks" },
  { value: "active_partner", label: "Partners" },
  { value: "past_partner", label: "Past" },
];

export function CompanyDirectory({
  companies,
  opportunities,
}: {
  companies: Company[];
  opportunities: Opportunity[];
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [hunting, setHunting] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const hunt = async () => {
    setHunting(true);
    setNote(null);
    try {
      const result = await runAgent("opportunity-hunter");
      setNote(result.summary);
      // Only reload if companies were actually added.
      const added = (result.details as { added?: number } | undefined)?.added ?? 0;
      if (result.status === "completed" && added > 0) {
        setTimeout(() => window.location.reload(), 1200);
      }
    } catch (error) {
      console.error(error);
      setNote("Something went wrong. Is the backend running?");
    } finally {
      setHunting(false);
    }
  };

  const [companyList, setCompanyList] = useState(companies);

  const onDelete = async (id: string, name: string) => {
    if (!confirm(`Delete ${name}? This removes their deals, contacts, and drafts too.`)) return;
    try {
      await deleteCompany(id);
      setCompanyList((prev) => prev.filter((c) => c.id !== id));
    } catch (error) {
      console.error(error);
    }
  };

  const openByCompany = useMemo(() => {
    const map = new Map<string, { count: number; valueMad: number }>();
    for (const opp of opportunities) {
      if (!isOpenStage(opp.stage)) continue;
      const entry = map.get(opp.companyId) ?? { count: 0, valueMad: 0 };
      entry.count += 1;
      entry.valueMad += opp.valueMad;
      map.set(opp.companyId, entry);
    }
    return map;
  }, [opportunities]);

  const filtered = companyList.filter((company) => {
    if (status !== "all" && company.status !== status) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      company.name.toLowerCase().includes(q) ||
      company.industry.toLowerCase().includes(q)
    );
  });

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search name or industry…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="h-8 pl-8 text-xs"
          />
        </div>
        <div className="flex items-center gap-2">
          <Tabs
            value={status}
            onValueChange={(value) => setStatus(value as StatusFilter)}
          >
            <TabsList>
              {FILTERS.map((filter) => (
                <TabsTrigger key={filter.value} value={filter.value}>
                  {filter.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <Button size="sm" variant="outline" onClick={hunt} disabled={hunting}>
            {hunting ? (
              <RefreshCw className="animate-spin" />
            ) : (
              <Sparkles />
            )}
            {hunting ? "Hunting…" : "Find new prospects"}
          </Button>
        </div>
      </div>

      {note && (
        <p className="rounded-md border border-border/60 bg-secondary/30 px-3 py-2 text-xs text-muted-foreground">
          {note}
        </p>
      )}

      <Card className="overflow-hidden">
        <ul className="divide-y divide-border/60">
          {filtered.map((company) => {
            const open = openByCompany.get(company.id);
            return (
              <li key={company.id} className="group relative">
                <Link
                  href={`/companies/${company.id}`}
                  className="flex items-center gap-3 px-4 py-3 pr-12 transition-colors hover:bg-accent/40"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-md bg-secondary text-xs font-semibold">
                    {initials(company.name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {company.name}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {company.industry}
                    </span>
                  </span>
                  <StatusBadge status={company.status} />
                  <span className="hidden w-32 shrink-0 text-right font-mono text-xs tabular-nums text-muted-foreground md:block">
                    {open ? `${open.count} · ${formatMad(open.valueMad)}` : "—"}
                  </span>
                  <span className="hidden w-40 shrink-0 truncate text-right text-xs text-muted-foreground lg:block">
                    {company.lastTouch}
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground/50" />
                </Link>
                <button
                  onClick={() => onDelete(company.id, company.name)}
                  aria-label={`Delete ${company.name}`}
                  className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-muted-foreground opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
        {filtered.length === 0 && (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No companies match your filters.
          </div>
        )}
      </Card>

      <p className="text-xs text-muted-foreground">
        Showing {filtered.length} of {companies.length} companies
      </p>
    </div>
  );
}
