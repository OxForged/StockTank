import { openAsBlob } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { Logger } from 'pino';
import { AIProviderError, type AiProviders, type TranscriptSegment } from '@stocktank/ai';
import { AiBudgetExceededError, generateDraft, FACTORY_PROMPT_VERSION, type AiMeter, type FactoryInput } from '@stocktank/ai-runtime';
import type { Prisma, PrismaClient } from '@stocktank/database';
import { assetRenditionsSchema, type ObjectStorage } from '@stocktank/media';
import { AI_DRAFT_KINDS, type AiDraftKind } from '@stocktank/types';
import { PermanentMediaError } from './processor.js';

export interface AiJobDeps {
  prisma: PrismaClient;
  storage: ObjectStorage;
  logger: Logger;
  providers: AiProviders;
  meter: AiMeter;
  workRoot?: string;
}

/** Marks an ai_jobs row running/succeeded/failed around a unit of work. */
async function tracked(prisma: PrismaClient, jobId: string, fn: () => Promise<void>): Promise<void> {
  await prisma.aiJob.update({ where: { id: jobId }, data: { status: 'running', startedAt: new Date(), error: null } });
  try {
    await fn();
    await prisma.aiJob.update({ where: { id: jobId }, data: { status: 'succeeded', finishedAt: new Date() } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'AI job failed';
    await prisma.aiJob.update({ where: { id: jobId }, data: { status: 'failed', finishedAt: new Date(), error: message.slice(0, 500) } });
    throw err;
  }
}

/** Budget exhaustion and provider rejections will not succeed on retry; only network/rate limits are retryable. */
function classify(err: unknown): never {
  if (err instanceof AiBudgetExceededError) throw new PermanentMediaError(err.message);
  if (err instanceof AIProviderError && !err.retryable) throw new PermanentMediaError(err.message);
  throw err;
}

export function createAiJobs({ prisma, storage, logger, providers, meter, workRoot }: AiJobDeps) {
  async function transcribe(jobId: string, episodeId: string): Promise<void> {
    await tracked(prisma, jobId, async () => {
      const transcription = providers.transcription;
      if (!transcription) throw new PermanentMediaError('No transcription provider is configured (set OPENAI_API_KEY)');
      const episode = await prisma.episode.findUnique({ where: { id: episodeId }, include: { mediaAsset: true } });
      if (!episode) throw new PermanentMediaError('Episode not found');
      const parsed = episode.mediaAsset?.status === 'ready' ? assetRenditionsSchema.safeParse(episode.mediaAsset.renditions) : null;
      const audioKey = parsed?.success ? parsed.data.audio : null;
      if (!audioKey) throw new PermanentMediaError('The episode has no processed audio to transcribe');

      await prisma.transcript.upsert({ where: { episodeId }, update: { status: 'processing', error: null }, create: { episodeId, status: 'processing' } });
      const dir = await mkdtemp(path.join(workRoot ?? os.tmpdir(), 'stocktank-transcribe-'));
      try {
        const file = path.join(dir, 'audio.mp3');
        await storage.download(audioKey, file);
        const audio = await openAsBlob(file, { type: 'audio/mpeg' });
        const durationSeconds = episode.mediaAsset?.durationSeconds ?? null;
        const result = await meter
          .run(
            { feature: 'transcription' },
            async () => {
              const out = await transcription.transcribe(audio, `${episode.slug}.mp3`, { diarize: transcription.supportsDiarization });
              return { result: out, provider: transcription.name, model: out.model, audioSeconds: out.durationSeconds ?? durationSeconds ?? undefined };
            },
            { provider: transcription.name, model: transcription.model },
          )
          .catch(classify);
        await prisma.transcript.update({
          where: { episodeId },
          data: {
            status: 'ready',
            provider: transcription.name,
            model: result.model,
            language: result.language,
            text: result.text,
            segments: result.segments as unknown as Prisma.InputJsonArray,
            speakers: result.speakers,
            confidence: result.confidence,
            durationSeconds: result.durationSeconds ?? durationSeconds,
            error: null,
          },
        });
        logger.info({ episodeId, segments: result.segments.length, language: result.language }, 'Transcript ready');
      } catch (err) {
        await prisma.transcript.update({ where: { episodeId }, data: { status: 'failed', error: (err instanceof Error ? err.message : 'Transcription failed').slice(0, 500) } }).catch(() => undefined);
        throw err;
      } finally {
        await rm(dir, { recursive: true, force: true }).catch(() => undefined);
      }
    });
  }

  async function contentFactory(jobId: string, episodeId: string, kinds: AiDraftKind[]): Promise<void> {
    await tracked(prisma, jobId, async () => {
      const llm = providers.llm;
      if (!llm) throw new PermanentMediaError('No text generation provider is configured (set ANTHROPIC_API_KEY or OPENAI_API_KEY)');
      const episode = await prisma.episode.findUnique({
        where: { id: episodeId },
        include: {
          show: { select: { title: true } },
          transcript: true,
          hosts: { select: { host: { select: { name: true } } } },
          guests: { select: { guest: { select: { name: true } } } },
        },
      });
      if (!episode) throw new PermanentMediaError('Episode not found');
      if (episode.transcript?.status !== 'ready' || !episode.transcript.text) throw new PermanentMediaError('Transcribe the episode before running the content factory');
      const [companies, projects] = await Promise.all([
        prisma.company.findMany({ where: { status: 'published' }, select: { id: true, name: true }, take: 2000 }),
        prisma.project.findMany({ where: { status: 'published' }, select: { id: true, name: true, symbol: true }, take: 2000 }),
      ]);
      const input: FactoryInput = {
        episode: {
          title: episode.title,
          showTitle: episode.show.title,
          number: episode.number,
          hosts: episode.hosts.map((h) => h.host.name),
          guests: episode.guests.map((g) => g.guest.name),
          companies,
          projects,
        },
        transcript: { text: episode.transcript.text, segments: (episode.transcript.segments ?? []) as unknown as TranscriptSegment[], durationSeconds: episode.transcript.durationSeconds },
      };

      const wanted = kinds.length ? kinds : [...AI_DRAFT_KINDS];
      const failures: string[] = [];
      for (const kind of wanted) {
        try {
          const draft = await meter
            .run({ feature: 'content_factory' }, async () => {
              const d = await generateDraft(kind, llm, input);
              return { result: d, provider: d.provider, model: d.model, usage: d.usage };
            }, { provider: llm.name, model: llm.defaultModel })
            .catch(classify);
          // A fresh draft replaces any unreviewed one of the same kind; reviewed drafts are kept as history.
          await prisma.$transaction([
            prisma.aiDraft.deleteMany({ where: { episodeId, kind, status: { in: ['draft', 'review'] } } }),
            prisma.aiDraft.create({
              data: {
                episodeId,
                kind,
                status: 'review',
                content: draft.content as unknown as Prisma.InputJsonObject,
                provider: draft.provider,
                model: draft.model,
                promptVersion: FACTORY_PROMPT_VERSION,
                citations: { items: draft.citations, notes: draft.notes } as unknown as Prisma.InputJsonObject,
                moderationFlags: draft.moderationFlags,
              },
            }),
          ]);
          logger.info({ episodeId, kind, flags: draft.moderationFlags }, 'Draft ready for review');
        } catch (err) {
          if (err instanceof PermanentMediaError) throw err;
          failures.push(`${kind}: ${err instanceof Error ? err.message : 'failed'}`);
          logger.warn({ err, episodeId, kind }, 'Draft generation failed');
        }
      }
      if (failures.length === wanted.length) throw new Error(`All drafts failed. ${failures.join('; ')}`);
      if (failures.length) throw new Error(`${failures.length} of ${wanted.length} drafts failed: ${failures.join('; ')}`);
    });
  }

  return { transcribe, contentFactory };
}
