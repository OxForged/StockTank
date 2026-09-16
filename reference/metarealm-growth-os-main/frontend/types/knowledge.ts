/** Knowledge base domain — mirrors backend/app/schemas/knowledge.py. */

export interface KnowledgeDocument {
  id: string;
  title: string;
  filename: string;
  kind: string;
  chunkCount: number;
  embedded: boolean;
}

export interface KnowledgePassage {
  documentTitle: string;
  page?: number | null;
  text: string;
  score: number;
}

export interface AskResult {
  answer: string | null;
  usedLlm: boolean;
  passages: KnowledgePassage[];
}

export interface KnowledgeSyncResult {
  ingested: string[];
  reindexed: string[];
  embeddedBackfilled: string[];
  skipped: number;
  embeddingsAvailable: boolean;
}
