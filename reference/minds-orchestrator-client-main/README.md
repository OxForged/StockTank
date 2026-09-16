# minds-orchestrator-client

A dependency-free client for the [Animoca Minds](https://build.hellominds.ai) Builder API, plus
the small amount of code it takes to make several Minds work on one job.

There is not much code here, and that is deliberate. Most of the value sits in the
[field notes](#field-notes) at the bottom, which collect the things the Builder API does that
neither the documentation nor the published types prepare you for. Each one of them cost us a
debugging session against the live API before we understood what was happening. If you are wiring
a Mind into something real, that section is probably worth reading before the code.

Built while shipping a Mind into [FORKcast](https://forkcast.forked.gg), a live streamer
prediction market, where a Mind drafts market questions from stream context and a human approves
each one before it goes up.

Requires Node 18 or newer. No dependencies.

```bash
npm install minds-orchestrator-client
```

## Talk to one Mind

```js
import { MindsClient } from "minds-orchestrator-client";

const client = new MindsClient({ apiKey: process.env.MINDS_BUILDER_API_KEY });

const reply = await client.ask({
  mindId: "your-mind-id",
  alias: "support-thread",
  text: "Summarise the last three support tickets in two sentences.",
});
```

`ask` creates the conversation if it does not exist, posts the message, and polls until that
Mind's reply lands. An alias is a named conversation thread. Reuse one to give a Mind continuity,
or mint one per subject to keep threads short.

## Chain several Minds

Minds cannot hand work to each other. A Mind answers the message it was given and stops, and
Telegram does not deliver bot-to-bot messages, so a group chat full of Minds will sit there. The
coordinator has to be your code.

```js
import { MindsClient, runChain, extractJsonArray } from "minds-orchestrator-client";

const { results, last } = await runChain({
  client,
  input: { topic: "the Thursday product launch" },
  stages: [
    {
      name: "researcher",
      mindId: RESEARCH_MIND,
      timeoutMs: 780_000, // a Mind with a web-search connection is always the slow one
      prompt: ({ input }) => `Research ${input.topic} and write a 200-word factual brief.`,
    },
    {
      name: "drafter",
      mindId: DRAFT_MIND,
      prompt: ({ results }) =>
        `Turn this brief into three headline options.\n\n${results.researcher.text}\n\n` +
        `Respond with ONLY a JSON array of strings.`,
      parse: extractJsonArray,
    },
  ],
});

console.log(last.value);
```

Each stage sees `input`, every earlier `results` entry, and `previous`. A stage marked
`optional: true` records its error and lets the chain continue.

### Reruns are expensive, so skip what you already have

Slow stages hurt when you are iterating on a later one. Pass saved text under `resume` and that
stage is skipped, with its saved output flowing forward as if it had run:

```js
await runChain({
  client,
  resume: { researcher: readFileSync("cache/brief.txt", "utf8") },
  stages: [...],
});
```

### Ask several Minds at once

For independent opinions rather than a pipeline. Costs the wall-clock time of the slowest Mind
instead of the sum, and one failure does not sink the batch:

```js
import { askMany } from "minds-orchestrator-client";

const takes = await askMany({
  client,
  minds: [
    { name: "optimist", mindId: MIND_A },
    { name: "skeptic", mindId: MIND_B },
  ],
  text: "Is this launch date realistic? One paragraph.",
});
// [{ name: "optimist", text: "..." }, { name: "skeptic", text: null, error: MindsError }]
```

## API

| Export | What it does |
| --- | --- |
| `new MindsClient({ apiKey, base?, fetchImpl?, now?, pollMs?, timeoutMs?, onEvent? })` | The client. `fetchImpl` and `now` are injected so your tests stay offline. |
| `client.ask({ mindId, alias, text, timeoutMs?, attempts? })` | Send an instruction, resolve with the reply text. |
| `client.ensureConversation({ alias, mindId })` | Create the thread, tolerating one that already exists. |
| `client.send({ alias, text })` | Post without waiting. |
| `client.history(alias, limit?)` | Recent messages, always an array. |
| `client.waitForReply({ alias, seen?, timeoutMs? })` | Poll for a reply not in `seen`. Resolves null on timeout. |
| `client.listMinds()` | The Minds this key can reach. |
| `runChain({ client, stages, input?, resume?, onStage? })` | Run Minds in sequence. |
| `askMany({ client, minds, text, timeoutMs? })` | Run Minds in parallel. |
| `extractJsonArray(text)` / `extractJsonObject(text)` | Pull JSON out of a chatty reply. Null when there is none. |
| `stripHtml(text)` | Replies arrive wrapped in markup. |
| `MindsError` | Carries `.status` when the failure was an HTTP response. |

Pass `onEvent` to watch what the client is doing:

```js
new MindsClient({ apiKey, onEvent: (e) => console.log(e.type, e.alias) });
// conversation-created, send, reply, timeout, conversation-reused
```

<a name="field-notes"></a>

## Field notes on the Builder API

Observed against the live API between June and August 2026. Animoca ships changes, so treat this
as a snapshot and check anything that surprises you. Every workaround described here is
implemented in `src/client.mjs`.

**Both auth headers are required.** The API authenticates on the legacy `X-Access-Key`. Sending
only `X-Builder-Api-Key` returns 401, whatever the header name suggests. Send both.

**The public Builder API is messaging-only.** Create a conversation, post a message, read history.
There is no endpoint for creating Tools or Skills. Anything beyond conversation lives in the
dashboard.

**Creating a conversation is not idempotent.** A second create on the same alias returns
400 `alias already exists`. That existing thread is the one you want, so treat this single case as
success. Getting this wrong produces the nastiest failure mode on the platform: everything works
in development, then the first request after every restart fails, because your in-process cache of
known aliases resets while the server-side conversation does not.

**A conversation with no messages 404s on history.** That is how a freshly created thread reports
itself, so read it as nothing posted yet rather than as a failure.

**The `after` cursor on history does not filter the way the types imply.** Trust it and you will
hand back a reply to an earlier question. Snapshot the message fingerprints already in the thread
before you send, then wait for one that is not in the snapshot. Mind messages carry
`partyType: 0`.

**History comes back in several shapes.** Sometimes a bare array, sometimes wrapped in `items`,
`messages`, `history` or `data`. Normalise before you iterate.

**Replies are HTML.** Strip tags before parsing or displaying.

**Latency is wide and unpredictable: roughly 30 seconds to 13 minutes per call.** Minds backed by
a tool connection sit at the slow end. This is the single biggest constraint on designing anything
interactive. Budget for it in your UI, and set client timeouts well past what feels reasonable.

**Do not retry on timeout.** A retry posts a second message, the Mind answers that one too, and
you have paid Cognitions twice to get a single result. Given how wide the latency range is, a
timeout usually means the reply was still coming rather than lost, so the useful response to one
is a longer window instead of another message. `attempts` defaults to 1 here for that reason.

**Cognitions run out quietly.** A Mind with an empty balance keeps replying, in prose, asking you
to top up. If you are parsing structured output, that reads as a malformed answer rather than a
billing problem. Worth detecting explicitly if a Mind is in a production path.

**A configured persona does not reliably force a response format.** A Mind named and described as
a JSON-emitting drafter will still answer conversationally. Put the full instruction, including
the output contract, in the message itself. Self-contained instructions are also what makes a Mind
swappable between stages.

**Connections are a fixed catalogue, not generic HTTP.** At time of writing: Browser Use,
Browserbase, Linear, Superior Trade, Tavily. There is no tile for registering your own API. To
give a Mind access to your product, orchestrate from your own code, which is what this library is
for.

**Telegram does not deliver bot-to-bot messages.** A person messaging a bot triggers it normally,
but a bot's message never reaches another bot, so a group containing several Minds cannot pass
work between them no matter how the personas are written. We tested this with three Minds in one
group and the chain stalled at the first handoff. A group still works well as the place your
orchestrator posts a finished result for a human to see.

**Asking a Mind in chat to build and publish a Skill produces a confident description of work
that did not happen.** We were told a Skill had been built, published and equipped, with no URL
behind it, and on the third attempt got a link on an unrelated domain. Skill authoring is a
dashboard surface. Verify anything a Mind claims to have created by looking at it yourself.

**Keep one alias per subject.** Threads stay short enough that the reply is always inside the
polled history window, and each thread accumulates its own memory of that subject.

## What this is not

This is not an agent framework and does not try to become one. There is no planner, no
tool-calling loop and no memory abstraction, because the platform already owns memory and the
connection catalogue. What you get is a correct HTTP client for one API and a small sequential
runner on top of it. If you want more structure than that, this sits happily underneath whichever
framework you already use.

Not affiliated with or endorsed by Animoca Brands.

## Worked example

`examples/forkcast-oracle.mjs` is the pattern in production on FORKcast, kept whole rather than
trimmed to a toy. It shows the two things that matter beyond the transport: one conversation alias
per subject, and treating every field of a model reply as untrusted input, so a bad reply produces
fewer results rather than junk reaching the UI.

```bash
cp .env.example .env   # add your key and a mind id
npm run example:hello
npm run example:forkcast xqc
npm run example:circle "Broxah" "League of Legends" "Teemo Only Climb"
```

## Tests

```bash
npm test
```

27 tests, offline, no key needed. The client takes an injected `fetch` and clock, so the fixtures
model the real API's quirks, including the 400 on reuse and the stale-reply trap.

## Contributing

Corrections to the field notes are the most valuable thing you can send. If the API changed under
us, open an issue with what you saw and roughly when.

MIT.
