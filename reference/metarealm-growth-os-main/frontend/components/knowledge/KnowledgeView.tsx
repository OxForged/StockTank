"use client";

import { useState } from "react";
import {
  askKnowledge,
  deleteKnowledgeDocument,
  listKnowledgeDocuments,
  syncKnowledge,
  uploadKnowledgeDocument,
} from "@/lib/api/client";
import type { AskResult, KnowledgeDocument } from "@/types";
import { AskPanel } from "./AskPanel";
import { DocumentList } from "./DocumentList";

export function KnowledgeView({
  initialDocuments,
}: {
  initialDocuments: KnowledgeDocument[];
}) {
  const [documents, setDocuments] = useState(initialDocuments);
  const [asking, setAsking] = useState(false);
  const [result, setResult] = useState<AskResult | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const refresh = async () => {
    try {
      setDocuments(await listKnowledgeDocuments());
    } catch (error) {
      console.error(error);
    }
  };

  const handleAsk = async (question: string) => {
    setAsking(true);
    try {
      setResult(await askKnowledge(question));
    } catch (error) {
      console.error(error);
      setResult({ answer: null, usedLlm: false, passages: [] });
    } finally {
      setAsking(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const sync = await syncKnowledge();
      const indexed =
        sync.ingested.length + sync.reindexed.length + sync.embeddedBackfilled.length;
      setNote(
        `${indexed} file(s) indexed, ${sync.skipped} already up to date. ` +
          (sync.embeddingsAvailable
            ? "Semantic search active via Ollama."
            : "Ollama not reachable — keyword mode. Sync again once Ollama is running to add embeddings.")
      );
      await refresh();
    } catch (error) {
      console.error(error);
      setNote("Sync failed — is the backend running?");
    } finally {
      setSyncing(false);
    }
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      await uploadKnowledgeDocument(file);
      setNote(`Indexed ${file.name}.`);
      await refresh();
    } catch (error) {
      console.error(error);
      const message =
        error instanceof Error
          ? error.message
          : "Upload failed. Is the backend running?";
      setNote(message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteKnowledgeDocument(id);
      await refresh();
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
      <AskPanel onAsk={handleAsk} asking={asking} result={result} />
      <DocumentList
        documents={documents}
        onUpload={handleUpload}
        onSync={handleSync}
        onDelete={handleDelete}
        syncing={syncing}
        uploading={uploading}
        note={note}
      />
      <p className="text-[11px] text-muted-foreground">
        This corpus feeds every AI employee from Milestone 6 onward — the
        Executive Assistant, Content Strategist, and Proposal Builder all cite
        from here.
      </p>
    </div>
  );
}
