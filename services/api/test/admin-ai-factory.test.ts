import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { MediaJob } from '@stocktank/media';
import { adminAiDraftListSchema, adminAiDraftSchema, adminTranscriptSchema, aiJobListSchema, aiJobSchema } from '@stocktank/types';
import type { MediaService } from '../src/lib/media.js';
import { CSRF_HEADERS, createTestContext, loginAs, resetContent, resetDb, seedUser, type TestContext } from './helpers.js';

describe('AI content factory: transcripts, jobs, review queue', () => {
  let ctx: TestContext;
  let editor: string;
  let creator: string;
  let episodeId: string;
  let companyId: string;
  const jobs: MediaJob[] = [];
  const media: MediaService = {
    storage: null,
    queue: { enqueue: (job) => (jobs.push(job), Promise.resolve()), close: () => Promise.resolve() },
    maxUploadBytes: 1,
    publicUrl: (k) => (k ? `https://cdn.test/${k}` : null),
  };
  const as = (cookie: string) => ({
    get: (url: string) => request(ctx.app).get(url).set('Cookie', cookie),
    post: (url: string, body: object = {}) => request(ctx.app).post(url).set('Cookie', cookie).set(CSRF_HEADERS).send(body),
  });
  const AI = '/api/v1/admin/ai';

  beforeAll(async () => {
    ctx = await createTestContext({ redis: false, media });
  });
  beforeEach(async () => {
    jobs.length = 0;
    await ctx.prisma.aiDraft.deleteMany({});
    await resetContent(ctx.prisma);
    await resetDb(ctx.prisma);
    await seedUser(ctx.prisma, { email: 'editor@example.com', roles: ['editor'] });
    await seedUser(ctx.prisma, { email: 'creator@example.com', roles: ['creator'] });
    editor = await loginAs(ctx.app, 'editor@example.com');
    creator = await loginAs(ctx.app, 'creator@example.com');
    const show = await ctx.prisma.show.create({ data: { slug: 'tank', title: 'The Tank', status: 'published' } });
    const asset = await ctx.prisma.mediaAsset.create({
      data: { kind: 'audio', status: 'ready', originalKey: 'originals/f/source.mp3', originalName: 'f.mp3', mimeType: 'audio/mpeg', sizeBytes: 1n, durationSeconds: 60, renditions: { hls: null, audio: 'renditions/f/audio.mp3', poster: null, variants: [] } },
    });
    episodeId = (await ctx.prisma.episode.create({ data: { showId: show.id, slug: 'ep', title: 'Episode', status: 'published', publishedAt: new Date(), mediaAssetId: asset.id } })).id;
    companyId = (await ctx.prisma.company.create({ data: { slug: 'acme', name: 'Acme Custody', status: 'published' } })).id;
  });
  afterAll(async () => {
    await ctx.prisma.aiDraft.deleteMany({});
    await resetContent(ctx.prisma);
    await resetDb(ctx.prisma);
    await ctx.close();
  });

  it('queues transcription once, then the factory only after the transcript is ready', async () => {
    expect((await as(creator).post(`${AI}/episodes/${episodeId}/transcribe`)).status).toBe(403);
    expect((await as(editor).post(`${AI}/episodes/${episodeId}/factory`)).status).toBe(409); // no transcript yet

    const queued = await as(editor).post(`${AI}/episodes/${episodeId}/transcribe`);
    expect(queued.status).toBe(202);
    const job = aiJobSchema.parse(queued.body);
    expect(jobs).toEqual([{ type: 'transcribe', jobId: job.id, episodeId }]);
    expect((await as(editor).post(`${AI}/episodes/${episodeId}/transcribe`)).status).toBe(409);
    expect(adminTranscriptSchema.parse((await as(editor).get(`${AI}/episodes/${episodeId}/transcript`)).body).status).toBe('queued');

    // Worker finishes.
    await ctx.prisma.aiJob.update({ where: { id: job.id }, data: { status: 'succeeded' } });
    await ctx.prisma.transcript.update({ where: { episodeId }, data: { status: 'ready', text: 'Hello from the Tank.', segments: [{ start: 0, end: 3, text: 'Hello from the Tank.', speaker: null, confidence: 0.9 }], durationSeconds: 60 } });

    const factory = await as(editor).post(`${AI}/episodes/${episodeId}/factory`, { kinds: ['summary', 'entities'] });
    expect(factory.status).toBe(202);
    expect(jobs.at(-1)).toMatchObject({ type: 'content-factory', episodeId, kinds: ['summary', 'entities'] });
    expect((await as(editor).post(`${AI}/episodes/${episodeId}/factory`)).status).toBe(409);
    const list = aiJobListSchema.parse((await as(editor).get(`${AI}/jobs`)).body);
    expect(list.items.map((j) => j.type)).toEqual(['content_factory', 'transcribe']);
    expect(list.items[0]!.episodeTitle).toBe('Episode');
    expect((await as(editor).post(`${AI}/episodes/${episodeId}/factory`, { kinds: ['bogus'] })).status).toBe(400);
  });

  it('reviews drafts: flags must be acknowledged, edits are validated, approval applies to the episode', async () => {
    const summary = await ctx.prisma.aiDraft.create({
      data: { episodeId, kind: 'summary', content: { summary: 'The hosts explain tokenized treasuries and why you should buy them today.' }, provider: 'stub', model: 'stub-1', promptVersion: 'v1', moderationFlags: ['investment_advice'], citations: { items: [{ start: 0, end: 3, quote: 'Hello' }], notes: [] } },
    });
    const entities = await ctx.prisma.aiDraft.create({
      data: { episodeId, kind: 'entities', content: { companies: [{ name: 'Acme Custody', evidence: 'Acme Custody', matchedCompanyId: companyId }], projects: [], people: [] }, provider: 'stub', model: 'stub-1', promptVersion: 'v1', moderationFlags: [] },
    });
    const queue = adminAiDraftListSchema.parse((await as(editor).get(`${AI}/drafts?status=review`)).body);
    expect(queue.total).toBe(2);
    expect(queue.items.find((d) => d.kind === 'summary')).toMatchObject({ moderationFlags: ['investment_advice'], citations: [{ start: 0, end: 3, quote: 'Hello' }], showTitle: 'The Tank' });
    expect((await as(creator).get(`${AI}/drafts`)).status).toBe(403);

    // Approving with an unacknowledged flag is refused.
    const refused = await as(editor).post(`${AI}/drafts/${summary.id}/review`, { decision: 'approve' });
    expect(refused.status).toBe(400);
    expect(refused.body.error.message).toMatch(/investment_advice/);
    // Invalid edited content is refused.
    expect((await as(editor).post(`${AI}/drafts/${summary.id}/review`, { decision: 'approve', acknowledgedFlags: ['investment_advice'], content: { summary: 'x' } })).status).toBe(400);

    const approved = await as(editor).post(`${AI}/drafts/${summary.id}/review`, {
      decision: 'approve',
      acknowledgedFlags: ['investment_advice'],
      note: 'Removed the advice sentence',
      content: { summary: 'The hosts explain what tokenized treasuries are and the risks to check.' },
    });
    expect(approved.status).toBe(200);
    expect(adminAiDraftSchema.parse(approved.body)).toMatchObject({ status: 'approved', reviewer: { displayName: 'editor' }, reviewNote: 'Removed the advice sentence' });
    expect((await ctx.prisma.episode.findUniqueOrThrow({ where: { id: episodeId } })).summary).toBe('The hosts explain what tokenized treasuries are and the risks to check.');
    expect((await as(editor).post(`${AI}/drafts/${summary.id}/review`, { decision: 'reject' })).status).toBe(409);

    expect((await as(editor).post(`${AI}/drafts/${entities.id}/review`, { decision: 'approve' })).status).toBe(200);
    expect(await ctx.prisma.episodeCompany.count({ where: { episodeId, companyId } })).toBe(1);

    const audit = await ctx.prisma.auditLog.findMany({ where: { action: { startsWith: 'ai.draft.' } } });
    expect(audit).toHaveLength(2);
  });

  it('turns approved clip candidates into clips awaiting their own review', async () => {
    const draft = await ctx.prisma.aiDraft.create({
      data: {
        episodeId,
        kind: 'clip_candidates',
        content: { candidates: [{ title: 'The squeeze', start: 10, end: 40, targetSeconds: 30, reason: 'explanation', transcript: 'words', confidence: 0.7 }] },
        provider: 'stub',
        model: 'stub-1',
        promptVersion: 'v1',
        moderationFlags: [],
      },
    });
    const rejected = await as(editor).post(`${AI}/drafts/${draft.id}/review`, { decision: 'reject', note: 'Not this one' });
    expect(rejected.body.status).toBe('rejected');
    expect(await ctx.prisma.clip.count()).toBe(0);

    const again = await ctx.prisma.aiDraft.create({ data: { ...draft, id: undefined, status: 'review', createdAt: undefined, updatedAt: undefined, content: draft.content as object, citations: undefined } });
    await as(editor).post(`${AI}/drafts/${again.id}/review`, { decision: 'approve' });
    const clips = await ctx.prisma.clip.findMany();
    expect(clips).toHaveLength(1);
    expect(clips[0]).toMatchObject({ title: 'The squeeze', startTime: 10, endTime: 40, reviewStatus: 'review', generationModel: 'stub-1', confidence: 0.7 });
  });

  it('lists moderation flag labels for the reviewer UI', async () => {
    const res = await as(editor).get(`${AI}/moderation-flags`);
    expect(res.body.items).toEqual(expect.arrayContaining([{ key: 'investment_advice', label: expect.stringMatching(/advice/i) }]));
  });
});
