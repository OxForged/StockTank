// Three Minds working one job in sequence.
//
//   node --env-file=.env examples/circle.mjs "Broxah" "League of Legends" "Teemo Only Climb"
//
// A researcher gathers current facts, a drafter turns them into structured
// output, a coordinator writes the human-facing summary. Each Mind gets a
// self-contained instruction, because a Mind's configured persona alone does not
// reliably force a response format.
//
// Reruns are expensive when a slow research Mind sits at the front, so the
// researcher's brief is cached to disk and reused when RESUME=1 is set.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { MindsClient, runChain, extractJsonArray } from "../src/index.mjs";

const apiKey = process.env.MINDS_BUILDER_API_KEY;
if (!apiKey) {
  console.error("MINDS_BUILDER_API_KEY is not set.");
  process.exit(1);
}

const MINDS = {
  scout: process.env.SCOUT_MIND_ID,
  oracle: process.env.ORACLE_MIND_ID,
  operator: process.env.OPERATOR_MIND_ID,
};
for (const [name, id] of Object.entries(MINDS)) {
  if (!id) {
    console.error(`${name.toUpperCase()}_MIND_ID is not set. See .env.example.`);
    process.exit(1);
  }
}

const input = {
  streamer: process.argv[2] ?? "Broxah",
  game: process.argv[3] ?? "League of Legends",
  title: process.argv[4] ?? "Teemo Only Climb",
};

const CACHE = "results/scout-brief.txt";
const resume = process.env.RESUME === "1" && existsSync(CACHE) ? { scout: readFileSync(CACHE, "utf8") } : {};

const client = new MindsClient({ apiKey });

const DRAFT_RULES = [
  "You draft short prediction questions viewers vote on during a live stream.",
  "Every question must resolve from what happens on the broadcast itself, with no external data lookup.",
  "Outcomes must be clear, mutually exclusive, and settled within the timer.",
  "Timers are one of 300000, 1800000 or 3600000 milliseconds.",
].join(" ");

console.log(`=== circle: ${input.streamer} | ${input.game} | "${input.title}" ===\n`);

const { results, order } = await runChain({
  client,
  input,
  resume,
  onStage: (e) => {
    if (e.type === "stage-start") console.log(`[${e.name}] working...`);
    if (e.type === "stage-done") console.log(`[${e.name}] ${e.resumed ? "reused cached output" : `replied in ${Math.round(e.ms / 1000)}s`}`);
    if (e.type === "stage-error") console.log(`[${e.name}] failed: ${e.error.message}`);
  },
  stages: [
    {
      name: "scout",
      mindId: MINDS.scout,
      // A research Mind with a web-search connection is the slowest link in any
      // chain. Give it room rather than retrying it.
      timeoutMs: 780_000,
      prompt: ({ input }) =>
        `Research this live stream and write a short factual brief a colleague can act on. ` +
        `Streamer: ${input.streamer}. Game: ${input.game}. Title: "${input.title}". ` +
        `Cover who they are, what is happening in this game right now, and any habits or running jokes worth knowing. Keep it under 200 words.`,
    },
    {
      name: "drafter",
      mindId: MINDS.oracle,
      prompt: ({ input, results }) =>
        `${DRAFT_RULES}\n\n` +
        `Stream: ${input.streamer} playing ${input.game}, titled "${input.title}".\n\n` +
        `Research brief:\n${results.scout.text}\n\n` +
        `Respond with ONLY a JSON array of 3 objects with keys prompt, outcomes, believedOutcome, durationMs. No prose.`,
      parse: extractJsonArray,
    },
    {
      name: "coordinator",
      mindId: MINDS.operator,
      prompt: ({ results }) =>
        `Here are three drafted prediction questions as JSON:\n${JSON.stringify(results.drafter.value ?? results.drafter.text)}\n\n` +
        `Write a clean numbered summary for a human to approve. For each one give the question, the outcomes, the suggested pick and the timer in minutes. No preamble.`,
    },
  ],
});

if (results.scout && !results.scout.resumed) {
  mkdirSync("results", { recursive: true });
  writeFileSync(CACHE, results.scout.text, "utf8");
  console.log(`\n(cached the brief to ${CACHE}; rerun with RESUME=1 to skip that stage)`);
}

for (const name of order) {
  const r = results[name];
  console.log(`\n--- ${name.toUpperCase()} ---`);
  console.log(r.value ? JSON.stringify(r.value, null, 2) : r.text);
}
