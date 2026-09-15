import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MindsClient,
  MindsError,
  asRows,
  stripHtml,
  extractJsonArray,
  extractJsonObject,
} from "../src/index.mjs";

/**
 * Build a fake Builder API.
 *
 * `history` is called with { sent }, the number of messages posted so far, so a
 * fixture can model a thread that only gains the Mind's reply after the send.
 * Returning null from it produces a 404.
 */
function fakeApi({ conversation, history = () => [], message } = {}) {
  const calls = [];
  let sent = 0;
  const impl = async (url, init = {}) => {
    const method = init.method ?? "GET";
    calls.push({ url, method, headers: init.headers ?? {}, body: init.body });
    if (url.endsWith("/v1/messaging/conversation")) {
      return conversation ? conversation() : new Response(JSON.stringify({ ok: true }), { status: 200 });
    }
    if (url.includes("/v1/messaging/message")) {
      sent++;
      return message ? message() : new Response(JSON.stringify({ messageId: "m1" }), { status: 200 });
    }
    if (url.includes("/v1/messaging/history/")) {
      const rows = history({ sent });
      return rows === null ? new Response("not found", { status: 404 }) : new Response(JSON.stringify(rows), { status: 200 });
    }
    return new Response("null", { status: 200 });
  };
  return { impl, calls };
}

/**
 * The common case: the thread is empty until the send, then holds one reply.
 * The fingerprint varies per send so repeated asks on one alias each see a new
 * message rather than the previous answer.
 */
const replyAfterSend = (text) =>
  ({ sent }) => (sent ? [{ fingerprint: `reply-${sent}`, partyType: 0, messageText: text }] : []);

const client = (fetchImpl, extra = {}) =>
  new MindsClient({ apiKey: "test-key", fetchImpl, pollMs: 1, timeoutMs: 200, ...extra });

test("sends both auth headers, because the new one alone is rejected upstream", async () => {
  const api = fakeApi({ history: replyAfterSend("hi") });
  await client(api.impl).ask({ mindId: "m", alias: "a", text: "yo" });
  const headers = api.calls[0].headers;
  assert.equal(headers["X-Builder-Api-Key"], "test-key");
  assert.equal(headers["X-Access-Key"], "test-key");
});

test("tolerates the 400 'alias already exists' returned when a conversation is reused", async () => {
  const api = fakeApi({
    conversation: () => new Response(JSON.stringify({ error: { message: "alias already exists" } }), { status: 400 }),
    history: replyAfterSend("the answer"),
  });
  const reply = await client(api.impl).ask({ mindId: "m", alias: "a", text: "yo" });
  assert.equal(reply, "the answer");
});

test("still throws when conversation create fails for a real reason", async () => {
  const api = fakeApi({
    conversation: () => new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 }),
  });
  await assert.rejects(() => client(api.impl).ask({ mindId: "m", alias: "a", text: "yo" }), (e) => {
    assert.ok(e instanceof MindsError);
    assert.equal(e.status, 401);
    return true;
  });
});

test("treats a 404 on history as an empty thread rather than a failure", async () => {
  const api = fakeApi({ history: () => null });
  assert.deepEqual(await client(api.impl).history("fresh-alias"), []);
});

test("returns only a reply that arrived after the send, never a stale one", async () => {
  // The thread already holds an older Mind message. Diffing fingerprints is what
  // keeps that older message from being mistaken for the answer to this send.
  const older = { fingerprint: "old", partyType: 0, messageText: "an earlier answer" };
  const api = fakeApi({
    history: ({ sent }) =>
      sent ? [older, { fingerprint: "new", partyType: 0, messageText: "the fresh answer" }] : [older],
  });
  const reply = await client(api.impl).ask({ mindId: "m", alias: "a", text: "yo" });
  assert.equal(reply, "the fresh answer");
});

test("ignores the caller's own messages while waiting", async () => {
  const api = fakeApi({
    history: ({ sent }) =>
      sent
        ? [
            { fingerprint: "mine", partyType: 1, messageText: "my own question" },
            { fingerprint: "theirs", partyType: 0, messageText: "their reply" },
          ]
        : [],
  });
  assert.equal(await client(api.impl).ask({ mindId: "m", alias: "a", text: "yo" }), "their reply");
});

test("throws a clear error when the reply window elapses", async () => {
  const api = fakeApi({ history: () => [] });
  await assert.rejects(
    () => client(api.impl).ask({ mindId: "m", alias: "a", text: "yo" }),
    /no reply on "a" after 1 attempt/,
  );
});

test("defaults to a single attempt so a slow Mind is not paid for twice", async () => {
  let sends = 0;
  const api = fakeApi({
    message: () => {
      sends++;
      return new Response("{}", { status: 200 });
    },
    history: () => [],
  });
  await assert.rejects(() => client(api.impl).ask({ mindId: "m", alias: "a", text: "yo" }));
  assert.equal(sends, 1);
});

test("creates each conversation once per client", async () => {
  const api = fakeApi({ history: replyAfterSend("ok") });
  const c = client(api.impl);
  await c.ask({ mindId: "m", alias: "same", text: "one" });
  await c.ask({ mindId: "m", alias: "same", text: "two" });
  assert.equal(api.calls.filter((x) => x.url.endsWith("/v1/messaging/conversation")).length, 1);
});

test("requires an api key", () => {
  assert.throws(() => new MindsClient({}), /apiKey is required/);
});

test("asRows accepts a bare array and every envelope shape seen in the wild", () => {
  assert.deepEqual(asRows([1, 2]), [1, 2]);
  assert.deepEqual(asRows({ items: [1] }), [1]);
  assert.deepEqual(asRows({ messages: [2] }), [2]);
  assert.deepEqual(asRows({ history: [3] }), [3]);
  assert.deepEqual(asRows({ data: [4] }), [4]);
  assert.deepEqual(asRows(null), []);
});

test("stripHtml removes the markup replies are wrapped in", () => {
  assert.equal(stripHtml("<p>hello <b>there</b></p>"), "hello there");
});

test("extractJsonArray digs the array out of prose, tags and code fences", () => {
  assert.deepEqual(extractJsonArray('<p>Sure! ```json [{"a":1}] ``` hope that helps</p>'), [{ a: 1 }]);
  assert.equal(extractJsonArray("still thinking about it"), null);
  assert.equal(extractJsonArray("[not valid json}"), null);
  assert.equal(extractJsonArray('{"a":1}'), null);
});

test("extractJsonObject does the same for a single object", () => {
  assert.deepEqual(extractJsonObject('Here you go: {"ok":true}'), { ok: true });
  assert.equal(extractJsonObject("[1,2]"), null);
});
