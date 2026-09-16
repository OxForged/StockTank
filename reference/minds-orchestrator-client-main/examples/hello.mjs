// Smallest useful round trip: send a Mind a message, print what it says back.
//
//   node --env-file=.env examples/hello.mjs "your question here"
//
// Leave MIND_ID blank in .env and this prints the Minds your key can reach.

import { MindsClient } from "../src/index.mjs";

const apiKey = process.env.MINDS_BUILDER_API_KEY;
if (!apiKey) {
  console.error("MINDS_BUILDER_API_KEY is not set. Copy .env.example to .env and fill it in.");
  process.exit(1);
}

const client = new MindsClient({
  apiKey,
  onEvent: (e) => console.log(`  [${e.type}]${e.alias ? " " + e.alias : ""}`),
});

const mindId = process.env.MIND_ID;
if (!mindId) {
  console.log("MIND_ID is not set. Minds reachable with this key:\n");
  for (const m of await client.listMinds()) {
    console.log(`  ${m.mindId ?? m.id}  ${m.name ?? "(unnamed)"}`);
  }
  console.log("\nPut one of those ids in .env as MIND_ID and run this again.");
  process.exit(0);
}

const question = process.argv[2] ?? "In one sentence, what are you good at?";
console.log(`asking ${mindId}: ${question}\n`);

const started = Date.now();
const reply = await client.ask({ mindId, alias: "example-hello", text: question });
console.log(`\n--- reply after ${Math.round((Date.now() - started) / 1000)}s ---\n${reply}`);
