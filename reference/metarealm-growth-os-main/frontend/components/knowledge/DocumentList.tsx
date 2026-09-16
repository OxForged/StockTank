"use client";

import { Library, RefreshCw, Trash2, Upload } from "lucide-react";
import { WidgetCard } from "@/components/shared/WidgetCard";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { KnowledgeDocument } from "@/types";

export function DocumentList({
  documents,
  onUpload,
  onSync,
  onDelete,
  syncing,
  uploading,
  note,
}: {
  documents: KnowledgeDocument[];
  onUpload: (file: File) => void;
  onSync: () => void;
  onDelete: (id: string) => void;
  syncing: boolean;
  uploading: boolean;
  note: string | null;
}) {
  return (
    <WidgetCard title="Library" icon={Library}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={onSync} disabled={syncing}>
          <RefreshCw className={cn(syncing && "animate-spin")} />
          {syncing ? "Syncing…" : "Sync folder"}
        </Button>
        <Button size="sm" variant="outline" asChild disabled={uploading}>
          <label htmlFor="kb-upload" className="cursor-pointer">
            <Upload />
            {uploading ? "Uploading…" : "Upload file"}
          </label>
        </Button>
        <input
          id="kb-upload"
          type="file"
          accept=".pdf,.md,.txt"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onUpload(file);
            event.target.value = "";
          }}
        />
        <span className="text-[11px] text-muted-foreground">
          Sync indexes everything in the knowledge/ folder.
        </span>
      </div>

      {note && (
        <p className="mb-3 rounded-md border border-border/60 bg-secondary/30 px-3 py-2 text-[11px] text-muted-foreground">
          {note}
        </p>
      )}

      {documents.length === 0 ? (
        <div className="rounded-md border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
          No documents indexed yet — drop files into knowledge/ and press
          Sync, or upload one here.
        </div>
      ) : (
        <ul className="divide-y divide-border/60">
          {documents.map((document) => (
            <li
              key={document.id}
              className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
            >
              <span className="grid h-7 w-10 shrink-0 place-items-center rounded-md bg-secondary text-[10px] font-bold uppercase">
                {document.kind}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {document.title}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {document.filename}
                </p>
              </div>
              <span className="hidden shrink-0 font-mono text-xs tabular-nums text-muted-foreground sm:block">
                {document.chunkCount} chunks
              </span>
              <span
                className={cn(
                  "flex shrink-0 items-center gap-1.5 text-[11px]",
                  document.embedded ? "text-success" : "text-muted-foreground"
                )}
              >
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    document.embedded ? "bg-success" : "bg-muted-foreground/40"
                  )}
                />
                {document.embedded ? "semantic" : "keyword"}
              </span>
              <button
                onClick={() => onDelete(document.id)}
                aria-label={`Delete ${document.title}`}
                className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </WidgetCard>
  );
}
