import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AzuraCastError, type AzuraStation, type NowPlaying, type RadioProvider } from '@stocktank/radio';
import { adminRadioStationDetailSchema, adminRadioStationSchema, radioStationListSchema, radioStationSchema } from '@stocktank/types';
import { createLogger } from '../src/lib/logger.js';
import { NowPlayingService } from '../src/lib/radio.js';
import { CSRF_HEADERS, createTestContext, loginAs, resetContent, resetDb, seedUser, type TestContext } from './helpers.js';

const nowPlaying = (over: Partial<NowPlaying> = {}): NowPlaying => ({
  stationId: 1,
  shortcode: 'stocktank_radio',
  isOnline: true,
  listeners: 12,
  live: { isLive: false, streamerName: null, startedAt: null },
  current: { title: 'Opening bell', artist: 'Desk', album: null, artUrl: null, playlist: 'Market open', playedAt: '2026-09-17T13:30:00.000Z', durationSeconds: 180, elapsedSeconds: 10, remainingSeconds: 170 },
  next: null,
  recent: [],
  stream: { hlsUrl: null, mounts: [{ name: '128kbps', url: 'https://radio.test/listen/stocktank_radio/radio.mp3', bitrate: 128, format: 'mp3', isDefault: true }] },
  fetchedAt: '2026-09-17T13:30:10.000Z',
  ...over,
});

const azuraStation = { id: 1, name: 'StockTank Radio', shortcode: 'stocktank_radio', description: null, listen_url: null, is_public: true, hls_enabled: false, hls_url: null, mounts: [] } as AzuraStation;

describe('NowPlayingService cache', () => {
  const logger = createLogger({ level: 'silent' });

  it('serves fresh data from cache, dedupes concurrent fetches, and serves stale data during outages', async () => {
    let clock = 0;
    let calls = 0;
    let fail = false;
    const provider = {
      getNowPlaying: async () => {
        calls++;
        await new Promise((r) => setTimeout(r, 5));
        if (fail) throw new AzuraCastError('Could not reach AzuraCast: timeout', 0);
        return nowPlaying({ listeners: calls });
      },
    } as unknown as RadioProvider;
    const service = new NowPlayingService(provider, null, logger, () => clock);

    const [a, b] = await Promise.all([service.get('stocktank_radio'), service.get('stocktank_radio')]);
    expect(calls).toBe(1);
    expect(a.nowPlaying?.listeners).toBe(1);
    expect(b.nowPlaying?.listeners).toBe(1);

    clock = 5_000;
    expect((await service.get('stocktank_radio')).nowPlaying?.listeners).toBe(1);
    expect(calls).toBe(1);

    clock = 11_000;
    fail = true;
    const stale = await service.get('stocktank_radio');
    expect(stale).toMatchObject({ stale: true, error: expect.stringContaining('timeout') });
    expect(stale.nowPlaying?.listeners).toBe(1);

    clock = 400_000;
    expect(await service.get('stocktank_radio')).toMatchObject({ nowPlaying: null, stale: false });
  });

  it('reports unconfigured AzuraCast without throwing', async () => {
    const service = new NowPlayingService(null, null, logger);
    expect(await service.get('x')).toEqual({ nowPlaying: null, stale: false, error: 'AzuraCast is not configured' });
  });
});

describe('live radio API', () => {
  let ctx: TestContext;
  let editor: string;
  let creator: string;
  let providerDown = false;

  const provider = {
    getStations: () => (providerDown ? Promise.reject(new AzuraCastError('Could not reach AzuraCast: timeout', 0)) : Promise.resolve([azuraStation])),
    getNowPlaying: (shortcode: string) =>
      providerDown ? Promise.reject(new AzuraCastError('Could not reach AzuraCast: timeout', 0)) : Promise.resolve(nowPlaying({ shortcode })),
    getStationStatus: () => Promise.reject(new AzuraCastError('AZURACAST_API_KEY is required for station management data', 0)),
    getPlaylist: () => Promise.resolve([]),
    getListeners: () => Promise.resolve(12),
    getRecentTracks: () => Promise.resolve([]),
  } as unknown as RadioProvider;

  const as = (cookie: string) => ({
    get: (url: string) => request(ctx.app).get(url).set('Cookie', cookie),
    post: (url: string, body: object) => request(ctx.app).post(url).set('Cookie', cookie).set(CSRF_HEADERS).send(body),
    put: (url: string, body: object) => request(ctx.app).put(url).set('Cookie', cookie).set(CSRF_HEADERS).send(body),
  });
  const R = '/api/v1/admin/radio';

  beforeAll(async () => {
    ctx = await createTestContext({ redis: false, radio: provider });
  });
  beforeEach(async () => {
    providerDown = false;
    await resetContent(ctx.prisma);
    await resetDb(ctx.prisma);
    await seedUser(ctx.prisma, { email: 'editor@example.com', roles: ['editor'] });
    await seedUser(ctx.prisma, { email: 'creator@example.com', roles: ['creator'] });
    editor = await loginAs(ctx.app, 'editor@example.com');
    creator = await loginAs(ctx.app, 'creator@example.com');
  });
  afterAll(async () => {
    await resetContent(ctx.prisma);
    await resetDb(ctx.prisma);
    await ctx.close();
  });

  it('lets editors add a station linked to AzuraCast and lists it publicly once published', async () => {
    expect((await as(creator).get(`${R}/stations`)).status).toBe(403);
    expect((await as(editor).post(`${R}/stations`, { name: 'Wrong', azuracastShortcode: 'nope' })).status).toBe(400);

    const created = await as(editor).post(`${R}/stations`, { name: 'StockTank Radio', azuracastShortcode: 'stocktank_radio', description: 'Markets, all day.' });
    expect(created.status).toBe(201);
    const station = adminRadioStationSchema.parse(created.body);
    expect(station).toMatchObject({ slug: 'stocktank-radio', status: 'draft', nowPlaying: { listeners: 12 }, error: null });
    expect((await as(editor).post(`${R}/stations`, { name: 'Dup', azuracastShortcode: 'stocktank_radio' })).status).toBe(409);

    expect(radioStationListSchema.parse((await request(ctx.app).get('/api/v1/live/radio')).body).items).toHaveLength(0);
    await as(editor).put(`${R}/stations/${station.id}`, { name: 'StockTank Radio', azuracastShortcode: 'stocktank_radio', description: 'Markets, all day.', status: 'published' });

    const list = radioStationListSchema.parse((await request(ctx.app).get('/api/v1/live/radio')).body);
    expect(list.items).toHaveLength(1);
    expect(list.items[0]).toMatchObject({ slug: 'stocktank-radio', stale: false, nowPlaying: { current: { title: 'Opening bell' } } });
    const raw = JSON.stringify(list);
    expect(raw).not.toContain('stocktank_radio"'); // shortcode and AzuraCast ids stay internal
    expect(raw).not.toContain('stationId');

    const one = radioStationSchema.parse((await request(ctx.app).get('/api/v1/live/radio/stocktank-radio')).body);
    expect(one.nowPlaying?.stream.mounts[0]?.url).toBe('https://radio.test/listen/stocktank_radio/radio.mp3');
    expect((await request(ctx.app).get('/api/v1/live/radio/missing')).status).toBe(404);

    const audit = await ctx.prisma.auditLog.findMany({ where: { targetId: station.id } });
    expect(audit.map((a) => a.action).sort()).toEqual(['content.radio.create', 'content.radio.update']);
  });

  it('keeps the site working when AzuraCast is down and explains management errors to staff', async () => {
    const row = await ctx.prisma.radioStation.create({ data: { slug: 'backup', name: 'Backup', azuracastShortcode: 'backup_station', status: 'published' } });
    providerDown = true;
    const list = radioStationListSchema.parse((await request(ctx.app).get('/api/v1/live/radio')).body);
    expect(list.items[0]).toMatchObject({ slug: 'backup', nowPlaying: null, stale: false });

    // Saving still works while AzuraCast is unreachable (setup can happen before the radio server is up).
    expect((await as(editor).put(`${R}/stations/${row.id}`, { name: 'Backup', azuracastShortcode: 'backup_station', status: 'published' })).status).toBe(200);

    providerDown = false;
    const detail = adminRadioStationDetailSchema.parse((await as(editor).get(`${R}/stations/${row.id}`)).body);
    expect(detail.managementError).toMatch(/no station with shortcode "backup_station"/);

    await ctx.prisma.radioStation.update({ where: { id: row.id }, data: { azuracastShortcode: 'stocktank_radio' } });
    const keyless = adminRadioStationDetailSchema.parse((await as(editor).get(`${R}/stations/${row.id}`)).body);
    expect(keyless.managementError).toMatch(/AZURACAST_API_KEY/);
    expect(keyless.status).toBeNull();
  });

  it('reports configuration to staff', async () => {
    const status = await as(editor).get(`${R}/status`);
    expect(status.body).toEqual({ azuracastConfigured: true, apiKeyConfigured: expect.any(Boolean) });
    const bare = await createTestContext({ redis: false, radio: null });
    try {
      await seedUser(bare.prisma, { email: 'editor3@example.com', roles: ['editor'] });
      const cookie = await loginAs(bare.app, 'editor3@example.com');
      expect((await request(bare.app).get(`${R}/status`).set('Cookie', cookie)).body).toEqual({ azuracastConfigured: false, apiKeyConfigured: false });
      expect((await request(bare.app).get(`${R}/azuracast/stations`).set('Cookie', cookie)).status).toBe(503);
    } finally {
      await bare.close();
    }
  });
});
