// The worked example carries the validation pattern the README argues for, so
// it gets tested like real code.

import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPrompt, parseSuggestions } from "../examples/forkcast-oracle.mjs";

test("buildPrompt includes only the context fields that were supplied", () => {
  const full = buildPrompt({ streamer: "xqc", game: "Chess", title: "blitz night", viewerCount: 42000 });
  assert.match(full, /streamer: xqc/);
  assert.match(full, /game: Chess/);
  assert.match(full, /viewers: 42000/);

  const sparse = buildPrompt({ streamer: "xqc" });
  assert.doesNotMatch(sparse, /game:/);
  assert.doesNotMatch(sparse, /viewers:/);
});

test("parseSuggestions reads pools out of an HTML-wrapped reply", () => {
  const raw = `<p>[{"prompt":"Will they win?","outcomes":["Yes","No"],"believedOutcome":"No","durationMs":300000}]</p>`;
  assert.deepEqual(parseSuggestions(raw), [
    { prompt: "Will they win?", outcomes: ["Yes", "No"], believedOutcome: "No", durationMs: 300000 },
  ]);
});

test("parseSuggestions repairs what it can: duplicate outcomes, bad pick, bad timer", () => {
  const [pool] = parseSuggestions('[{"prompt":"p","outcomes":["A","A","B"],"believedOutcome":"Z","durationMs":999}]');
  assert.deepEqual(pool.outcomes, ["A", "B"]);
  assert.equal(pool.believedOutcome, "A", "a pick outside the outcomes falls back to the first");
  assert.equal(pool.durationMs, 300000, "an unsupported timer falls back to the default");
});

test("parseSuggestions drops what it cannot repair instead of passing it through", () => {
  const raw =
    '[{"prompt":"ok","outcomes":["A","B"],"believedOutcome":"A","durationMs":1800000},' +
    '{"prompt":"","outcomes":["A","B"]},{"outcomes":["only-one"]},"nonsense"]';
  assert.equal(parseSuggestions(raw).length, 1);
});

test("parseSuggestions returns nothing when the Mind answered with prose", () => {
  assert.deepEqual(parseSuggestions("Great question! Let me think about that."), []);
});

test("parseSuggestions caps how many pools reach the caller", () => {
  const many = JSON.stringify(
    Array.from({ length: 9 }, (_, i) => ({
      prompt: `p${i}`,
      outcomes: ["A", "B"],
      believedOutcome: "A",
      durationMs: 300000,
    })),
  );
  assert.equal(parseSuggestions(many).length, 4);
});
