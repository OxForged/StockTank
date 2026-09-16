export declare const DEFAULT_BASE: string;

export declare class MindsError extends Error {
  readonly status?: number;
  constructor(message: string, status?: number);
}

export interface MindsClientOptions {
  apiKey: string;
  base?: string;
  fetchImpl?: typeof fetch;
  now?: () => number;
  pollMs?: number;
  timeoutMs?: number;
  onEvent?: (event: Record<string, unknown>) => void;
}

export interface HistoryRow {
  fingerprint?: string;
  partyType?: number | null;
  messageText?: string | null;
  [key: string]: unknown;
}

export declare class MindsClient {
  constructor(opts: MindsClientOptions);
  readonly base: string;
  readonly timeoutMs: number;
  now(): number;
  ask(p: {
    mindId: string;
    alias: string;
    text: string;
    timeoutMs?: number;
    attempts?: number;
  }): Promise<string>;
  ensureConversation(p: { alias: string; mindId: string }): Promise<void>;
  send(p: { alias: string; text: string }): Promise<void>;
  history(alias: string, limit?: number): Promise<HistoryRow[]>;
  waitForReply(p: {
    alias: string;
    seen?: Set<string | undefined>;
    timeoutMs?: number;
  }): Promise<string | null>;
  listMinds(): Promise<Array<Record<string, unknown>>>;
  request(method: string, path: string, json?: unknown): Promise<unknown>;
}

export declare function asRows(body: unknown): HistoryRow[];
export declare function stripHtml(text: string): string;
export declare function extractJsonArray(text: string): unknown[] | null;
export declare function extractJsonObject(text: string): Record<string, unknown> | null;

export interface StageResult {
  name: string;
  text: string;
  value: unknown;
  resumed: boolean;
  ms: number;
  error?: Error;
}

export interface StageContext {
  input: Record<string, unknown>;
  results: Record<string, StageResult>;
  previous: StageResult | null;
}

export interface Stage {
  name: string;
  mindId: string;
  alias?: string;
  prompt: (ctx: StageContext) => string;
  parse?: (text: string) => unknown;
  timeoutMs?: number;
  optional?: boolean;
}

export interface ChainResult {
  results: Record<string, StageResult>;
  last: StageResult | null;
  order: string[];
}

export declare function runChain(p: {
  client: MindsClient;
  stages: Stage[];
  input?: Record<string, unknown>;
  resume?: Record<string, string>;
  onStage?: (event: Record<string, unknown>) => void;
}): Promise<ChainResult>;

export declare function askMany(p: {
  client: MindsClient;
  minds: Array<{ name: string; mindId: string; alias?: string }>;
  text: string;
  timeoutMs?: number;
}): Promise<Array<{ name: string; text: string | null; error?: Error }>>;
