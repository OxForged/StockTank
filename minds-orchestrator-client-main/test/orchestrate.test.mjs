import { test } from "node:test";
import assert from "node:assert/strict";
import { MindsClient, MindsError, runChain, askMany, extractJsonArray } from "../src/index.mjs";

/** A client whose replies are scripted per alias, so chains run offline. */
function scriptedClient(replies, { failOn = [] } = {}) {
  const asked = [];
  const impl = async (url, init = {}) => {
    if (url.endsWith("/v1/messaging/conversation")) return new Response("{}", { status: 200 });
    if (url.includes("/v1/messaging/message")) {
      const { alias, messageText } = JSON.parse(init.body);
      asked.push({ alias, messageText });
      return new Response("{}", { status: 200 });
    }
    if (url.includes("/v1/messaging/history/")) {
      const alias = decodeURIComponent(url.split("/history/")[1].split("?")[0]);
      if (failOn.includes(alias)) return new Response("boom", { status: 500 });
      const was = asked.some((a) => a.alias === alias);
      const text = replies[alias];
      return new Response(JSON.stringify(was && text ? [{ fingerprint: alias, partyType: 0, messageText: text }] : []), {
        status: 200,
      });
    }
    return new Response("null", { status: 200 });
  };
  const client = new MindsClient({ apiKey: "k", fetchImpl: impl, pollMs: 1, timeoutMs: 200 });
  return { client, asked };
}

const stage = (name, prompt, extra = {}) => ({ name, mindId: `mind-${name}`, prompt, ...extra });

test("pipes each reply into the next stage's prompt", async () => {
  const { client, asked } = scriptedClient({
    "chain-a": "brief from A",
    "chain-b": "answer from B",
  });

  const { results, last, order } = await runChain({
    client,
    input: { topic: "kites" },
    stages: [
      stage("a", ({ input }) => `research ${input.topic}`),
      stage("b", ({ results, previous }) => {
        assert.equal(previous.name, "a");
        return `use this: ${results.a.text}`;
      }),
    ],
  });

  assert.deepEqual(order, ["a", "b"]);
  assert.equal(results.a.text, "brief from A");
  assert.equal(last.text, "answer from B");
  assert.equal(asked[0].messageText, "research kites");
  assert.equal(asked[1].messageText, "use this: brief from A");
});

test("parse turns a reply into a structured value", async () => {
  const { client } = scriptedClient({ "chain-draft": '<p>[{"q":"will it rain"}]</p>' });
  const { results } = await runChain({
    client,
    stages: [stage("draft", () => "draft it", { parse: extractJsonArray })],
  });
  assert.deepEqual(results.draft.value, [{ q: "will it rain" }]);
});

test("resume skips a stage and feeds its saved text forward", async () => {
  const { client, asked } = scriptedClient({ "chain-fast": "second stage ran" });
  const { results } = await runChain({
    client,
    resume: { slow: "brief recovered from disk" },
    stages: [
      stage("slow", () => "this should never be sent"),
      stage("fast", ({ results }) => `given: ${results.slow.text}`),
    ],
  });

  assert.equal(results.slow.resumed, true);
  assert.equal(results.slow.text, "brief recovered from disk");
  assert.equal(asked.length, 1, "only the un-resumed stage should call a Mind");
  assert.equal(asked[0].messageText, "given: brief recovered from disk");
});

test("a failing stage stops the chain by default", async () => {
  const { client } = scriptedClient({ "chain-b": "never reached" }, { failOn: ["chain-a"] });
  await assert.rejects(
    () => runChain({ client, stages: [stage("a", () => "go"), stage("b", () => "go")] }),
    /builder api 500/,
  );
});

test("an optional stage records its error and lets the chain continue", async () => {
  const { client } = scriptedClient({ "chain-b": "b still ran" }, { failOn: ["chain-a"] });
  const { results } = await runChain({
    client,
    stages: [stage("a", () => "go", { optional: true }), stage("b", () => "go")],
  });
  assert.ok(results.a.error instanceof MindsError);
  assert.equal(results.b.text, "b still ran");
});

test("rejects a malformed stage before spending anything", async () => {
  const { client, asked } = scriptedClient({});
  await assert.rejects(() => runChain({ client, stages: [{ name: "x", mindId: "m" }] }), /needs a prompt function/);
  await assert.rejects(() => runChain({ client, stages: [{ name: "x", prompt: () => "" }] }), /needs a mindId/);
  await assert.rejects(() => runChain({ client, stages: [] }), /at least one stage/);
  assert.equal(asked.length, 0);
});

test("askMany collects every answer and keeps one failure from sinking the batch", async () => {
  const { client } = scriptedClient(
    { "fanout-one": "answer one", "fanout-three": "answer three" },
    { failOn: ["fanout-two"] },
  );
  const out = await askMany({
    client,
    minds: [
      { name: "one", mindId: "m1" },
      { name: "two", mindId: "m2" },
      { name: "three", mindId: "m3" },
    ],
    text: "same question to all three",
  });

  assert.equal(out.length, 3);
  assert.equal(out.find((o) => o.name === "one").text, "answer one");
  assert.equal(out.find((o) => o.name === "three").text, "answer three");
  const failed = out.find((o) => o.name === "two");
  assert.equal(failed.text, null);
  assert.ok(failed.error instanceof MindsError);
});
