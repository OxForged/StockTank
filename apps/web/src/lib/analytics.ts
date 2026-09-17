import type { AnalyticsEntityType, ClientAnalyticsEvent } from '@stocktank/types';
import { useEffect } from 'react';
import { useLocation } from 'react-router';

import { api } from './api';
import { getAttribution } from './attribution';

/**
 * First-party analytics (§29). Events are anonymous, batched, and sent to StockTank's own API only.
 * Nothing is sent when the browser asks not to be tracked (Global Privacy Control or Do Not Track).
 */

const FLUSH_DELAY_MS = 4000;
const MAX_BATCH = 25;
/** Playback time is reported in slices of at most this many seconds. */
const PROGRESS_SLICE_SECONDS = 30;

let queue: ClientAnalyticsEvent[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let listening = false;
let lastPageViewKey: string | null = null;

/** Drops query strings and replaces token-like path segments so secrets never reach analytics. */
export function sanitizePath(pathname: string): string {
  return pathname
    .split('?')[0]!
    .split('/')
    .map((part) => (part.length >= 24 && /^[A-Za-z0-9_-]+$/.test(part) ? ':token' : part))
    .join('/')
    .slice(0, 300);
}

export function trackingAllowed(): boolean {
  if (typeof navigator === 'undefined') return false;
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  return !(nav.globalPrivacyControl === true || nav.doNotTrack === '1');
}

export function flushAnalytics(): void {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  while (queue.length > 0) {
    const events = queue.splice(0, MAX_BATCH);
    const attribution = getAttribution();
    api.analytics
      .send({
        events,
        ...(attribution.referrer ? { referrer: attribution.referrer } : {}),
        ...(attribution.utm ? { utm: attribution.utm } : {}),
      })
      .catch(() => undefined);
  }
}

function listenForUnload() {
  if (listening || typeof document === 'undefined') return;
  listening = true;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushAnalytics();
  });
  window.addEventListener('pagehide', flushAnalytics);
}

export function track(event: Omit<ClientAnalyticsEvent, 'occurredAt'>): void {
  if (!trackingAllowed()) return;
  listenForUnload();
  queue.push({ ...event, occurredAt: new Date().toISOString() });
  if (queue.length >= MAX_BATCH) flushAnalytics();
  else if (!timer) timer = setTimeout(flushAnalytics, FLUSH_DELAY_MS);
}

export interface TrackedEntity {
  entityType: AnalyticsEntityType;
  entityId: string;
}

/** One page view per navigation, sent once the page knows what it shows (so entity pages are attributed). */
export function usePageView(options: { loading?: boolean; entity?: TrackedEntity | null } = {}): void {
  const location = useLocation();
  const { loading = false, entity = null } = options;
  const entityType = entity?.entityType;
  const entityId = entity?.entityId;
  useEffect(() => {
    if (loading || lastPageViewKey === location.key) return;
    lastPageViewKey = location.key;
    track({ type: 'page_view', path: sanitizePath(location.pathname), ...(entityType && entityId ? { entityType, entityId } : {}) });
  }, [loading, location.key, location.pathname, entityType, entityId]);
}

/**
 * Turns media element events into play_start / play_progress / play_complete. Progress counts real playback time
 * (timeupdate deltas while playing), so seeking does not inflate listening time.
 */
export function createPlaybackTracker(entity: TrackedEntity & { mediaKind: 'audio' | 'video' | 'radio' }) {
  let started = false;
  let completed = false;
  let lastTime: number | null = null;
  let pending = 0;

  const report = () => {
    const seconds = Math.floor(pending);
    if (seconds >= 1) {
      track({ type: 'play_progress', ...entity, seconds: Math.min(seconds, 300) });
      pending -= seconds;
    }
  };

  return {
    onPlay(currentTime: number) {
      if (!started) {
        started = true;
        track({ type: 'play_start', ...entity });
      }
      lastTime = currentTime;
    },
    onTimeUpdate(currentTime: number) {
      if (lastTime !== null) {
        const delta = currentTime - lastTime;
        // Ignore seeks and stalls; a timeupdate normally fires every ~250ms.
        if (delta > 0 && delta < 5) pending += delta;
      }
      lastTime = currentTime;
      if (pending >= PROGRESS_SLICE_SECONDS) report();
    },
    onPause() {
      lastTime = null;
      report();
    },
    onComplete() {
      lastTime = null;
      report();
      if (!completed && entity.mediaKind !== 'radio') {
        completed = true;
        track({ type: 'play_complete', ...entity });
      }
    },
  };
}

/** Test hook. */
export function resetAnalyticsForTests(): void {
  queue = [];
  lastPageViewKey = null;
  if (timer) clearTimeout(timer);
  timer = null;
}
