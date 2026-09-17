import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { MediaJob, ObjectStorage } from '@stocktank/media';
import {
  adminClipListSchema,
  adminClipSchema,
  adminMediaAssetListSchema,
  adminMediaAssetSchema,
  createMediaUploadResponseSchema,
  episodeDetailResponseSchema,
  mediaStatusResponseSchema,
} from '@stocktank/types';
import type { MediaService } from '../src/lib/media.js';
import { CSRF_HEADERS, createTestContext, loginAs, resetContent, resetDb, seedUser, type TestContext } from './helpers.js';

/** In-memory storage: records presigned keys and lets tests decide which objects "exist". */
class FakeStorage implements ObjectStorage {
  objects = new Map<string, number>();
  presignUpload(key: string, contentType: string, contentLength: number) {
    return Promise.resolve(`http://storage.test/${key}?ct=${encodeURIComponent(contentType)}&len=${contentLength}&sig=fake`);
  }
  head(key: string) {
    const size = this.objects.get(key);
    return Promise.resolve(size === undefined ? null : { size, contentType: undefined });
  }
  download() {
    return Promise.reject(new Error('not used by the API'));
  }
  uploadFile() {
    return Promise.resolve();
  }
  uploadDirectory() {
    return Promise.resolve(0);
  }
  delete(key: string) {
    this.objects.delete(key);
    return Promise.resolve();
  }
  publicUrl(key: string) {
    return `http://cdn.test/${key}`;
  }
}

describe('media uploads, processing state and clips', () => {
  let ctx: TestContext;
  let storage: FakeStorage;
  const jobs: Array<{ job: MediaJob; attempt: number }> = [];
  let creator: string;
  let editor: string;
  let viewer: string;
  let episodeId: string;

  const media: MediaService = {
    get storage() {
      return storage;
    },
    queue: {
      enqueue: (job, attempt) => {
        jobs.push({ job, attempt });
        return Promise.resolve();
      },
      close: () => Promise.resolve(),
    },
    maxUploadBytes: 10 * 1024 * 1024,
    publicUrl: (key) => (key ? `http://cdn.test/${key}` : null),
  };

  const as = (cookie: string) => ({
    get: (url: string) => request(ctx.app).get(url).set('Cookie', cookie),
    post: (url: string, body: object = {}) => request(ctx.app).post(url).set('Cookie', cookie).set(CSRF_HEADERS).send(body),
    put: (url: string, body: object) => request(ctx.app).put(url).set('Cookie', cookie).set(CSRF_HEADERS).send(body),
  });
  const M = '/api/v1/admin/media';

  beforeAll(async () => {
    ctx = await createTestContext({ redis: false, media });
  });
  beforeEach(async () => {
    storage = new FakeStorage();
    jobs.length = 0;
    await resetContent(ctx.prisma);
    await resetDb(ctx.prisma);
    await seedUser(ctx.prisma, { email: 'creator@example.com', roles: ['creator'] });
    await seedUser(ctx.prisma, { email: 'editor@example.com', roles: ['editor'] });
    await seedUser(ctx.prisma, { email: 'viewer@example.com', roles: ['viewer'] });
    creator = await loginAs(ctx.app, 'creator@example.com');
    editor = await loginAs(ctx.app, 'editor@example.com');
    viewer = await loginAs(ctx.app, 'viewer@example.com');
    const show = await ctx.prisma.show.create({ data: { slug: 'media-show', title: 'Media Show', status: 'published' } });
    const episode = await ctx.prisma.episode.create({
      data: { showId: show.id, slug: 'ep-1', title: 'Episode One', status: 'published', publishedAt: new Date() },
    });
    episodeId = episode.id;
  });
  afterAll(async () => {
    await resetContent(ctx.prisma);
    await resetDb(ctx.prisma);
    await ctx.close();
  });

  const startUpload = async (sizeBytes = 2048) => {
    const res = await as(creator).post(`${M}/uploads`, { filename: 'episode-one.mp4', mimeType: 'video/mp4', sizeBytes, episodeId });
    expect(res.status).toBe(201);
    return createMediaUploadResponseSchema.parse(res.body);
  };

  it('reports capabilities and requires staff permissions', async () => {
    const status = mediaStatusResponseSchema.parse((await as(creator).get(`${M}/status`)).body);
    expect(status).toMatchObject({ storageConfigured: true, queueConfigured: true, maxUploadBytes: 10 * 1024 * 1024 });
    expect(status.acceptedMimeTypes).toContain('video/quicktime');
    expect((await as(viewer).get(`${M}/status`)).status).toBe(403);
    expect((await request(ctx.app).get(`${M}/assets`)).status).toBe(401);
    expect((await as(viewer).post(`${M}/uploads`, { filename: 'x.mp4', mimeType: 'video/mp4', sizeBytes: 10 })).status).toBe(403);
  });

  it('issues a presigned upload, verifies the object, then queues exactly one transcode', async () => {
    const { asset, upload } = await startUpload();
    expect(asset).toMatchObject({ status: 'pending_upload', kind: 'video', targetEpisodeId: episodeId, episodeId: null, playback: null });
    expect(upload.method).toBe('PUT');
    expect(upload.headers['Content-Type']).toBe('video/mp4');
    expect(upload.url).toContain(`originals/${asset.id}/source.mp4`);

    // Completing before the object exists is refused.
    expect((await as(creator).post(`${M}/assets/${asset.id}/complete`)).status).toBe(400);
    // A size mismatch is refused (truncated or swapped upload).
    const row = await ctx.prisma.mediaAsset.findUniqueOrThrow({ where: { id: asset.id } });
    storage.objects.set(row.originalKey, 1000);
    const mismatch = await as(creator).post(`${M}/assets/${asset.id}/complete`);
    expect(mismatch.status).toBe(400);
    expect(mismatch.body.error.message).toMatch(/does not match/);

    storage.objects.set(row.originalKey, 2048);
    const done = await as(creator).post(`${M}/assets/${asset.id}/complete`);
    expect(done.status).toBe(200);
    expect(adminMediaAssetSchema.parse(done.body)).toMatchObject({ status: 'uploaded', attempts: 1 });
    expect(jobs).toEqual([{ job: { type: 'transcode', assetId: asset.id }, attempt: 1 }]);

    // A second complete does not enqueue again.
    expect((await as(creator).post(`${M}/assets/${asset.id}/complete`)).status).toBe(409);
    expect(jobs).toHaveLength(1);

    const audit = await ctx.prisma.auditLog.findMany({ where: { targetId: asset.id }, orderBy: { createdAt: 'asc' } });
    expect(audit.map((a) => a.action)).toEqual(['content.media.upload_started', 'content.media.upload_completed']);
  });

  it('rejects unsupported formats, oversize files and unknown episodes', async () => {
    const bad = await as(creator).post(`${M}/uploads`, { filename: 'x.webm', mimeType: 'video/webm', sizeBytes: 10 });
    expect(bad.status).toBe(400);
    const big = await as(creator).post(`${M}/uploads`, { filename: 'x.mp4', mimeType: 'video/mp4', sizeBytes: 11 * 1024 * 1024 });
    expect(big.status).toBe(400);
    expect(big.body.error.message).toMatch(/at most 10 MB/);
    const orphan = await as(creator).post(`${M}/uploads`, { filename: 'x.mp3', mimeType: 'audio/mpeg', sizeBytes: 10, episodeId: 'nope' });
    expect(orphan.status).toBe(400);
  });

  it('answers 503 instead of pretending when storage is not configured', async () => {
    const original = storage;
    storage = null as unknown as FakeStorage;
    try {
      const res = await as(creator).post(`${M}/uploads`, { filename: 'x.mp4', mimeType: 'video/mp4', sizeBytes: 10 });
      expect(res.status).toBe(503);
    } finally {
      storage = original;
    }
  });

  it('retries only failed assets and exposes ready media publicly', async () => {
    const { asset } = await startUpload();
    expect((await as(creator).post(`${M}/assets/${asset.id}/retry`)).status).toBe(409);

    await ctx.prisma.mediaAsset.update({ where: { id: asset.id }, data: { status: 'failed', attempts: 1, error: 'ffmpeg exited with 1' } });
    const retry = await as(creator).post(`${M}/assets/${asset.id}/retry`);
    expect(retry.status).toBe(200);
    expect(retry.body).toMatchObject({ status: 'uploaded', attempts: 2, error: null });
    expect(jobs.at(-1)).toEqual({ job: { type: 'transcode', assetId: asset.id }, attempt: 2 });

    // Before processing finishes the public page must not offer a player.
    let detail = episodeDetailResponseSchema.parse((await request(ctx.app).get('/api/v1/shows/media-show/episodes/ep-1')).body);
    expect(detail.media).toBeNull();

    // Simulate the worker finishing.
    await ctx.prisma.$transaction([
      ctx.prisma.mediaAsset.update({
        where: { id: asset.id },
        data: {
          status: 'ready',
          progress: 100,
          durationSeconds: 61.5,
          renditions: { hls: `renditions/${asset.id}/hls/master.m3u8`, audio: `renditions/${asset.id}/audio.mp3`, poster: `renditions/${asset.id}/poster.jpg`, variants: [] },
        },
      }),
      ctx.prisma.episode.update({ where: { id: episodeId }, data: { mediaAssetId: asset.id } }),
    ]);

    detail = episodeDetailResponseSchema.parse((await request(ctx.app).get('/api/v1/shows/media-show/episodes/ep-1')).body);
    expect(detail.media).toEqual({
      kind: 'video',
      hlsUrl: `http://cdn.test/renditions/${asset.id}/hls/master.m3u8`,
      audioUrl: `http://cdn.test/renditions/${asset.id}/audio.mp3`,
      posterUrl: `http://cdn.test/renditions/${asset.id}/poster.jpg`,
      durationSeconds: 61.5,
    });

    const list = adminMediaAssetListSchema.parse((await as(creator).get(`${M}/assets?episodeId=${episodeId}`)).body);
    expect(list.items).toHaveLength(1);
    expect(list.items[0]).toMatchObject({ episodeId, status: 'ready' });

    expect((await as(creator).post(`${M}/episodes/${episodeId}/detach`)).status).toBe(204);
    detail = episodeDetailResponseSchema.parse((await request(ctx.app).get('/api/v1/shows/media-show/episodes/ep-1')).body);
    expect(detail.media).toBeNull();
  });

  it('manages clips with review workflow, render queueing and cut invalidation', async () => {
    const invalid = await as(creator).post(`${M}/clips`, { sourceEpisodeId: episodeId, title: 'Bad', startTime: 30, endTime: 10 });
    expect(invalid.status).toBe(400);
    const tooLong = await as(creator).post(`${M}/clips`, { sourceEpisodeId: episodeId, title: 'Long', startTime: 0, endTime: 900 });
    expect(tooLong.status).toBe(400);

    const created = await as(creator).post(`${M}/clips`, { sourceEpisodeId: episodeId, title: 'The pitch', startTime: 12, endTime: 42 });
    expect(created.status).toBe(201);
    const clip = adminClipSchema.parse(created.body);
    expect(clip).toMatchObject({ reviewStatus: 'draft', renderStatus: null, sourceEpisode: { id: episodeId, hasMedia: false } });

    // No processed media yet.
    expect((await as(creator).post(`${M}/clips/${clip.id}/render`)).status).toBe(409);

    const asset = await ctx.prisma.mediaAsset.create({
      data: { kind: 'video', status: 'ready', originalKey: 'originals/clip-src/source.mp4', originalName: 'src.mp4', mimeType: 'video/mp4', sizeBytes: 10n },
    });
    await ctx.prisma.episode.update({ where: { id: episodeId }, data: { mediaAssetId: asset.id } });

    const render = await as(creator).post(`${M}/clips/${clip.id}/render`);
    expect(render.status).toBe(202);
    expect(render.body.renderStatus).toBe('uploaded');
    expect(jobs.at(-1)?.job).toEqual({ type: 'render-clip', clipId: clip.id });
    expect((await as(creator).post(`${M}/clips/${clip.id}/render`)).status).toBe(409);

    await ctx.prisma.clip.update({
      where: { id: clip.id },
      data: {
        renderStatus: 'ready',
        renditions: { horizontal: 'renditions/clips/c/horizontal.mp4', vertical: 'renditions/clips/c/vertical.mp4', square: null, audio: null, thumbnail: null },
      },
    });

    // Creators cannot publish; editors can.
    const body = { sourceEpisodeId: episodeId, title: 'The pitch', startTime: 12, endTime: 42 };
    expect((await as(creator).put(`${M}/clips/${clip.id}`, { ...body, reviewStatus: 'published' })).status).toBe(403);
    const published = await as(editor).put(`${M}/clips/${clip.id}`, { ...body, reviewStatus: 'published' });
    expect(published.status).toBe(200);
    expect(published.body.renderStatus).toBe('ready');

    const detail = episodeDetailResponseSchema.parse((await request(ctx.app).get('/api/v1/shows/media-show/episodes/ep-1')).body);
    expect(detail.clips).toHaveLength(1);
    expect(detail.clips[0]?.media).toMatchObject({ verticalUrl: 'http://cdn.test/renditions/clips/c/vertical.mp4', squareUrl: null });

    // Changing the cut drops stale renders.
    const recut = await as(editor).put(`${M}/clips/${clip.id}`, { ...body, endTime: 50, reviewStatus: 'published' });
    expect(recut.body).toMatchObject({ renderStatus: null, media: null });

    const list = adminClipListSchema.parse((await as(creator).get(`${M}/clips?reviewStatus=published`)).body);
    expect(list.total).toBe(1);
  });
});
