// The production pattern this library was extracted from.
//
//   node --env-file=.env examples/forkcast-oracle.mjs xqc
//
// FORKcast (https://forkcast.forked.gg) is a streamer prediction market where
// viewers stake points on short outcomes that resolve on the broadcast. A Mind
// drafts candidate questions from the live stream context and a human approves
// each one before it goes up, so the agent never touches the ledger.
//
// Two things here matter more than the prompt:
//
//   1. One conversation alias per streamer. Threads stay short enough that the
//      reply is always inside the polled history window, and each thread builds
//      up its own memory of that streamer over time.
//   2. Every field is validated on the way out. A model reply is untrusted
//      input. Anything malformed gets dropped or coerced, so a bad reply yields
//      fewer suggestions rather than junk reaching the UI.

import { MindsClient, extractJsonArray } from "../src/index.mjs";

const VALID_DURATIONS = [300_000, 1_800_000, 3_600_000];
const DEFAULT_DURATION = 300_000;
const MAX_SUGGESTIONS = 4;

export function buildPrompt(ctx) {
  const lines = [
    `streamer: ${ctx.streamer}`,
    ctx.game ? `game: ${ctx.game}` : "",
    ctx.title ? `stream title: ${ctx.title}` : "",
    ctx.viewerCount != null ? `viewers: ${ctx.viewerCount}` : "",
  ].filter(Boolean);

  return [
    "You are the FORKcast Oracle, the prediction-market brain for Forked.gg.",
    "FORKcast is a streamer prediction market: viewers stake points, never cash, on short concrete outcomes that happen live on a broadcast, and the winning side splits a pari-mutuel pool.",
    "",
    "Draft prediction pools for the live stream below. Rules for EVERY pool:",
    "1. The outcome must be something the STREAMER can confirm by watching their own stream, such as a win, a kill count, a rage quit or beating a boss. Never require external data the streamer cannot just see.",
    "2. Outcomes must be clear, mutually exclusive, and resolvable within the timer.",
    "3. Each pool needs prompt, outcomes as an array of two or more short strings, believedOutcome as your pick from those outcomes, and durationMs of exactly 300000, 1800000 or 3600000.",
    "4. Keep it fun and viewer facing.",
    "",
    "Live stream:",
    ...lines,
    "",
    "Respond with ONLY a JSON array of up to 3 pool objects with keys prompt, outcomes, believedOutcome, durationMs. No prose before or after the JSON.",
  ].join("\n");
}

/** Validate the model's reply into pools that are safe to render. */
export function parseSuggestions(raw) {
  const arr = extractJsonArray(raw);
  if (!arr) return [];
  const out = [];
  for (const item of arr) {
    if (!item || typeof item !== "object") continue;

    const prompt = typeof item.prompt === "string" ? item.prompt.trim() : "";
    if (!prompt) continue;

    const outcomes = [];
    if (Array.isArray(item.outcomes)) {
      for (const v of item.outcomes) {
        const s = typeof v === "string" ? v.trim() : "";
        if (s && !outcomes.includes(s)) outcomes.push(s);
      }
    }
    if (outcomes.length < 2) continue;

    let believedOutcome = typeof item.believedOutcome === "string" ? item.believedOutcome.trim() : "";
    if (!outcomes.includes(believedOutcome)) believedOutcome = outcomes[0];

    let durationMs = Number(item.durationMs);
    if (!VALID_DURATIONS.includes(durationMs)) durationMs = DEFAULT_DURATION;

    out.push({ prompt, outcomes, believedOutcome, durationMs });
    if (out.length >= MAX_SUGGESTIONS) break;
  }
  return out;
}

const aliasFor = (streamer) =>
  "oracle-" + (streamer.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "stream");

// Only run the live call when this file is executed directly, so the two
// functions above stay importable and unit testable.
if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}`) {
  const apiKey = process.env.MINDS_BUILDER_API_KEY;
  const mindId = process.env.MIND_ID;
  if (!apiKey || !mindId) {
    console.error("MINDS_BUILDER_API_KEY and MIND_ID must both be set.");
    process.exit(1);
  }

  const ctx = {
    streamer: process.argv[2] ?? "xqc",
    game: process.argv[3],
    title: process.argv[4],
  };

  const client = new MindsClient({ apiKey, timeoutMs: 180_000 });
  const reply = await client.ask({ mindId, alias: aliasFor(ctx.streamer), text: buildPrompt(ctx) });
  const pools = parseSuggestions(reply);

  if (pools.length === 0) {
    console.log("No valid pools came back. Raw reply:\n" + reply);
  } else {
    console.log(JSON.stringify(pools, null, 2));
  }
}
