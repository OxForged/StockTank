import { copyFile, mkdir, mkdtemp, readdir, readFile, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import pino from 'pino';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient } from '@stocktank/database';
import type { ObjectStorage } from '@stocktank/media';
import { CastopodError, type PodcastHostAdapter, type PublishEpisodeInput } from '@stocktank/podcast';
import { resolveTools, runTool, ToolError } from '../src/ffmpeg-runner.js';
import { createProcessor, PermanentMediaError, publicErrorMessage } from '../src/processor.js';

/** Object storage backed by a local directory, so the pipeline runs end to end without MinIO. */
class DirectoryStorage implements ObjectStorage {
  constructor(readonly root: string) {}
  private file(key: string) {
    return path.join(this.root, ...key.split('/'));
  }
  async put(key: string, from: string) {
    await mkdir(path.dirname(this.file(key)), { recursive: true });
    await copyFile(from, this.file(key));
  }
  presignUpload(key: string) {
    return Promise.resolve(`http://storage.test/${key}`);
  }
  async head(key: string) {
    try {
      return { size: (await stat(this.file(key))).size, contentType: undefined };
    } catch {
      return null;
    }
  }
  async download(key: string, filePath: string) {
    await copyFile(this.file(key), filePath);
  }
  async uploadFile(key: string, filePath: string) {
    await this.put(key, filePath);
  }
  async uploadDirectory(prefix: string, dir: string): Promise<number> {
    let n = 0;
    for (const e of await readdir(dir, { withFileTypes: true })) {
      if (e.isDirectory()) n += await this.uploadDirectory(`${prefix}/${e.name}`, path.join(dir, e.name));
      else {
        await this.put(`${prefix}/${e.name}`, path.join(dir, e.name));
        n++;
      }
    }
    return n;
  }
  async delete(key: string) {
    await rm(this.file(key), { force: true });
  }
  publicUrl(key: string) {
    return `http://cdn.test/${key}`;
  }
}

const prisma = createPrismaClient(process.env.DATABASE_URL!);
const tools = resolveTools();
const logger = pino({ level: 'silent' });
let root: string;
let storage: DirectoryStorage;
let sampleVideo: string;
let sampleAudio: string;
let episodeId: string;
let showId: string;

beforeAll(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'stocktank-worker-test-'));
  storage = new DirectoryStorage(path.join(root, 'bucket'));
  sampleVideo = path.join(root, 'sample.mp4');
  sampleAudio = path.join(root, 'sample.mp3');
  // 3 seconds of 854x480 test pattern with a tone: small, fast, and exercises the 480p rendition + audio.
  await runTool(tools.ffmpeg, [
    '-hide_banner', '-y',
    '-f', 'lavfi', '-i', 'testsrc2=size=854x480:rate=24:duration=3',
    '-f', 'lavfi', '-i', 'sine=frequency=440:duration=3',
    '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', sampleVideo,
  ]);
  await runTool(tools.ffmpeg, ['-hide_banner', '-y', '-f', 'lavfi', '-i', 'sine=frequency=220:duration=2', '-c:a', 'libmp3lame', sampleAudio]);

  const show = await prisma.show.create({ data: { slug: `worker-test-${Date.now()}`, title: 'Worker Test Show', isDemo: true } });
  showId = show.id;
  const episode = await prisma.episode.create({ data: { showId, slug: 'worker-episode', title: 'Worker Episode', isDemo: true } });
  episodeId = episode.id;
}, 120_000);

afterAll(async () => {
  await prisma.mediaAsset.deleteMany({ where: { originalName: { startsWith: 'worker-test' } } });
  await prisma.show.deleteMany({ where: { id: showId } });
  await prisma.$disconnect();
  await rm(root, { recursive: true, force: true });
});

async function createAsset(kind: 'video' | 'audio', mimeType: string, file: string, targetEpisodeId?: string) {
  const asset = await prisma.mediaAsset.create({
    data: {
      kind,
      mimeType,
      status: 'uploaded',
      originalKey: `originals/worker-test-${Date.now()}-${Math.random().toString(36).slice(2)}/source`,
      originalName: `worker-test-${path.basename(file)}`,
      sizeBytes: BigInt((await stat(file)).size),
      targetEpisodeId: targetEpisodeId ?? null,
    },
  });
  await storage.put(asset.originalKey, file);
  return asset;
}

describe('media processor', () => {
  it('transcodes video into HLS, mp3 and a poster, then switches the episode to it', async () => {
    const process = createProcessor({ prisma, storage, tools, logger, workRoot: root });
    const asset = await createAsset('video', 'video/mp4', sampleVideo, episodeId);

    await process({ type: 'transcode', assetId: asset.id });

    const ready = await prisma.mediaAsset.findUniqueOrThrow({ where: { id: asset.id } });
    expect(ready).toMatchObject({ status: 'ready', progress: 100, width: 854, height: 480, error: null });
    expect(ready.durationSeconds).toBeGreaterThan(2.5);
    expect(ready.renditions).toMatchObject({
      hls: `renditions/${asset.id}/hls/master.m3u8`,
      audio: `renditions/${asset.id}/audio.mp3`,
      poster: `renditions/${asset.id}/poster.jpg`,
      variants: [{ name: '480p', height: 480 }],
    });
    const mp3Size = (await stat(path.join(storage.root, 'renditions', asset.id, 'audio.mp3'))).size;
    expect((ready.renditions as { audioBytes?: number }).audioBytes).toBe(mp3Size);

    const master = await readFile(path.join(storage.root, 'renditions', asset.id, 'hls', 'master.m3u8'), 'utf8');
    expect(master).toContain('RESOLUTION=854x480');
    expect(master).toContain('audio.m3u8');
    const variant = await readFile(path.join(storage.root, 'renditions', asset.id, 'hls', '480p.m3u8'), 'utf8');
    expect(variant).toContain('#EXT-X-ENDLIST');
    expect((await stat(path.join(storage.root, 'renditions', asset.id, 'audio.mp3'))).size).toBeGreaterThan(1000);

    const episode = await prisma.episode.findUniqueOrThrow({ where: { id: episodeId } });
    expect(episode.mediaAssetId).toBe(asset.id);
    expect(episode.durationSeconds).toBe(3);
  });

  it('renders horizontal, vertical and square clips from source timestamps', async () => {
    const process = createProcessor({ prisma, storage, tools, logger, workRoot: root });
    const clip = await prisma.clip.create({ data: { sourceEpisodeId: episodeId, title: 'Worker clip', startTime: 0.5, endTime: 2, isDemo: true } });

    await process({ type: 'render-clip', clipId: clip.id });

    const rendered = await prisma.clip.findUniqueOrThrow({ where: { id: clip.id } });
    expect(rendered.renderStatus).toBe('ready');
    expect(rendered.renditions).toMatchObject({
      horizontal: `renditions/clips/${clip.id}/horizontal.mp4`,
      vertical: `renditions/clips/${clip.id}/vertical.mp4`,
      square: `renditions/clips/${clip.id}/square.mp4`,
      audio: `renditions/clips/${clip.id}/audio.mp3`,
      thumbnail: `renditions/clips/${clip.id}/thumbnail.jpg`,
    });
    const probe = await runTool(tools.ffprobe, ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', path.join(storage.root, 'renditions', 'clips', clip.id, 'vertical.mp4')]);
    expect(probe.trim()).toBe('1080,1920');
  });

  it('produces audio-only renditions for audio uploads', async () => {
    const process = createProcessor({ prisma, storage, tools, logger, workRoot: root });
    const asset = await createAsset('audio', 'audio/mpeg', sampleAudio);
    await process({ type: 'transcode', assetId: asset.id });
    const ready = await prisma.mediaAsset.findUniqueOrThrow({ where: { id: asset.id } });
    expect(ready.status).toBe('ready');
    expect(ready.renditions).toMatchObject({ hls: null, poster: null, audio: `renditions/${asset.id}/audio.mp3`, variants: [] });
  });

  it('marks mismatched uploads as permanently failed without leaking paths', async () => {
    const process = createProcessor({ prisma, storage, tools, logger, workRoot: root });
    const asset = await createAsset('video', 'audio/mpeg', sampleAudio);
    await expect(process({ type: 'transcode', assetId: asset.id })).rejects.toBeInstanceOf(PermanentMediaError);
    const failed = await prisma.mediaAsset.findUniqueOrThrow({ where: { id: asset.id } });
    expect(failed).toMatchObject({ status: 'failed', error: 'Declared as video but no video stream was found' });
  });

  it('refuses to render clips when the source has no ready media', async () => {
    const process = createProcessor({ prisma, storage, tools, logger, workRoot: root });
    const bare = await prisma.episode.create({ data: { showId, slug: 'no-media', title: 'No media', isDemo: true } });
    const clip = await prisma.clip.create({ data: { sourceEpisodeId: bare.id, title: 'Orphan', startTime: 0, endTime: 1, isDemo: true } });
    await expect(process({ type: 'render-clip', clipId: clip.id })).rejects.toBeInstanceOf(PermanentMediaError);
    expect(await prisma.clip.findUniqueOrThrow({ where: { id: clip.id } })).toMatchObject({ renderStatus: 'failed' });
  });

  it('redacts file paths from tool errors', () => {
    const msg = publicErrorMessage(new ToolError('ffmpeg exited with 1', 'C:\\Users\\x\\source.mp4: Invalid data found\n/tmp/work/source.mp4: bad'));
    expect(msg).not.toContain('/tmp/work');
    expect(msg).toContain('ffmpeg exited with 1');
  });

  describe('podcast sync', () => {
    const fakeHost = (impl: (input: PublishEpisodeInput) => Promise<{ episodeId: number }>) => {
      const calls: PublishEpisodeInput[] = [];
      const host = {
        publishEpisode: (input: PublishEpisodeInput) => {
          calls.push(input);
          return impl(input);
        },
      } as unknown as PodcastHostAdapter;
      return { host, calls };
    };

    it('uploads the processed MP3 to Castopod once and records the remote id', async () => {
      await prisma.show.update({ where: { id: showId }, data: { status: 'published', castopodPodcastId: 12, podcastExplicit: true } });
      await prisma.episode.update({ where: { id: episodeId }, data: { status: 'published', publishedAt: new Date(), number: 4, summary: 'Summary' } });
      const { host, calls } = fakeHost((input) => {
        expect(input.audio.size).toBeGreaterThan(1000);
        return Promise.resolve({ episodeId: 88 });
      });
      const process = createProcessor({ prisma, storage, tools, logger, workRoot: root, podcastHost: host });

      await process({ type: 'podcast-sync', episodeId });
      expect(calls).toHaveLength(1);
      expect(calls[0]).toMatchObject({ podcastId: 12, title: 'Worker Episode', slug: 'worker-episode', episodeNumber: 4, explicit: true, type: 'full', audioFilename: 'worker-episode.mp3' });
      expect(calls[0]!.description).toContain('Not financial or investment advice');
      expect(await prisma.episode.findUniqueOrThrow({ where: { id: episodeId } })).toMatchObject({ castopodEpisodeId: 88, podcastSyncStatus: 'synced', podcastSyncError: null });

      // Running again never creates a duplicate in Castopod.
      await process({ type: 'podcast-sync', episodeId });
      expect(calls).toHaveLength(1);
    });

    it('fails clearly without configuration and treats Castopod 4xx as permanent', async () => {
      await prisma.episode.update({ where: { id: episodeId }, data: { castopodEpisodeId: null, podcastSyncStatus: null } });
      const unconfigured = createProcessor({ prisma, storage, tools, logger, workRoot: root, podcastHost: null });
      await expect(unconfigured({ type: 'podcast-sync', episodeId })).rejects.toBeInstanceOf(PermanentMediaError);
      expect((await prisma.episode.findUniqueOrThrow({ where: { id: episodeId } })).podcastSyncError).toMatch(/not configured/);

      const { host } = fakeHost(() => Promise.reject(new CastopodError('Castopod POST /episodes failed with 400: The slug field must be unique.', 400)));
      const rejecting = createProcessor({ prisma, storage, tools, logger, workRoot: root, podcastHost: host });
      await expect(rejecting({ type: 'podcast-sync', episodeId })).rejects.toBeInstanceOf(PermanentMediaError);
      expect(await prisma.episode.findUniqueOrThrow({ where: { id: episodeId } })).toMatchObject({
        podcastSyncStatus: 'failed',
        podcastSyncError: expect.stringContaining('slug field must be unique'),
      });

      const { host: flaky } = fakeHost(() => Promise.reject(new CastopodError('Could not reach Castopod: timeout', 0)));
      const retryable = createProcessor({ prisma, storage, tools, logger, workRoot: root, podcastHost: flaky });
      const err = await retryable({ type: 'podcast-sync', episodeId }).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(CastopodError);
      expect(err).not.toBeInstanceOf(PermanentMediaError);
    });
  });
});
