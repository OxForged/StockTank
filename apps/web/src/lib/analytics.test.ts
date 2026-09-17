import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { mockApi } from '../test/mock-api';
import { createPlaybackTracker, flushAnalytics, resetAnalyticsForTests, sanitizePath, track, trackingAllowed } from './analytics';

vi.mock('@stocktank/api-client', async (importOriginal) => {
  const mod = await importOriginal<object>();
  const { mockApi } = await import('../test/mock-api');
  return { ...mod, createApiClient: () => mockApi };
});

const sentEvents = () => mockApi.analytics.send.mock.calls.flatMap(([batch]) => (batch as { events: Array<Record<string, unknown>> }).events);

describe('analytics client', () => {
  beforeEach(() => {
    resetAnalyticsForTests();
    mockApi.analytics.send.mockResolvedValue(undefined);
  });
  afterEach(() => {
    Object.defineProperty(navigator, 'globalPrivacyControl', { configurable: true, value: undefined });
    Object.defineProperty(navigator, 'doNotTrack', { configurable: true, value: null });
    sessionStorage.clear();
  });

  it('batches events with first-touch attribution', () => {
    sessionStorage.setItem('stocktank.attribution', JSON.stringify({ utm: { source: 'newsletter' }, referrer: 'https://news.example' }));
    track({ type: 'page_view', path: '/' });
    track({ type: 'search', query: 'rwa' });
    expect(mockApi.analytics.send).not.toHaveBeenCalled();
    flushAnalytics();
    expect(mockApi.analytics.send).toHaveBeenCalledTimes(1);
    const batch = mockApi.analytics.send.mock.calls[0]![0] as { events: unknown[]; utm: unknown; referrer: string };
    expect(batch.events).toHaveLength(2);
    expect(batch).toMatchObject({ utm: { source: 'newsletter' }, referrer: 'https://news.example' });
  });

  it('sends nothing when the browser asks not to be tracked', () => {
    Object.defineProperty(navigator, 'globalPrivacyControl', { configurable: true, value: true });
    expect(trackingAllowed()).toBe(false);
    track({ type: 'page_view', path: '/' });
    flushAnalytics();
    Object.defineProperty(navigator, 'globalPrivacyControl', { configurable: true, value: undefined });
    Object.defineProperty(navigator, 'doNotTrack', { configurable: true, value: '1' });
    track({ type: 'page_view', path: '/' });
    flushAnalytics();
    expect(mockApi.analytics.send).not.toHaveBeenCalled();
  });

  it('redacts token-like path segments', () => {
    expect(sanitizePath('/newsletter/confirm/Q2hhbmdlTWVQbGVhc2VUaGlzSXNBVG9rZW4')).toBe('/newsletter/confirm/:token');
    expect(sanitizePath('/shows/the-tank/treasuries-on-chain?x=1')).toBe('/shows/the-tank/treasuries-on-chain');
  });

  it('counts real playback time, ignores seeks, and completes once', () => {
    const t = createPlaybackTracker({ entityType: 'episode', entityId: 'e1', mediaKind: 'audio' });
    t.onPlay(0);
    t.onPlay(0);
    for (let s = 0.25; s <= 31; s += 0.25) t.onTimeUpdate(s); // ~31s of listening
    t.onTimeUpdate(600); // seek forward: not counted
    t.onTimeUpdate(600.5);
    t.onPause();
    t.onComplete();
    t.onComplete();
    flushAnalytics();
    const events = sentEvents();
    expect(events.filter((e) => e.type === 'play_start')).toHaveLength(1);
    expect(events.filter((e) => e.type === 'play_complete')).toHaveLength(1);
    const seconds = events.filter((e) => e.type === 'play_progress').reduce((sum, e) => sum + (e.seconds as number), 0);
    expect(seconds).toBe(31);
    expect(events.every((e) => e.entityId === 'e1' && e.mediaKind === 'audio')).toBe(true);
  });

  it('never marks live radio as completed', () => {
    const t = createPlaybackTracker({ entityType: 'radio', entityId: 'r1', mediaKind: 'radio' });
    t.onPlay(0);
    t.onComplete();
    flushAnalytics();
    expect(sentEvents().map((e) => e.type)).toEqual(['play_start']);
  });
});
