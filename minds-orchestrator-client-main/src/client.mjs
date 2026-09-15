// A small, dependency-free client for the Animoca Minds Builder API.
//
// The Builder API is messaging-only: you create a conversation against a Mind,
// post a message into it, and poll the history for the Mind's reply. There is no
// endpoint for creating Tools or Skills, so everything below is built on those
// three calls.
//
//   Base:  https://api.build.hellominds.ai
//   POST   /v1/messaging/conversation      { alias, mindId }
//   POST   /v1/messaging/message           { alias, messageText }
//   GET    /v1/messaging/history/:alias?limit=
//
// Every quirk handled in this file was found by running against the live API.
// The README explains each one and why the workaround is shaped the way it is.

export const DEFAULT_BASE = "https://api.build.hellominds.ai";

/** Raised for any Builder API failure. `status` carries the HTTP code when there was one. */
export class MindsError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "MindsError";
    this.status = status;
  }
}

export class MindsClient {
  /**
   * @param {object} opts
   * @param {string} opts.apiKey      Builder API key.
   * @param {string} [opts.base]      API base URL.
   * @param {typeof fetch} [opts.fetchImpl]  Injected for offline tests.
   * @param {() => number} [opts.now] Injected clock, for deterministic tests.
   * @param {number} [opts.pollMs]    Gap between history polls while waiting.
   * @param {number} [opts.timeoutMs] Default reply window. See the latency note below.
   * @param {(event: object) => void} [opts.onEvent]  Progress hook.
   */
  constructor(opts = {}) {
    if (!opts.apiKey) throw new MindsError("apiKey is required");
    this.apiKey = opts.apiKey;
    this.base = opts.base ?? DEFAULT_BASE;
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.now = opts.now ?? (() => Date.now());
    this.pollMs = opts.pollMs ?? 2500;
    // Minds reply latency is wide and unpredictable: roughly 30 seconds to 13
    // minutes, with tool-backed Minds at the slow end. 13 minutes is the
    // observed ceiling, so the default window sits just past it.
    this.timeoutMs = opts.timeoutMs ?? 780_000;
    this.onEvent = opts.onEvent ?? (() => {});
    this.ensured = new Set();
  }

  /**
   * Send a self-contained instruction to a Mind and resolve with its reply text.
   *
   * `attempts` defaults to 1 on purpose. A retry posts a second message, which
   * the Mind answers, which spends Cognitions twice for one result. Prefer a
   * longer `timeoutMs` over a retry.
   *
   * @param {object} p
   * @param {string} p.mindId
   * @param {string} p.alias        Conversation alias. One per logical thread.
   * @param {string} p.text         The instruction to send.
   * @param {number} [p.timeoutMs]
   * @param {number} [p.attempts]
   * @returns {Promise<string>}
   */
  async ask({ mindId, alias, text, timeoutMs = this.timeoutMs, attempts = 1 }) {
    if (!mindId) throw new MindsError("mindId is required");
    if (!alias) throw new MindsError("alias is required");
    await this.ensureConversation({ alias, mindId });

    for (let attempt = 1; attempt <= attempts; attempt++) {
      // Snapshot what is already in the thread BEFORE sending, so we can tell a
      // genuinely new reply from an older message still sitting in the window.
      const seen = new Set((await this.history(alias)).map((r) => r.fingerprint).filter(Boolean));
      this.onEvent({ type: "send", alias, mindId, attempt });
      await this.send({ alias, text });
      const reply = await this.waitForReply({ alias, seen, timeoutMs });
      if (reply !== null) return reply;
      this.onEvent({ type: "timeout", alias, mindId, attempt, timeoutMs });
    }
    throw new MindsError(`no reply on "${alias}" after ${attempts} attempt(s) of ${timeoutMs}ms`);
  }

  /**
   * Create the conversation if it does not exist yet.
   *
   * The create call is not idempotent server-side: a second call on the same
   * alias returns 400 "alias already exists". That existing thread is exactly
   * what we want, so this one case counts as success. Skipping this tolerance is
   * the single most common cause of a Minds integration breaking on restart,
   * because the in-process cache of known aliases resets while the server-side
   * conversation does not.
   */
  async ensureConversation({ alias, mindId }) {
    if (this.ensured.has(alias)) return;
    try {
      await this.request("POST", "/v1/messaging/conversation", { alias, mindId });
      this.onEvent({ type: "conversation-created", alias, mindId });
    } catch (e) {
      const recoverable = e instanceof MindsError && e.status === 400 && /already exists/i.test(e.message);
      if (!recoverable) throw e;
      this.onEvent({ type: "conversation-reused", alias, mindId });
    }
    this.ensured.add(alias);
  }

  /** Post a message into a conversation. Does not wait for the reply. */
  async send({ alias, text }) {
    await this.request("POST", "/v1/messaging/message", { alias, messageText: text });
  }

  /** Fetch recent messages for an alias. Always returns an array. */
  async history(alias, limit = 50) {
    const body = await this.request("GET", `/v1/messaging/history/${encodeURIComponent(alias)}?limit=${limit}`);
    return asRows(body);
  }

  /**
   * Poll history until a Mind message appears that was not in `seen`.
   * Resolves to the reply text, or null if the window elapsed.
   *
   * This diffs message fingerprints rather than using the `after` cursor. The
   * cursor exists on the endpoint but does not filter the way the published
   * types suggest, so relying on it returns stale replies.
   */
  async waitForReply({ alias, seen = new Set(), timeoutMs = this.timeoutMs }) {
    const deadline = this.now() + timeoutMs;
    while (this.now() < deadline) {
      await sleep(this.pollMs);
      for (const row of await this.history(alias)) {
        // partyType 0 is the Mind. Anything else is the caller's own message.
        if (row.partyType !== 0) continue;
        if (typeof row.messageText !== "string" || !row.messageText.trim()) continue;
        if (seen.has(row.fingerprint)) continue;
        this.onEvent({ type: "reply", alias, chars: row.messageText.length });
        return stripHtml(row.messageText);
      }
    }
    return null;
  }

  /** List the Minds this key can reach. */
  async listMinds() {
    return asRows(await this.request("GET", "/v1/minds"));
  }

  async request(method, path, json) {
    let res;
    try {
      res = await this.fetchImpl(this.base + path, {
        method,
        headers: {
          "content-type": "application/json",
          // Both headers are required. The Builder API authenticates on the
          // legacy X-Access-Key; sending only X-Builder-Api-Key returns 401.
          "X-Builder-Api-Key": this.apiKey,
          "X-Access-Key": this.apiKey,
        },
        ...(json !== undefined ? { body: JSON.stringify(json) } : {}),
      });
    } catch (e) {
      throw new MindsError(`builder api unreachable: ${e.message}`);
    }
    const text = await res.text();
    // A conversation that exists but holds no messages 404s on history. That is
    // an empty thread, not a failure.
    if (res.status === 404) return null;
    if (!res.ok) throw new MindsError(`builder api ${res.status}: ${text.slice(0, 200)}`, res.status);
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }
}

/** History comes back as a bare array or wrapped in an envelope. Accept both. */
export function asRows(body) {
  if (Array.isArray(body)) return body;
  if (body && typeof body === "object") {
    for (const key of ["items", "messages", "history", "data", "minds"]) {
      if (Array.isArray(body[key])) return body[key];
    }
  }
  return [];
}

/** Replies are often wrapped in HTML. Strip tags before parsing or printing. */
export function stripHtml(text) {
  return String(text).replace(/<[^>]+>/g, "").trim();
}

/**
 * Pull the first JSON array out of a reply, tolerating prose and code fences
 * around it. Returns null when there is nothing parseable, so a chatty reply
 * degrades to "no structured result" instead of throwing.
 */
export function extractJsonArray(text) {
  const clean = stripHtml(text).replace(/```[a-z]*/gi, "");
  const start = clean.indexOf("[");
  const end = clean.lastIndexOf("]");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(clean.slice(start, end + 1));
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Same idea for a single JSON object. */
export function extractJsonObject(text) {
  const clean = stripHtml(text).replace(/```[a-z]*/gi, "");
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(clean.slice(start, end + 1));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
