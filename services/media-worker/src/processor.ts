import { openAsBlob } from 'node:fs';
import { mkdir, mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { Logger } from 'pino';
import type { Prisma, PrismaClient } from '@stocktank/database';
import {
  assetRenditionsSchema,
  clipAudioArgs,
  clipVideoArgs,
  evenWidthFor,
  hlsAudioArgs,
  hlsVideoArgs,
  keys,
  masterPlaylist,
  mp3Args,
  parseProbe,
  posterArgs,
  probeArgs,
  progressFromStderr,
  selectLadder,
  validateProbe,
  type AssetRenditions,
  type ClipRenditions,
  type MediaJob,
  type ObjectStorage,
} from '@stocktank/media';
import { CastopodError, FINANCIAL_DISCLAIMER, type PodcastHostAdapter } from '@stocktank/podcast';
import { runTool, ToolError, type Tools } from './ffmpeg-runner.js';

export interface ProcessorDeps {
  prisma: PrismaClient;
  storage: ObjectStorage;
  tools: Tools;
  logger: Logger;
  /** Scratch directory root; defaults to the OS temp dir. */
  workRoot?: string;
  /** Per FFmpeg invocation; defaults to 6 hours. */
  toolTimeoutMs?: number;
  /** Castopod adapter; null when Castopod is not configured. */
  podcastHost?: PodcastHostAdapter | null;
}

/** A failure the uploader can fix (bad file); retrying the same input will not help. */
export class PermanentMediaError extends Error {
  override name = 'PermanentMediaError';
}

const EXTENSION_BY_MIME: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
};

/** Stored errors are shown to staff; keep them short and free of local file paths. */
export function publicErrorMessage(err: unknown): string {
  if (err instanceof PermanentMediaError || err instanceof CastopodError) return err.message.slice(0, 500);
  if (err instanceof ToolError) {
    const lastLine = err.stderrTail.trim().split(/\r?\n/).filter(Boolean).pop() ?? '';
    return `${err.message}: ${lastLine.replace(/[A-Za-z]:\\[^\s:]+|\/[^\s:]*\/[^\s:]+/g, '<file>')}`.slice(0, 500);
  }
  return 'Processing failed unexpectedly. Check the media worker logs.';
}

export function createProcessor(deps: ProcessorDeps) {
  const { prisma, storage, tools, logger } = deps;
  const timeoutMs = deps.toolTimeoutMs ?? 6 * 3600 * 1000;

  const withWorkDir = async <T>(fn: (dir: string) => Promise<T>): Promise<T> => {
    const dir = await mkdtemp(path.join(deps.workRoot ?? os.tmpdir(), 'stocktank-media-'));
    try {
      return await fn(dir);
    } finally {
      await rm(dir, { recursive: true, force: true }).catch((err: unknown) => logger.warn({ err, dir }, 'Could not remove work dir'));
    }
  };

  const probe = async (file: string) => parseProbe(await runTool(tools.ffprobe, probeArgs(file), { timeoutMs: 60_000 }));

  async function transcode(assetId: string): Promise<void> {
    const asset = await prisma.mediaAsset.findUnique({ where: { id: assetId } });
    if (!asset) {
      logger.warn({ assetId }, 'Transcode requested for a missing asset; skipping');
      return;
    }
    if (asset.status === 'ready') return;

    await prisma.mediaAsset.update({
      where: { id: assetId },
      data: { status: 'processing', progress: 0, error: null, processingStartedAt: new Date() },
    });

    try {
      await withWorkDir(async (dir) => {
        const ext = EXTENSION_BY_MIME[asset.mimeType] ?? 'bin';
        const source = path.join(dir, `source.${ext}`);
        await storage.download(asset.originalKey, source);

        const info = await probe(source);
        const invalid = validateProbe(info, asset.kind);
        if (invalid) throw new PermanentMediaError(invalid);

        const out = path.join(dir, 'out');
        const hlsDir = path.join(out, 'hls');
        await mkdir(hlsDir, { recursive: true });

        const ladder = asset.kind === 'video' ? selectLadder(info.height) : [];
        // Steps: each video rendition, the audio rendition, mp3, poster.
        const totalSteps = ladder.length + (info.hasAudio ? 2 : 0) + (ladder.length > 0 ? 1 : 0);
        let done = 0;
        let lastWritten = -1;
        const report = async (stepPercent: number) => {
          const overall = Math.min(99, Math.round(((done + stepPercent / 100) / Math.max(1, totalSteps)) * 100));
          if (overall >= lastWritten + 5) {
            lastWritten = overall;
            await prisma.mediaAsset.update({ where: { id: assetId }, data: { progress: overall } }).catch(() => undefined);
          }
        };
        const run = async (args: string[]) => {
          await runTool(tools.ffmpeg, args, {
            timeoutMs,
            onStderr: (chunk) => {
              const p = progressFromStderr(chunk, info.durationSeconds);
              if (p !== null) void report(p);
            },
          });
          done++;
          await report(0);
        };

        const variants: AssetRenditions['variants'] = [];
        for (const r of ladder) {
          await run(hlsVideoArgs(source, hlsDir, r, info.hasAudio));
          variants.push({ name: r.name, height: r.height, bandwidth: (r.videoBitrateK + r.audioBitrateK) * 1000 });
        }
        if (info.hasAudio) {
          await run(hlsAudioArgs(source, hlsDir));
          await run(mp3Args(source, path.join(out, 'audio.mp3')));
        }
        let poster: string | null = null;
        if (ladder.length > 0) {
          await run(posterArgs(source, path.join(out, 'poster.jpg'), Math.min(5, info.durationSeconds / 10)));
          poster = keys.poster(assetId);
        }
        let hls: string | null = null;
        if (ladder.length > 0) {
          const sourceWidth = info.width ?? Math.round(((info.height ?? 720) * 16) / 9);
          const sourceHeight = info.height ?? 720;
          await writeFile(
            path.join(hlsDir, 'master.m3u8'),
            masterPlaylist(
              ladder.map((r) => ({ name: r.name, height: r.height, width: evenWidthFor(r.height, sourceWidth, sourceHeight), bandwidth: (r.videoBitrateK + r.audioBitrateK) * 1000 })),
              info.hasAudio,
            ),
          );
          hls = keys.hlsMaster(assetId);
        }
        if (!info.hasAudio && ladder.length === 0) throw new PermanentMediaError('The file has no usable audio or video streams');

        const uploaded = await storage.uploadDirectory(keys.renditionPrefix(assetId), out);
        const audioBytes = info.hasAudio ? (await stat(path.join(out, 'audio.mp3'))).size : undefined;
        const renditions: AssetRenditions = { hls, audio: info.hasAudio ? keys.audio(assetId) : null, ...(audioBytes !== undefined ? { audioBytes } : {}), poster, variants };

        await prisma.$transaction(async (tx) => {
          await tx.mediaAsset.update({
            where: { id: assetId },
            data: {
              status: 'ready',
              progress: 100,
              readyAt: new Date(),
              durationSeconds: info.durationSeconds,
              width: info.width,
              height: info.height,
              renditions: renditions as unknown as Prisma.InputJsonObject,
            },
          });
          if (asset.targetEpisodeId) {
            // Swap playback to the new asset only now, so a replacement upload never interrupts the current media.
            await tx.episode.updateMany({ where: { id: asset.targetEpisodeId }, data: { mediaAssetId: assetId } });
          }
          // Fill the episode duration from the real media when staff left it blank.
          await tx.episode.updateMany({ where: { mediaAssetId: assetId, durationSeconds: null }, data: { durationSeconds: Math.round(info.durationSeconds) } });
        });
        logger.info({ assetId, uploaded, variants: variants.map((v) => v.name), seconds: info.durationSeconds }, 'Media asset ready');
      });
    } catch (err) {
      logger.error({ err, assetId }, 'Media asset processing failed');
      await prisma.mediaAsset.update({ where: { id: assetId }, data: { status: 'failed', error: publicErrorMessage(err) } });
      throw err;
    }
  }

  async function renderClip(clipId: string): Promise<void> {
    const clip = await prisma.clip.findUnique({
      where: { id: clipId },
      include: { sourceEpisode: { include: { mediaAsset: true } } },
    });
    if (!clip) {
      logger.warn({ clipId }, 'Render requested for a missing clip; skipping');
      return;
    }
    const asset = clip.sourceEpisode.mediaAsset;
    await prisma.clip.update({ where: { id: clipId }, data: { renderStatus: 'processing', renderError: null } });

    try {
      if (!asset || asset.status !== 'ready') throw new PermanentMediaError('The source episode has no processed media yet');
      if (asset.durationSeconds !== null && clip.startTime >= asset.durationSeconds) {
        throw new PermanentMediaError('The clip starts after the end of the source media');
      }
      const end = asset.durationSeconds !== null ? Math.min(clip.endTime, asset.durationSeconds) : clip.endTime;

      await withWorkDir(async (dir) => {
        const source = path.join(dir, `source.${EXTENSION_BY_MIME[asset.mimeType] ?? 'bin'}`);
        await storage.download(asset.originalKey, source);
        const info = await probe(source);
        const out = path.join(dir, 'out');
        await mkdir(out, { recursive: true });
        const prefix = keys.clipPrefix(clipId);
        const result: ClipRenditions = { horizontal: null, vertical: null, square: null, audio: null, thumbnail: null };

        if (info.hasVideo) {
          for (const shape of ['horizontal', 'vertical', 'square'] as const) {
            await runTool(tools.ffmpeg, clipVideoArgs(source, path.join(out, `${shape}.mp4`), clip.startTime, end, shape, info.hasAudio), { timeoutMs });
            result[shape] = `${prefix}/${shape}.mp4`;
          }
          await runTool(tools.ffmpeg, posterArgs(source, path.join(out, 'thumbnail.jpg'), clip.startTime + Math.min(1, (end - clip.startTime) / 2)), {
            timeoutMs,
          });
          result.thumbnail = `${prefix}/thumbnail.jpg`;
        }
        if (info.hasAudio) {
          await runTool(tools.ffmpeg, clipAudioArgs(source, path.join(out, 'audio.mp3'), clip.startTime, end), { timeoutMs });
          result.audio = `${prefix}/audio.mp3`;
        }
        await storage.uploadDirectory(prefix, out);
        await prisma.clip.update({
          where: { id: clipId },
          data: { renderStatus: 'ready', renderError: null, renditions: result as unknown as Prisma.InputJsonObject },
        });
        logger.info({ clipId }, 'Clip rendered');
      });
    } catch (err) {
      logger.error({ err, clipId }, 'Clip render failed');
      await prisma.clip.update({ where: { id: clipId }, data: { renderStatus: 'failed', renderError: publicErrorMessage(err) } });
      throw err;
    }
  }

  async function podcastSync(episodeId: string): Promise<void> {
    const episode = await prisma.episode.findUnique({
      where: { id: episodeId },
      include: { show: true, mediaAsset: true },
    });
    if (!episode) {
      logger.warn({ episodeId }, 'Podcast sync requested for a missing episode; skipping');
      return;
    }
    if (episode.castopodEpisodeId !== null) {
      // Castopod's REST API cannot update episodes, so a synced episode is never sent twice.
      await prisma.episode.update({ where: { id: episodeId }, data: { podcastSyncStatus: 'synced', podcastSyncError: null } });
      return;
    }
    await prisma.episode.update({ where: { id: episodeId }, data: { podcastSyncStatus: 'syncing', podcastSyncError: null } });

    try {
      const host = deps.podcastHost;
      if (!host) {
        throw new PermanentMediaError('Castopod is not configured on the media worker (CASTOPOD_URL, CASTOPOD_API_USERNAME, CASTOPOD_API_PASSWORD, CASTOPOD_USER_ID)');
      }
      if (episode.status !== 'published' || episode.show.status !== 'published') {
        throw new PermanentMediaError('Only published episodes of published shows can be sent to Castopod');
      }
      const podcastId = episode.show.castopodPodcastId;
      if (podcastId === null) throw new PermanentMediaError('Link the show to a Castopod podcast first');
      const parsed = episode.mediaAsset?.status === 'ready' ? assetRenditionsSchema.safeParse(episode.mediaAsset.renditions) : null;
      const audioKey = parsed?.success ? parsed.data.audio : null;
      if (!audioKey) throw new PermanentMediaError('The episode has no processed audio yet');

      const castopodEpisodeId = await withWorkDir(async (dir) => {
        const file = path.join(dir, 'audio.mp3');
        await storage.download(audioKey, file);
        const audio = await openAsBlob(file, { type: 'audio/mpeg' });
        const result = await host.publishEpisode({
          podcastId,
          title: episode.title,
          slug: episode.slug,
          description: [episode.summary, episode.description, FINANCIAL_DISCLAIMER].filter(Boolean).join('\n\n'),
          type: episode.episodeType,
          episodeNumber: episode.number,
          explicit: episode.show.podcastExplicit,
          audio,
          audioFilename: `${episode.slug}.mp3`,
        });
        return result.episodeId;
      });
      await prisma.episode.update({
        where: { id: episodeId },
        data: { castopodEpisodeId, podcastSyncStatus: 'synced', podcastSyncError: null, podcastSyncedAt: new Date() },
      });
      logger.info({ episodeId, castopodEpisodeId }, 'Episode published to Castopod');
    } catch (err) {
      logger.error({ err, episodeId }, 'Podcast sync failed');
      await prisma.episode.update({ where: { id: episodeId }, data: { podcastSyncStatus: 'failed', podcastSyncError: publicErrorMessage(err) } });
      // Castopod rejecting the request (4xx other than rate limiting) will not succeed on retry.
      if (err instanceof CastopodError && err.status >= 400 && err.status < 500 && err.status !== 429) throw new PermanentMediaError(err.message);
      throw err;
    }
  }

  return async function process(job: MediaJob): Promise<void> {
    switch (job.type) {
      case 'transcode':
        return transcode(job.assetId);
      case 'render-clip':
        return renderClip(job.clipId);
      case 'podcast-sync':
        return podcastSync(job.episodeId);
    }
  };
}
