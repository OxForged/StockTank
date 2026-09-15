// Orchestration helpers: make several Minds work on one job.
//
// Minds cannot hand off to each other on their own. A Mind replies once to the
// message it was given and then stops, and Telegram does not deliver bot-to-bot
// messages, so a group chat full of Minds will not self-drive a workflow. The
// coordinator has to be code. That is what this file is.

import { MindsError } from "./client.mjs";

/**
 * Run Minds in sequence, piping each reply into the next stage's prompt.
 *
 * @param {object} p
 * @param {import("./client.mjs").MindsClient} p.client
 * @param {Array<Stage>} p.stages
 * @param {object} [p.input]      Job input, available to every prompt builder.
 * @param {object} [p.resume]     Saved text keyed by stage name. A stage with an
 *                                entry here is skipped and its saved output used
 *                                instead, so a rerun does not pay for the slow
 *                                stages again.
 * @param {(event: object) => void} [p.onStage]
 * @returns {Promise<ChainResult>}
 *
 * @typedef {object} Stage
 * @property {string} name
 * @property {string} mindId
 * @property {string} [alias]                Defaults to `chain-<name>`.
 * @property {(ctx: StageContext) => string} prompt
 * @property {(text: string) => any} [parse] Structured value from the reply.
 * @property {number} [timeoutMs]
 * @property {boolean} [optional]            Keep going if this stage fails.
 *
 * @typedef {object} StageContext
 * @property {object} input
 * @property {Record<string, StageResult>} results  Every completed stage so far.
 * @property {StageResult|null} previous            The stage immediately before.
 *
 * @typedef {object} StageResult
 * @property {string} name
 * @property {string} text
 * @property {any} value
 * @property {boolean} resumed
 * @property {number} ms
 * @property {Error} [error]
 *
 * @typedef {object} ChainResult
 * @property {Record<string, StageResult>} results
 * @property {StageResult|null} last
 * @property {string[]} order
 */
export async function runChain({ client, stages, input = {}, resume = {}, onStage = () => {} }) {
  if (!client) throw new MindsError("client is required");
  if (!Array.isArray(stages) || stages.length === 0) throw new MindsError("at least one stage is required");

  const results = {};
  const order = [];
  let previous = null;

  for (const stage of stages) {
    assertStage(stage);
    const started = client.now();
    const alias = stage.alias ?? `chain-${stage.name}`;
    onStage({ type: "stage-start", name: stage.name, alias, mindId: stage.mindId });

    let text;
    let resumed = false;
    try {
      if (typeof resume[stage.name] === "string" && resume[stage.name].trim()) {
        text = resume[stage.name].trim();
        resumed = true;
      } else {
        text = await client.ask({
          mindId: stage.mindId,
          alias,
          text: stage.prompt({ input, results, previous }),
          timeoutMs: stage.timeoutMs,
        });
      }
    } catch (e) {
      const failure = { name: stage.name, text: "", value: null, resumed: false, ms: client.now() - started, error: e };
      results[stage.name] = failure;
      order.push(stage.name);
      onStage({ type: "stage-error", name: stage.name, error: e });
      if (stage.optional) {
        previous = failure;
        continue;
      }
      throw e;
    }

    const result = {
      name: stage.name,
      text,
      value: stage.parse ? stage.parse(text) : null,
      resumed,
      ms: client.now() - started,
    };
    results[stage.name] = result;
    order.push(stage.name);
    previous = result;
    onStage({ type: "stage-done", name: stage.name, resumed, ms: result.ms, chars: text.length });
  }

  return { results, last: previous, order };
}

/**
 * Ask several Minds the same question at once and collect every answer.
 *
 * Useful when you want independent takes rather than a pipeline, and it costs
 * wall-clock time equal to the slowest Mind instead of the sum of all of them.
 * A Mind that fails resolves to an entry with `error` set rather than rejecting
 * the whole batch.
 *
 * @param {object} p
 * @param {import("./client.mjs").MindsClient} p.client
 * @param {Array<{name: string, mindId: string, alias?: string}>} p.minds
 * @param {string} p.text
 * @param {number} [p.timeoutMs]
 * @returns {Promise<Array<{name: string, text: string|null, error?: Error}>>}
 */
export async function askMany({ client, minds, text, timeoutMs }) {
  if (!client) throw new MindsError("client is required");
  if (!Array.isArray(minds) || minds.length === 0) throw new MindsError("at least one mind is required");

  return Promise.all(
    minds.map(async (m) => {
      try {
        const reply = await client.ask({
          mindId: m.mindId,
          alias: m.alias ?? `fanout-${m.name}`,
          text,
          timeoutMs,
        });
        return { name: m.name, text: reply };
      } catch (e) {
        return { name: m.name, text: null, error: e };
      }
    }),
  );
}

function assertStage(stage) {
  if (!stage || typeof stage !== "object") throw new MindsError("each stage must be an object");
  if (!stage.name) throw new MindsError("each stage needs a name");
  if (!stage.mindId) throw new MindsError(`stage "${stage.name}" needs a mindId`);
  if (typeof stage.prompt !== "function") throw new MindsError(`stage "${stage.name}" needs a prompt function`);
}
