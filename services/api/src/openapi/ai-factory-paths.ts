import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import {
  adminAiDraftListQuerySchema,
  adminAiDraftListSchema,
  adminAiDraftSchema,
  adminTranscriptSchema,
  aiDraftReviewInputSchema,
  aiJobListSchema,
  aiJobSchema,
  runFactoryInputSchema,
} from '@stocktank/types';
import type { GrowthPathHelpers } from './growth-paths.js';

const idParams = z.object({ id: z.string() });

/** AI content factory and review queue (§15, §20, §27, §56). */
export function registerAiFactoryPaths(registry: OpenAPIRegistry, h: GrowthPathHelpers): void {
  const { json, errorResponse, csrfHeaders, cookieAuth, commonErrors, authErrors, validationError } = h;
  const tag = 'Admin: AI';
  const AI = '/api/v1/admin/ai';
  const conflict = (why: string) => ({ 409: errorResponse(`${why} (CONFLICT)`) });
  const notFound = (what: string) => ({ 404: errorResponse(`${what} not found (NOT_FOUND)`) });
  const unavailable = { 503: errorResponse('The processing queue is not configured') };
  const reg = (method: 'get' | 'post', path: string, summary: string, description: string, o: { params?: z.ZodObject; query?: z.ZodObject; body?: z.ZodType; status?: number; schema?: z.ZodType; extra?: object }) =>
    registry.registerPath({
      method,
      path,
      tags: [tag],
      summary,
      description,
      security: cookieAuth,
      request: {
        ...(o.params ? { params: o.params } : {}),
        ...(o.query ? { query: o.query } : {}),
        ...(method === 'post' ? { headers: csrfHeaders } : {}),
        ...(o.body ? { body: { required: true, content: json(o.body) } } : {}),
      },
      responses: { [o.status ?? 200]: { description: summary, content: json(o.schema ?? z.object({})) }, ...validationError, ...authErrors, ...(o.extra ?? {}), ...commonErrors },
    });

  reg('get', `${AI}/moderation-flags`, 'Moderation flag labels', 'Requires `ai.review`.', { schema: z.object({ items: z.array(z.object({ key: z.string(), label: z.string() })) }) });
  reg('get', `${AI}/episodes/{id}/transcript`, 'Episode transcript', 'Requires `ai.review`. Status, text, timestamped segments and confidence.', { params: idParams, schema: adminTranscriptSchema, extra: notFound('Transcript') });
  reg('post', `${AI}/episodes/{id}/transcribe`, 'Queue transcription', 'Requires `ai.review`. Needs processed audio; one job at a time per episode. Metered against AI budgets. Audited.', {
    params: idParams,
    status: 202,
    schema: aiJobSchema,
    extra: { ...notFound('Episode'), ...conflict('No audio, or already running'), ...unavailable },
  });
  reg('post', `${AI}/episodes/{id}/factory`, 'Run the content factory', 'Requires `ai.review` and a ready transcript. Generates the requested draft kinds (all by default) into the review queue; drafts are verified against the transcript and moderated. Audited.', {
    params: idParams,
    body: runFactoryInputSchema,
    status: 202,
    schema: aiJobSchema,
    extra: { ...notFound('Episode'), ...conflict('Transcript not ready or factory already running'), ...unavailable },
  });
  reg('get', `${AI}/jobs`, 'AI jobs', 'Requires `ai.review`. Latest 100 transcription and factory jobs.', { schema: aiJobListSchema });
  reg('get', `${AI}/drafts`, 'Review queue', 'Requires `ai.review`. Filter by status, kind and episode.', { query: adminAiDraftListQuerySchema, schema: adminAiDraftListSchema });
  reg('post', `${AI}/drafts/{id}/review`, 'Review a draft', 'Requires `ai.review` and `content.publish`. Approving requires acknowledging every moderation flag; optional edited content is validated against the kind. Approval applies summaries, show notes, entities, topics and clip candidates (as clips awaiting review). Audited.', {
    params: idParams,
    body: aiDraftReviewInputSchema,
    schema: adminAiDraftSchema,
    extra: { ...notFound('Draft'), ...conflict('Already reviewed') },
  });
}
