'use client';

import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ApiError, fetchCategories, submitInterests } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useAuthDispatch } from '@/hooks/useAuthDispatch';
import type { CategoryGroup } from '@/types/onboarding';

/* ── Data mapping ── */

interface SubInterest { readonly id: string; readonly label: string; }
interface Category { readonly id: string; readonly label: string; readonly subs: ReadonlyArray<SubInterest>; }

function groupsToCategories(groups: readonly CategoryGroup[]): ReadonlyArray<Category> {
  return groups.map((g) => ({
    id: g.group.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    label: g.group,
    subs: g.categories.map((c) => ({ id: c, label: c })),
  }));
}

/* ── Layout ── */

interface BubblePos { readonly size: number; readonly left: number; readonly top: number; readonly cx: number; readonly cy: number; }

/** Bubble size just big enough to wrap the label text */
function labelBubbleSize(label: string): number {
  const len = label.length;
  if (len <= 3) return 72;
  if (len <= 5) return 82;
  if (len <= 7) return 95;
  if (len <= 9) return 108;
  return 125; // "Entertainment" etc.
}

/** Pack categories into organic layout using circle-packing with varied sizes */
function generateDefaultPositions(cats: ReadonlyArray<Category>): ReadonlyArray<BubblePos> {
  if (cats.length === 0) return [];
  const W = 384;
  const H = 448;
  const GAP = 8;
  const items = cats.map((c) => ({ id: c.id, size: labelBubbleSize(c.label) }));

  // Simple greedy circle-packing: place each circle tangent to existing ones, closest to center
  const placed: Array<{ x: number; y: number; r: number }> = [];
  const cx = W / 2, cy = H / 2 - 20;

  for (const item of items) {
    const r = item.size / 2;
    if (placed.length === 0) {
      placed.push({ x: cx, y: cy, r });
      continue;
    }
    let bestX = cx, bestY = cy, bestDist = Infinity;
    for (const c of placed) {
      const touchDist = c.r + r + GAP;
      for (let a = 0; a < 60; a++) {
        const angle = (a / 60) * Math.PI * 2 - Math.PI / 2;
        const tx = c.x + Math.cos(angle) * touchDist;
        const ty = c.y + Math.sin(angle) * touchDist;
        if (tx - r < 4 || tx + r > W - 4 || ty - r < 4 || ty + r > H - 4) continue;
        let free = true;
        for (const o of placed) {
          const dx = tx - o.x, dy = ty - o.y;
          if (Math.sqrt(dx * dx + dy * dy) < o.r + r + GAP) { free = false; break; }
        }
        if (!free) continue;
        const dist = Math.sqrt((tx - cx) ** 2 + (ty - cy) ** 2);
        if (dist < bestDist) { bestDist = dist; bestX = tx; bestY = ty; }
      }
    }
    placed.push({ x: bestX, y: bestY, r });
  }

  // Center the cluster
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of placed) {
    minX = Math.min(minX, p.x - p.r); maxX = Math.max(maxX, p.x + p.r);
    minY = Math.min(minY, p.y - p.r); maxY = Math.max(maxY, p.y + p.r);
  }
  const shiftX = cx - (minX + maxX) / 2;
  const shiftY = cy - (minY + maxY) / 2;
  for (const p of placed) { p.x += shiftX; p.y += shiftY; }

  return placed.map((p, i) => ({
    size: items[i].size,
    left: p.x - p.r,
    top: p.y - p.r,
    cx: p.x,
    cy: p.y,
  }));
}

const CANVAS_W = 384;
const CANVAS_H = 448;
const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';
const EASE_SPRING = 'cubic-bezier(0.175, 0.885, 0.32, 1.275)';
const PACK_GAP = 6;
const SUB_SIZE = 82;
const CAT_PACKED_SIZE = 116;

interface PackItem { id: string; size: number; }

const MARGIN = 6;

/** Clamp a single circle inside the canvas. */
function clampToCanvas(p: { x: number; y: number; r: number }) {
  p.x = Math.max(MARGIN + p.r, Math.min(CANVAS_W - MARGIN - p.r, p.x));
  p.y = Math.max(MARGIN + p.r, Math.min(CANVAS_H - MARGIN - p.r, p.y));
}

/**
 * Incremental mixed-size circle-packing.
 * Items with `pinned` positions stay put; new items find gaps around them.
 * Includes iterative collision resolution so bubbles never overlap.
 */
function packBubbles(
  items: PackItem[],
  pinned: Map<string, { cx: number; cy: number }>,
  cx: number,
  cy: number,
): Map<string, { left: number; top: number; size: number }> {
  const placed: Array<{ x: number; y: number; r: number; id: string; isPinned: boolean }> = [];
  const ANGLE_STEPS = 72;
  const hasPinned = pinned.size > 0;

  /* Phase 1: place pinned items at their previous positions */
  const newItems: PackItem[] = [];
  for (const item of items) {
    const prev = pinned.get(item.id);
    if (prev) {
      placed.push({ x: prev.cx, y: prev.cy, r: item.size / 2, id: item.id, isPinned: true });
    } else {
      newItems.push(item);
    }
  }

  /** Check if (tx, ty) with radius r is free of collisions with all placed items */
  function isFree(tx: number, ty: number, r: number): boolean {
    for (const other of placed) {
      const dx = tx - other.x, dy = ty - other.y;
      if (Math.sqrt(dx * dx + dy * dy) < other.r + r + PACK_GAP) return false;
    }
    return true;
  }

  /* Phase 2: pack new items into gaps */
  for (const item of newItems) {
    const r = item.size / 2;
    if (placed.length === 0) {
      placed.push({ x: cx, y: cy, r, id: item.id, isPinned: false });
      continue;
    }

    let bestX = cx, bestY = cy, bestDist = Infinity;

    /* Strategy A: tangent positions around existing circles */
    for (const c of placed) {
      const touchDist = c.r + r + PACK_GAP;
      for (let a = 0; a < ANGLE_STEPS; a++) {
        const angle = (a / ANGLE_STEPS) * Math.PI * 2 - Math.PI / 2;
        const tx = c.x + Math.cos(angle) * touchDist;
        const ty = c.y + Math.sin(angle) * touchDist;

        if (tx - r < MARGIN || tx + r > CANVAS_W - MARGIN ||
            ty - r < MARGIN || ty + r > CANVAS_H - MARGIN) continue;
        if (!isFree(tx, ty, r)) continue;

        const dist = Math.sqrt((tx - cx) ** 2 + (ty - cy) ** 2);
        if (dist < bestDist) { bestDist = dist; bestX = tx; bestY = ty; }
      }
    }

    /* Strategy B: grid search fallback if tangent search found nothing */
    if (bestDist === Infinity) {
      const step = r * 0.8;
      for (let gy = MARGIN + r; gy <= CANVAS_H - MARGIN - r; gy += step) {
        for (let gx = MARGIN + r; gx <= CANVAS_W - MARGIN - r; gx += step) {
          if (!isFree(gx, gy, r)) continue;
          const dist = Math.sqrt((gx - cx) ** 2 + (gy - cy) ** 2);
          if (dist < bestDist) { bestDist = dist; bestX = gx; bestY = gy; }
        }
      }
    }

    placed.push({ x: bestX, y: bestY, r, id: item.id, isPinned: false });
  }

  /* Phase 3: center the cluster only on first pack (no pinned items) */
  if (placed.length > 0 && !hasPinned) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of placed) {
      minX = Math.min(minX, p.x - p.r);
      maxX = Math.max(maxX, p.x + p.r);
      minY = Math.min(minY, p.y - p.r);
      maxY = Math.max(maxY, p.y + p.r);
    }
    const shiftX = cx - (minX + maxX) / 2;
    const shiftY = cy - (minY + maxY) / 2;
    for (const p of placed) { p.x += shiftX; p.y += shiftY; }
  }

  /* Phase 4: iterative collision resolution + per-item bounds clamping */
  for (let iter = 0; iter < 50; iter++) {
    let anyOverlap = false;
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        const a = placed[i], b = placed[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const minDist = a.r + b.r + PACK_GAP;
        if (dist < minDist) {
          anyOverlap = true;
          const overlap = (minDist - dist) * 0.6;
          const nx = dx / dist, ny = dy / dist;
          const aWeight = a.isPinned ? 0.2 : 1;
          const bWeight = b.isPinned ? 0.2 : 1;
          const total = aWeight + bWeight;
          a.x -= nx * overlap * (aWeight / total);
          a.y -= ny * overlap * (aWeight / total);
          b.x += nx * overlap * (bWeight / total);
          b.y += ny * overlap * (bWeight / total);
        }
      }
    }
    for (const p of placed) clampToCanvas(p);
    if (!anyOverlap) break;
  }

  const result = new Map<string, { left: number; top: number; size: number }>();
  for (const p of placed) {
    const item = items.find(it => it.id === p.id)!;
    result.set(p.id, { left: p.x - p.r, top: p.y - p.r, size: item.size });
  }
  return result;
}

/* ── Component ── */

const MAX_INTERESTS = 10;

export default function OnboardingPage() {
  const router = useRouter();
  const { status, user } = useAuth();
  const { refreshUser } = useAuthDispatch();
  const [categories, setCategories] = useState<ReadonlyArray<Category>>([]);
  const [selected, setSelected] = useState<Set<string>>(() =>
    new Set(user?.interests ?? []),
  );
  const [expandedSet, setExpandedSet] = useState<Set<string>>(new Set());
  const [burstSet, setBurstSet] = useState<Set<string>>(new Set());
  const [crackingSet, setCrackingSet] = useState<Set<string>>(new Set());
  const [bouncingId, setBouncingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const collapseTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const crackTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const burstOrigins = useRef(new Map<string, { cx: number; cy: number }>());
  const prevLayout = useRef(new Map<string, { cx: number; cy: number }>());

  const defaultPositions = useMemo(() => generateDefaultPositions(categories), [categories]);

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [status, router]);

  useEffect(() => {
    if (status !== 'authenticated') return;
    const controller = new AbortController();
    fetchCategories(controller.signal)
      .then((data) => setCategories(groupsToCategories(data.groups)))
      .catch(() => {
        if (!controller.signal.aborted) {
          setError('Failed to load categories');
        }
      });
    return () => controller.abort();
  }, [status]);

  /* Cleanup all timers on unmount */
  useEffect(() => {
    const ct = collapseTimers.current;
    const ck = crackTimers.current;
    return () => {
      ct.forEach(clearTimeout);
      ck.forEach(clearTimeout);
    };
  }, []);

  const isPackedMode = expandedSet.size > 0;

  const packItems = useMemo((): PackItem[] => {
    const items: PackItem[] = [];
    for (const cat of categories) {
      if (expandedSet.has(cat.id)) {
        for (const sub of cat.subs) items.push({ id: sub.id, size: SUB_SIZE });
      } else {
        items.push({ id: cat.id, size: CAT_PACKED_SIZE });
      }
    }
    return items;
  }, [categories, expandedSet]);

  const packedPositions = useMemo(() => {
    if (!isPackedMode) {
      prevLayout.current.clear();
      return null;
    }
    const currentIds = new Set(packItems.map(it => it.id));
    const pinned = new Map<string, { cx: number; cy: number }>();
    for (const [id, pos] of prevLayout.current) {
      if (currentIds.has(id)) pinned.set(id, pos);
    }

    if (pinned.size === 0) {
      categories.forEach((cat, i) => {
        if (currentIds.has(cat.id) && defaultPositions[i]) {
          pinned.set(cat.id, { cx: defaultPositions[i].cx, cy: defaultPositions[i].cy });
        }
      });
    }

    const result = packBubbles(packItems, pinned, CANVAS_W / 2, CANVAS_H / 2 - 10);

    prevLayout.current.clear();
    for (const [id, pos] of result) {
      prevLayout.current.set(id, { cx: pos.left + pos.size / 2, cy: pos.top + pos.size / 2 });
    }

    return result;
  }, [isPackedMode, packItems, categories, defaultPositions]);

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) { n.delete(id); } else if (n.size < MAX_INTERESTS) { n.add(id); }
      return n;
    });
    setBouncingId(id);
    setTimeout(() => setBouncingId(null), 350);
  }, []);

  function handleBigBubbleTap(catId: string) {
    const ec = collapseTimers.current.get(catId);
    if (ec) { clearTimeout(ec); collapseTimers.current.delete(catId); }
    const ek = crackTimers.current.get(catId);
    if (ek) { clearTimeout(ek); crackTimers.current.delete(catId); }

    const idx = categories.findIndex((c) => c.id === catId);

    if (expandedSet.has(catId)) {
      setBurstSet((prev) => { const n = new Set(prev); n.delete(catId); return n; });
      const timer = setTimeout(() => {
        setExpandedSet((prev) => { const n = new Set(prev); n.delete(catId); return n; });
        collapseTimers.current.delete(catId);
      }, 500);
      collapseTimers.current.set(catId, timer);
    } else {
      const packPos = packedPositions?.get(catId);
      const dp = defaultPositions[idx];
      if (!dp) return;
      const catSize = packPos?.size ?? dp.size;
      burstOrigins.current.set(catId, {
        cx: isPackedMode && packPos ? packPos.left + catSize / 2 : dp.cx,
        cy: isPackedMode && packPos ? packPos.top + catSize / 2 : dp.cy,
      });

      setCrackingSet((prev) => { const n = new Set(prev); n.add(catId); return n; });

      const crackTimer = setTimeout(() => {
        setCrackingSet((prev) => { const n = new Set(prev); n.delete(catId); return n; });
        setExpandedSet((prev) => { const n = new Set(prev); n.add(catId); return n; });
        crackTimers.current.delete(catId);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setBurstSet((prev) => { const n = new Set(prev); n.add(catId); return n; });
          });
        });
      }, 160);
      crackTimers.current.set(catId, crackTimer);
    }
  }

  async function handleSubmit() {
    if (isSubmitting || selected.size === 0) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await submitInterests([...selected]);
      await refreshUser();
      router.push('/explore');
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError('Please sign in to save your interests');
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  if (status !== 'authenticated') return null;

  return (
    <div className="min-h-dvh bg-cream flex flex-col max-w-[428px] mx-auto relative">
      {/* Title */}
      <div className="px-6 pt-[60px] flex flex-col gap-2">
        <h1 className="font-serif text-4xl leading-[45px] text-[#111]">What moves you?</h1>
        <p className="font-serif italic text-sm leading-5 text-[#666] opacity-60">Tap a sphere to explore</p>
      </div>

      {/* Bubble canvas */}
      <div className="relative w-full max-w-[384px] h-[448px] mx-auto mt-4 overflow-hidden">
        {categories.map((cat, i) => {
          const dp = defaultPositions[i];
          if (!dp) return null;
          const isExp = expandedSet.has(cat.id);
          const isCracking = crackingSet.has(cat.id);
          const packPos = packedPositions?.get(cat.id);
          const count = cat.subs.filter((s) => selected.has(s.id)).length;

          const targetLeft = isPackedMode && packPos ? packPos.left : dp.left;
          const targetTop = isPackedMode && packPos ? packPos.top : dp.top;
          const targetSize = isPackedMode && packPos ? packPos.size : dp.size;

          const origin = burstOrigins.current.get(cat.id);
          const expLeft = origin ? origin.cx - targetSize / 2 : targetLeft;
          const expTop = origin ? origin.cy - targetSize / 2 : targetTop;

          return (
            <div key={cat.id}>
              {isExp && origin && (
                <>
                  <div className="absolute rounded-full pointer-events-none" style={{
                    left: origin.cx - targetSize * 0.75, top: origin.cy - targetSize * 0.75,
                    width: targetSize * 1.5, height: targetSize * 1.5,
                    border: '1.5px solid rgba(17,17,17,0.12)',
                    animation: `bubble-crack-ripple 0.8s ${EASE} forwards`, zIndex: 5,
                  }} />
                  <div className="absolute rounded-full pointer-events-none" style={{
                    left: origin.cx - targetSize * 0.6, top: origin.cy - targetSize * 0.6,
                    width: targetSize * 1.2, height: targetSize * 1.2,
                    border: '1px solid rgba(17,17,17,0.06)',
                    animation: `bubble-crack-ripple-2 0.6s 0.06s ${EASE} forwards`, zIndex: 5,
                  }} />
                  {[0, 1, 2, 3, 4, 5].map((p) => {
                    const a = (p / 6) * Math.PI * 2;
                    const d = targetSize * 0.6;
                    return (
                      <div key={p} className="absolute rounded-full bg-[#111]/15 pointer-events-none" style={{
                        width: 6, height: 6,
                        left: origin.cx - 3, top: origin.cy - 3,
                        // @ts-expect-error CSS custom properties
                        '--px': `${Math.cos(a) * d}px`, '--py': `${Math.sin(a) * d}px`,
                        animation: `bubble-pop-particle 0.5s ${0.02 * p}s ${EASE} forwards`, zIndex: 5,
                      }} />
                    );
                  })}
                </>
              )}

              <button type="button" aria-expanded={isExp} onClick={() => handleBigBubbleTap(cat.id)}
                style={{
                  width: targetSize, height: targetSize,
                  left: isExp ? expLeft : targetLeft,
                  top: isExp ? expTop : targetTop,
                  willChange: 'transform, left, top, width, height, opacity',
                  ...(isExp ? {
                    animation: `bubble-pop-out 0.35s ${EASE} forwards`,
                    pointerEvents: 'none' as const,
                    zIndex: 0,
                  } : {
                    transform: isCracking ? 'scale(1.08)' : 'scale(1)',
                    opacity: 1,
                    transition: isCracking
                      ? `transform 0.15s ${EASE}`
                      : `left 0.6s ${EASE}, top 0.6s ${EASE}, width 0.6s ${EASE}, height 0.6s ${EASE}, transform 0.5s ${EASE}, opacity 0.3s ${EASE}`,
                    zIndex: 10,
                  }),
                }}
                className="absolute rounded-full border border-[#111]/10 shadow-[0px_2px_8px_rgba(0,0,0,0.04)] flex flex-col gap-1.5 items-center justify-center tap-feedback bg-white text-[#111]"
              >
                <span className="font-serif text-[13px] leading-tight text-center px-2">{cat.label}</span>
                <div aria-hidden="true" className="h-0.5 w-3.5 rounded-full bg-[#111]/20" />
                {count > 0 && (
                  <span className="absolute -top-1 -right-1 flex items-center justify-center rounded-full bg-black font-inter text-[9px] font-bold text-white"
                    style={{ width: 22, height: 22, border: '2px solid #fdfdf5' }}>{count}</span>
                )}
              </button>
            </div>
          );
        })}

        {categories.map((cat, catIdx) => {
          if (!expandedSet.has(cat.id)) return null;
          const origin = burstOrigins.current.get(cat.id) ?? defaultPositions[catIdx];
          if (!origin) return null;
          const originCx = origin.cx;
          const originCy = origin.cy;
          const isBurst = burstSet.has(cat.id);

          return cat.subs.map((sub, j) => {
            const packPos = packedPositions?.get(sub.id);
            const isSel = selected.has(sub.id);
            const delay = isBurst ? j * 60 : 0;

            return (
              <button key={sub.id} type="button" onClick={() => toggle(sub.id)}
                style={{
                  width: SUB_SIZE, height: SUB_SIZE,
                  position: 'absolute',
                  left: isBurst && packPos ? packPos.left : originCx - SUB_SIZE / 2,
                  top: isBurst && packPos ? packPos.top : originCy - SUB_SIZE / 2,
                  transform: isBurst ? 'scale(1)' : 'scale(0.3)',
                  opacity: isBurst ? 1 : 0,
                  willChange: 'transform, left, top, opacity',
                  transition: [
                    `left 0.55s ${EASE_SPRING} ${delay}ms`,
                    `top 0.55s ${EASE_SPRING} ${delay}ms`,
                    `transform 0.5s ${EASE_SPRING} ${delay}ms`,
                    `opacity 0.25s ${EASE} ${delay}ms`,
                    'background-color 0.25s ease',
                    'border-color 0.25s ease',
                  ].join(', '),
                  animation: bouncingId === sub.id ? `bubble-select-bounce 0.35s ${EASE} both` : undefined,
                  zIndex: 5,
                }}
                className={`rounded-full border shadow-[0px_2px_8px_rgba(0,0,0,0.04)] flex items-center justify-center tap-feedback ${
                  isSel ? 'bg-black text-white border-black' : 'bg-white text-[#111] border-[#111]/10'
                }`}
              >
                <span className="font-serif text-[13px] leading-tight text-center px-2">{sub.label}</span>
              </button>
            );
          });
        })}
      </div>

      {error && <p className="text-center text-sm text-red-600 mb-2 px-8">{error}</p>}

      {/* Bottom CTA */}
      <div className="px-8 pb-10 pt-6 mt-auto shrink-0">
        <button type="button" disabled={isSubmitting || selected.size === 0} onClick={handleSubmit}
          className="bg-black rounded-full h-14 w-full shadow-[0px_20px_40px_rgba(0,0,0,0.15)] flex items-center justify-center gap-2 disabled:opacity-30 transition-opacity duration-300">
          <span className="font-inter font-bold text-[10px] tracking-[2.5px] text-white uppercase">
            {isSubmitting ? 'Saving...' : selected.size > 0 ? `Continue · ${selected.size}` : 'Pick interests to continue'}
          </span>
        </button>
      </div>
    </div>
  );
}
