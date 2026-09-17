import { Router, type Request } from 'express';
import { z } from 'zod';
import { Prisma, type PrismaClient, type RadioStation as RadioStationRow } from '@stocktank/database';
import { AzuraCastError, type NowPlaying, type RadioProvider } from '@stocktank/radio';
import {
  PUBLISH_ONLY_STATUSES,
  radioStationInputSchema,
  type AdminRadioStation,
  type AdminRadioStationDetail,
  type AzuracastStationOption,
  type RadioNowPlaying,
  type RadioStation,
  type RadioStatusResponse,
} from '@stocktank/types';
import { writeAudit } from '../lib/audit.js';
import { PUBLISHED } from '../lib/content.js';
import { AppError, errors } from '../lib/errors.js';
import type { NowPlayingService } from '../lib/radio.js';
import { validate } from '../lib/validate.js';
import { getAuth, requirePermission } from '../middleware/auth.js';
import { slugify } from './admin-content.js';

export interface RadioDeps {
  prisma: PrismaClient;
  nowPlaying: NowPlayingService;
}

export interface AdminRadioDeps extends RadioDeps {
  provider: RadioProvider | null;
  apiKeyConfigured: boolean;
}

/** Strips AzuraCast identifiers; they stay server-side. */
function toPublicNowPlaying(np: NowPlaying | null): RadioNowPlaying | null {
  if (!np) return null;
  return { isOnline: np.isOnline, listeners: np.listeners, live: np.live, current: np.current, next: np.next, recent: np.recent, stream: np.stream, fetchedAt: np.fetchedAt };
}

/** Public live radio (§12): StockTank's own station list and now playing. */
export function radioRouter({ prisma, nowPlaying }: RadioDeps): Router {
  const router = Router();

  const toStation = async (s: RadioStationRow): Promise<RadioStation> => {
    const result = await nowPlaying.get(s.azuracastShortcode);
    return { id: s.id, slug: s.slug, name: s.name, description: s.description, isDemo: s.isDemo, nowPlaying: toPublicNowPlaying(result.nowPlaying), stale: result.stale };
  };

  router.get('/live/radio', async (_req, res) => {
    const stations = await prisma.radioStation.findMany({ where: { status: PUBLISHED }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] });
    res.set('Cache-Control', 'public, max-age=5');
    res.json({ items: await Promise.all(stations.map(toStation)) });
  });

  router.get('/live/radio/:slug', async (req, res) => {
    const { slug } = validate(z.object({ slug: z.string().min(1).max(100) }), req.params, 'params');
    const station = await prisma.radioStation.findFirst({ where: { slug, status: PUBLISHED } });
    if (!station) throw errors.notFound('Station not found');
    res.set('Cache-Control', 'public, max-age=5');
    res.json(await toStation(station));
  });

  return router;
}

const idParams = z.object({ id: z.string().min(1).max(64) });
const unavailable = () => new AppError('INTERNAL', 'AzuraCast is not configured on this server', undefined, 503);
const upstream = (err: AzuraCastError) => new AppError('INTERNAL', err.message, undefined, 502);

/** Admin: stations, AzuraCast linking and station health. The Live section requires `content.publish`. */
export function adminRadioRouter({ prisma, nowPlaying, provider, apiKeyConfigured }: AdminRadioDeps): Router {
  const router = Router();
  const live = requirePermission('content.publish');

  const audit = (req: Request, action: string, targetId: string, metadata?: Prisma.InputJsonObject) =>
    writeAudit(prisma, req, {
      action: `content.radio.${action}` as const,
      actorId: getAuth(req).user.id,
      targetType: 'radio_station',
      targetId,
      ...(metadata ? { metadata } : {}),
    });

  const toAdmin = async (s: RadioStationRow): Promise<AdminRadioStation> => {
    const result = await nowPlaying.get(s.azuracastShortcode);
    return {
      id: s.id,
      slug: s.slug,
      name: s.name,
      description: s.description,
      azuracastShortcode: s.azuracastShortcode,
      status: s.status,
      sortOrder: s.sortOrder,
      isDemo: s.isDemo,
      updatedAt: s.updatedAt.toISOString(),
      nowPlaying: toPublicNowPlaying(result.nowPlaying),
      error: result.error,
    };
  };

  router.get('/status', live, (_req, res) => {
    const response: RadioStatusResponse = { azuracastConfigured: provider !== null, apiKeyConfigured: provider !== null && apiKeyConfigured };
    res.json(response);
  });

  router.get('/stations', live, async (_req, res) => {
    const rows = await prisma.radioStation.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] });
    res.json({ items: await Promise.all(rows.map(toAdmin)) });
  });

  router.get('/azuracast/stations', live, async (_req, res) => {
    if (!provider) throw unavailable();
    try {
      const items: AzuracastStationOption[] = (await provider.getStations()).map((s) => ({ id: s.id, name: s.name, shortcode: s.shortcode, isPublic: s.is_public }));
      res.json({ items });
    } catch (err) {
      if (err instanceof AzuraCastError) throw upstream(err);
      throw err;
    }
  });

  const save = async (req: Request, id: string | null) => {
    const body = validate(radioStationInputSchema, req.body, 'body');
    if (PUBLISH_ONLY_STATUSES.has(body.status) && !getAuth(req).permissions.includes('content.publish')) {
      throw errors.forbidden(`Setting status "${body.status}" requires the content.publish permission`);
    }
    // When AzuraCast is reachable, refuse shortcodes it does not know; otherwise allow saving so setup can start first.
    if (provider) {
      const known = await provider.getStations().catch((err: unknown) => {
        if (err instanceof AzuraCastError) return null;
        throw err;
      });
      if (known && !known.some((s) => s.shortcode === body.azuracastShortcode)) {
        throw errors.badRequest(`AzuraCast has no station with shortcode "${body.azuracastShortcode}"`);
      }
    }
    const data = {
      name: body.name,
      slug: body.slug ?? slugify(body.name),
      description: body.description ?? null,
      azuracastShortcode: body.azuracastShortcode,
      status: body.status,
      sortOrder: body.sortOrder,
    };
    try {
      if (id) {
        if (!(await prisma.radioStation.findUnique({ where: { id }, select: { id: true } }))) throw errors.notFound('Station not found');
        return await prisma.radioStation.update({ where: { id }, data });
      }
      return await prisma.radioStation.create({ data });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw errors.conflict('A station with this slug or AzuraCast shortcode already exists');
      }
      throw err;
    }
  };

  router.post('/stations', live, async (req, res) => {
    const row = await save(req, null);
    await audit(req, 'create', row.id, { shortcode: row.azuracastShortcode, status: row.status });
    res.status(201).json(await toAdmin(row));
  });

  router.put('/stations/:id', live, async (req, res) => {
    const { id } = validate(idParams, req.params, 'params');
    const row = await save(req, id);
    await audit(req, 'update', row.id, { shortcode: row.azuracastShortcode, status: row.status });
    res.json(await toAdmin(row));
  });

  router.get('/stations/:id', live, async (req, res) => {
    const { id } = validate(idParams, req.params, 'params');
    const row = await prisma.radioStation.findUnique({ where: { id } });
    if (!row) throw errors.notFound('Station not found');
    const station = await toAdmin(row);
    let status: AdminRadioStationDetail['status'] = null;
    let playlists: AdminRadioStationDetail['playlists'] = [];
    let managementError: string | null = null;
    if (!provider) {
      managementError = 'AzuraCast is not configured';
    } else {
      try {
        const azura = (await provider.getStations()).find((s) => s.shortcode === row.azuracastShortcode);
        if (!azura) {
          managementError = `AzuraCast has no station with shortcode "${row.azuracastShortcode}"`;
        } else {
          [status, playlists] = await Promise.all([provider.getStationStatus(azura.id), provider.getPlaylist(azura.id)]);
        }
      } catch (err) {
        if (!(err instanceof AzuraCastError)) throw err;
        managementError = err.message;
      }
    }
    const response: AdminRadioStationDetail = { station, status, playlists, managementError };
    res.json(response);
  });

  return router;
}
