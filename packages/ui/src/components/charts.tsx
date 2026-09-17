import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';

import { cn } from '../lib/cn.js';
import { useReducedMotion } from './motion.js';

/* ---------------------------------------------------------------------------
 * Shared helpers
 * ------------------------------------------------------------------------- */

const UP = 'var(--st-primary-hi)';
const DOWN = 'var(--st-danger)';

function useMeasuredWidth<T extends HTMLElement>(fallback: number) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([entry]) => {
      const w = Math.round(entry?.contentRect.width ?? 0);
      if (w > 0) setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

function extent(values: number[]): [number, number] {
  let min = Infinity;
  let max = -Infinity;
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (!Number.isFinite(min)) return [0, 1];
  if (min === max) return [min - 1, max + 1];
  const pad = (max - min) * 0.06;
  return [min - pad, max + pad];
}

const compact = (n: number) => new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(n);

/* ---------------------------------------------------------------------------
 * Sparkline
 * ------------------------------------------------------------------------- */

export interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  /** Colour follows the trend (first vs last) unless forced. */
  trend?: 'up' | 'down' | 'auto';
  /** Accessible description; without it the sparkline is decorative. */
  label?: string;
  className?: string;
  animate?: boolean;
}

export function Sparkline({ data, width = 120, height = 36, trend = 'auto', label, className, animate = true }: SparklineProps) {
  const id = useId().replace(/:/g, '');
  const reduced = useReducedMotion();
  if (data.length < 2) return <svg width={width} height={height} className={className} aria-hidden="true" />;
  const [min, max] = extent(data);
  const x = (i: number) => (i / (data.length - 1)) * width;
  const y = (v: number) => height - ((v - min) / (max - min)) * height;
  const line = data.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
  const up = trend === 'auto' ? data.at(-1)! >= data[0]! : trend === 'up';
  const color = up ? UP : DOWN;
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={`sg${id}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line}L${width},${height}L0,${height}Z`} fill={`url(#sg${id})`} className={animate && !reduced ? 'animate-fade-in' : undefined} />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth={1.6}
        strokeLinejoin="round"
        strokeLinecap="round"
        pathLength={1}
        strokeDasharray={animate && !reduced ? 1 : undefined}
        className={animate && !reduced ? 'animate-draw' : undefined}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/* ---------------------------------------------------------------------------
 * Price chart: area or candles, volume, SMA, crosshair (pointer + keyboard)
 * ------------------------------------------------------------------------- */

export interface OhlcBar {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export interface PriceChartProps {
  bars: OhlcBar[];
  mode?: 'area' | 'candles';
  sma?: Array<number | null>;
  showVolume?: boolean;
  height?: number;
  /** Formats bar times for the crosshair label; defaults to date + time. */
  formatTime?: (t: number) => string;
  formatPrice?: (n: number) => string;
  label: string;
  className?: string;
  /** Rendered in the corner, e.g. a DEMO badge. */
  badge?: ReactNode;
}

export function PriceChart({
  bars,
  mode = 'area',
  sma,
  showVolume = true,
  height = 320,
  formatTime = (t) => new Date(t).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
  formatPrice = (n) => n.toFixed(2),
  label,
  className,
  badge,
}: PriceChartProps) {
  const [wrapRef, width] = useMeasuredWidth<HTMLDivElement>(640);
  const reduced = useReducedMotion();
  const gradientId = useId().replace(/:/g, '');
  const [active, setActive] = useState<number | null>(null);

  const padRight = 56;
  const volumeH = showVolume ? Math.round(height * 0.2) : 0;
  const priceH = height - volumeH - 18;
  const plotW = Math.max(10, width - padRight);

  const geometry = useMemo(() => {
    if (bars.length === 0) return null;
    const [min, max] = extent(bars.flatMap((b) => (mode === 'candles' ? [b.h, b.l] : [b.c])));
    const maxVol = Math.max(1, ...bars.map((b) => b.v));
    const step = plotW / bars.length;
    const x = (i: number) => i * step + step / 2;
    const y = (v: number) => 8 + (1 - (v - min) / (max - min)) * (priceH - 8);
    const line = bars.map((b, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(b.c).toFixed(1)}`).join('');
    const smaPath = sma
      ? sma
          .map((v, i) => (v === null ? null : `${x(i).toFixed(1)},${y(v).toFixed(1)}`))
          .reduce<string>((acc, p) => (p === null ? acc : acc + (acc === '' || acc.endsWith('|') ? 'M' : 'L') + p), '')
      : '';
    const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => min + (max - min) * f);
    return { min, max, maxVol, step, x, y, line, smaPath, ticks };
  }, [bars, mode, sma, plotW, priceH]);

  const up = bars.length > 1 ? bars.at(-1)!.c >= bars[0]!.o : true;
  const color = up ? UP : DOWN;

  const indexFromPointer = useCallback(
    (e: PointerEvent<SVGSVGElement>) => {
      if (!geometry) return null;
      const rect = e.currentTarget.getBoundingClientRect();
      const px = ((e.clientX - rect.left) / rect.width) * width;
      return Math.max(0, Math.min(bars.length - 1, Math.floor(px / geometry.step)));
    },
    [geometry, bars.length, width],
  );

  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    if (bars.length === 0) return;
    const current = active ?? bars.length - 1;
    const jump = e.shiftKey ? 10 : 1;
    if (e.key === 'ArrowLeft') setActive(Math.max(0, current - jump));
    else if (e.key === 'ArrowRight') setActive(Math.min(bars.length - 1, current + jump));
    else if (e.key === 'Home') setActive(0);
    else if (e.key === 'End') setActive(bars.length - 1);
    else if (e.key === 'Escape') setActive(null);
    else return;
    e.preventDefault();
  };

  const focus = active !== null ? bars[active] : null;
  const first = bars[0];
  const last = bars.at(-1);

  return (
    <div ref={wrapRef} className={cn('relative w-full select-none', className)}>
      <div className="pointer-events-none absolute left-2 top-2 z-10 flex min-h-12 flex-col gap-0.5 rounded-md bg-surface/85 px-2 py-1 font-mono text-[11px] tabular-nums backdrop-blur-sm" aria-live="polite">
        {focus ? (
          <>
            <span className="text-muted">{formatTime(focus.t)}</span>
            <span>
              O {formatPrice(focus.o)} H {formatPrice(focus.h)} L {formatPrice(focus.l)} <span style={{ color: focus.c >= focus.o ? UP : DOWN }}>C {formatPrice(focus.c)}</span>
            </span>
            <span className="text-muted">Vol {compact(focus.v)}</span>
          </>
        ) : last ? (
          <span className="text-muted">Hover or use ← → to inspect</span>
        ) : null}
      </div>
      {badge ? <div className="absolute right-16 top-2 z-10">{badge}</div> : null}
      {geometry ? (
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`${label}. ${bars.length} bars from ${formatTime(first!.t)} to ${formatTime(last!.t)}; opened ${formatPrice(first!.o)}, last ${formatPrice(last!.c)}, high ${formatPrice(Math.max(...bars.map((b) => b.h)))}, low ${formatPrice(Math.min(...bars.map((b) => b.l)))}.`}
          tabIndex={0}
          className="block touch-none rounded-lg focus-visible:outline-2"
          onPointerMove={(e) => setActive(indexFromPointer(e))}
          onPointerDown={(e) => setActive(indexFromPointer(e))}
          onPointerLeave={() => setActive(null)}
          onKeyDown={onKey}
        >
          <defs>
            <linearGradient id={`pg${gradientId}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.32" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          {geometry.ticks.map((v) => (
            <g key={v}>
              <line x1={0} x2={plotW} y1={geometry.y(v)} y2={geometry.y(v)} stroke="var(--st-hairline)" strokeDasharray="3 5" />
              <text x={plotW + 6} y={geometry.y(v) + 4} fontSize={10} fill="var(--st-text-faint)" fontFamily="var(--font-mono)">
                {formatPrice(v)}
              </text>
            </g>
          ))}
          {showVolume
            ? bars.map((b, i) => {
                const h = Math.max(1, (b.v / geometry.maxVol) * (volumeH - 4));
                return (
                  <rect
                    key={`v${b.t}`}
                    x={geometry.x(i) - Math.max(0.5, geometry.step * 0.35)}
                    y={height - 18 - h}
                    width={Math.max(1, geometry.step * 0.7)}
                    height={h}
                    fill={b.c >= b.o ? UP : DOWN}
                    opacity={active === i ? 0.9 : 0.35}
                    className={reduced ? undefined : 'origin-bottom animate-grow-up'}
                    style={reduced ? undefined : { transformBox: 'fill-box', animationDelay: `${Math.min(i, 120) * 4}ms` }}
                  />
                );
              })
            : null}
          {mode === 'area' ? (
            <>
              <path d={`${geometry.line}L${geometry.x(bars.length - 1)},${priceH}L${geometry.x(0)},${priceH}Z`} fill={`url(#pg${gradientId})`} className={reduced ? undefined : 'animate-fade-in'} />
              <path
                d={geometry.line}
                fill="none"
                stroke={color}
                strokeWidth={2}
                strokeLinejoin="round"
                pathLength={1}
                strokeDasharray={reduced ? undefined : 1}
                className={reduced ? undefined : 'animate-draw'}
              />
            </>
          ) : (
            bars.map((b, i) => {
              const bull = b.c >= b.o;
              const bodyTop = geometry.y(Math.max(b.o, b.c));
              const bodyH = Math.max(1, Math.abs(geometry.y(b.o) - geometry.y(b.c)));
              const w = Math.max(1, geometry.step * 0.6);
              return (
                <g key={`c${b.t}`} className={reduced ? undefined : 'animate-fade-in'} style={reduced ? undefined : { animationDelay: `${Math.min(i, 150) * 3}ms` }}>
                  <line x1={geometry.x(i)} x2={geometry.x(i)} y1={geometry.y(b.h)} y2={geometry.y(b.l)} stroke={bull ? UP : DOWN} strokeWidth={1} />
                  <rect x={geometry.x(i) - w / 2} y={bodyTop} width={w} height={bodyH} fill={bull ? UP : DOWN} rx={0.5} />
                </g>
              );
            })
          )}
          {geometry.smaPath ? <path d={geometry.smaPath} fill="none" stroke="var(--st-warning)" strokeWidth={1.4} strokeDasharray="4 3" opacity={0.85} /> : null}
          {focus && active !== null ? (
            <g pointerEvents="none">
              <line x1={geometry.x(active)} x2={geometry.x(active)} y1={0} y2={height - 18} stroke="var(--st-text-muted)" strokeDasharray="2 3" />
              <line x1={0} x2={plotW} y1={geometry.y(focus.c)} y2={geometry.y(focus.c)} stroke="var(--st-text-muted)" strokeDasharray="2 3" />
              <circle cx={geometry.x(active)} cy={geometry.y(focus.c)} r={4.5} fill="var(--st-bg)" stroke={color} strokeWidth={2} />
              <rect x={plotW + 2} y={geometry.y(focus.c) - 9} width={padRight - 4} height={18} rx={4} fill={color} />
              <text x={plotW + 6} y={geometry.y(focus.c) + 4} fontSize={10} fill="var(--st-on-primary)" fontFamily="var(--font-mono)" fontWeight={700}>
                {formatPrice(focus.c)}
              </text>
            </g>
          ) : null}
          <text x={0} y={height - 4} fontSize={10} fill="var(--st-text-faint)" fontFamily="var(--font-mono)">
            {formatTime(first!.t)}
          </text>
          <text x={plotW} y={height - 4} fontSize={10} fill="var(--st-text-faint)" fontFamily="var(--font-mono)" textAnchor="end">
            {formatTime(last!.t)}
          </text>
        </svg>
      ) : (
        <div className="flex items-center justify-center rounded-lg border border-dashed border-hairline text-sm text-muted" style={{ height }}>
          No price data for this range.
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Area and bar charts for dashboards
 * ------------------------------------------------------------------------- */

export interface SeriesPoint {
  label: string;
  value: number;
}

export interface TimeSeriesChartProps {
  data: SeriesPoint[];
  kind?: 'area' | 'bars';
  height?: number;
  label: string;
  formatValue?: (n: number) => string;
  className?: string;
  color?: string;
}

/** Interactive dashboard chart with hover/keyboard tooltip and a visually hidden data table. */
export function TimeSeriesChart({ data, kind = 'area', height = 180, label, formatValue = (n) => n.toLocaleString(), className, color = UP }: TimeSeriesChartProps) {
  const [wrapRef, width] = useMeasuredWidth<HTMLDivElement>(560);
  const reduced = useReducedMotion();
  const gid = useId().replace(/:/g, '');
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));
  const step = data.length > 0 ? width / data.length : width;
  const x = (i: number) => i * step + step / 2;
  const y = (v: number) => 6 + (1 - v / max) * (height - 26);
  const line = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join('');
  const focus = active !== null ? data[active] : null;

  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    if (data.length === 0) return;
    const current = active ?? data.length - 1;
    if (e.key === 'ArrowLeft') setActive(Math.max(0, current - 1));
    else if (e.key === 'ArrowRight') setActive(Math.min(data.length - 1, current + 1));
    else if (e.key === 'Escape') setActive(null);
    else return;
    e.preventDefault();
  };

  return (
    <figure ref={wrapRef} className={cn('relative m-0 w-full', className)}>
      {focus ? (
        <div className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-md border border-hairline-strong bg-overlay px-2 py-1 font-mono text-[11px] shadow-lg" style={{ left: Math.min(width - 50, Math.max(50, x(active!))), top: 0 }}>
          <span className="text-muted">{focus.label}</span> <span className="font-semibold">{formatValue(focus.value)}</span>
        </div>
      ) : null}
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={label}
        tabIndex={0}
        className="block touch-none"
        onPointerMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          setActive(Math.max(0, Math.min(data.length - 1, Math.floor(((e.clientX - rect.left) / rect.width) * data.length))));
        }}
        onPointerLeave={() => setActive(null)}
        onKeyDown={onKey}
      >
        <defs>
          <linearGradient id={`tg${gid}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1={0} x2={width} y1={height - 20} y2={height - 20} stroke="var(--st-hairline)" />
        {kind === 'bars'
          ? data.map((d, i) => {
              const h = Math.max(d.value > 0 ? 2 : 0, height - 20 - y(d.value));
              return (
                <rect
                  key={d.label}
                  x={x(i) - step * 0.35}
                  y={height - 20 - h}
                  width={Math.max(1, step * 0.7)}
                  height={h}
                  rx={2}
                  fill={color}
                  opacity={active === null || active === i ? 0.9 : 0.4}
                  className={reduced ? undefined : 'animate-grow-up'}
                  style={reduced ? undefined : { transformBox: 'fill-box', transformOrigin: 'bottom', animationDelay: `${Math.min(i, 60) * 12}ms` }}
                />
              );
            })
          : data.length > 1 && (
              <>
                <path d={`${line}L${x(data.length - 1)},${height - 20}L${x(0)},${height - 20}Z`} fill={`url(#tg${gid})`} className={reduced ? undefined : 'animate-fade-in'} />
                <path d={line} fill="none" stroke={color} strokeWidth={2} pathLength={1} strokeDasharray={reduced ? undefined : 1} className={reduced ? undefined : 'animate-draw'} />
              </>
            )}
        {focus && active !== null ? (
          <g pointerEvents="none">
            <line x1={x(active)} x2={x(active)} y1={0} y2={height - 20} stroke="var(--st-text-muted)" strokeDasharray="2 3" />
            {kind === 'area' ? <circle cx={x(active)} cy={y(focus.value)} r={4} fill="var(--st-bg)" stroke={color} strokeWidth={2} /> : null}
          </g>
        ) : null}
        {data.length > 0 ? (
          <>
            <text x={0} y={height - 4} fontSize={10} fill="var(--st-text-faint)" fontFamily="var(--font-mono)">
              {data[0]!.label}
            </text>
            <text x={width} y={height - 4} fontSize={10} fill="var(--st-text-faint)" fontFamily="var(--font-mono)" textAnchor="end">
              {data.at(-1)!.label}
            </text>
          </>
        ) : null}
      </svg>
      <table className="sr-only">
        <caption>{label}</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.label}>
              <th scope="row">{d.label}</th>
              <td>{formatValue(d.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/* ---------------------------------------------------------------------------
 * Heat map (squarified treemap)
 * ------------------------------------------------------------------------- */

export interface HeatMapItem {
  id: string;
  label: string;
  sublabel?: string;
  /** Percent change: colours the tile. */
  change: number | null;
  /** Tile area, e.g. volume. */
  weight: number;
  href?: string;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Squarified treemap layout (Bruls et al.) over normalised weights. */
export function squarify(weights: number[], box: Rect): Rect[] {
  const total = weights.reduce((s, w) => s + w, 0) || 1;
  const area = box.w * box.h;
  const items = weights.map((w, i) => ({ i, a: (Math.max(w, 0) / total) * area }));
  const out: Rect[] = new Array(weights.length);
  let rect = { ...box };
  let row: typeof items = [];

  const worst = (r: typeof items, side: number) => {
    const s = r.reduce((sum, it) => sum + it.a, 0);
    let max = 0;
    for (const it of r) {
      if (it.a === 0) continue;
      max = Math.max(max, (side * side * it.a) / (s * s), (s * s) / (side * side * it.a));
    }
    return max;
  };
  const layoutRow = (r: typeof items) => {
    const s = r.reduce((sum, it) => sum + it.a, 0);
    const horizontal = rect.w >= rect.h;
    const side = horizontal ? rect.h : rect.w;
    const thickness = side > 0 ? s / side : 0;
    let offset = 0;
    for (const it of r) {
      const len = thickness > 0 ? it.a / thickness : 0;
      out[it.i] = horizontal ? { x: rect.x, y: rect.y + offset, w: thickness, h: len } : { x: rect.x + offset, y: rect.y, w: len, h: thickness };
      offset += len;
    }
    rect = horizontal ? { x: rect.x + thickness, y: rect.y, w: rect.w - thickness, h: rect.h } : { x: rect.x, y: rect.y + thickness, w: rect.w, h: rect.h - thickness };
  };

  const sorted = [...items].sort((a, b) => b.a - a.a);
  for (const it of sorted) {
    const side = Math.min(rect.w, rect.h);
    if (row.length === 0 || worst([...row, it], side) <= worst(row, side)) {
      row.push(it);
    } else {
      layoutRow(row);
      row = [it];
    }
  }
  if (row.length) layoutRow(row);
  return out;
}

function heatColor(change: number | null): string {
  if (change === null) return 'var(--st-raised)';
  const t = Math.min(1, Math.abs(change) / 6);
  const alpha = 0.18 + t * 0.62;
  return change >= 0 ? `rgb(0 201 122 / ${alpha})` : `rgb(255 77 94 / ${alpha})`;
}

export interface HeatMapProps {
  items: HeatMapItem[];
  height?: number;
  label: string;
  className?: string;
  renderLink?: (item: HeatMapItem, children: ReactNode, className: string) => ReactNode;
}

export function HeatMap({ items, height = 320, label, className, renderLink }: HeatMapProps) {
  const [wrapRef, width] = useMeasuredWidth<HTMLDivElement>(720);
  const reduced = useReducedMotion();
  const rects = useMemo(() => squarify(items.map((i) => i.weight), { x: 0, y: 0, w: width, h: height }), [items, width, height]);
  return (
    <div ref={wrapRef} className={cn('relative w-full overflow-hidden rounded-xl', className)} style={{ height }} role="list" aria-label={label}>
      {items.map((item, idx) => {
        const r = rects[idx];
        if (!r || r.w < 1 || r.h < 1) return null;
        const big = r.w > 90 && r.h > 54;
        const tileClass = cn(
          'group absolute flex flex-col items-center justify-center overflow-hidden border border-bg/60 text-center transition-[filter,transform] duration-200 hover:z-10 hover:scale-[1.03] hover:brightness-125 focus-visible:z-10 focus-visible:scale-[1.03]',
          !reduced && 'animate-pop-in',
        );
        const content = (
          <>
            <span className={cn('font-display font-extrabold leading-none', big ? 'text-lg' : 'text-[11px]')}>{item.label}</span>
            {big && item.change !== null ? (
              <span className="mt-1 font-mono text-xs tabular-nums">
                {item.change >= 0 ? '+' : ''}
                {item.change.toFixed(2)}%
              </span>
            ) : null}
            {big && item.sublabel ? <span className="mt-0.5 max-w-full truncate px-1 text-[10px] text-fg/70">{item.sublabel}</span> : null}
            <span className="sr-only">
              {item.sublabel ? `${item.sublabel}, ` : ''}
              {item.change === null ? 'no quote' : `${item.change >= 0 ? 'up' : 'down'} ${Math.abs(item.change).toFixed(2)} percent`}
            </span>
          </>
        );
        const style = { left: r.x, top: r.y, width: r.w, height: r.h, background: heatColor(item.change), animationDelay: reduced ? undefined : `${Math.min(idx, 30) * 25}ms` };
        return (
          <div role="listitem" key={item.id} className="contents">
            {renderLink && item.href ? (
              <div className="absolute" style={{ left: r.x, top: r.y, width: r.w, height: r.h }}>
                {renderLink(item, content, cn(tileClass, 'left-0 top-0 size-full'))}
              </div>
            ) : (
              <div className={tileClass} style={style}>
                {content}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export { heatColor };

/* ---------------------------------------------------------------------------
 * Buzz meter (radial gauge)
 * ------------------------------------------------------------------------- */

export interface BuzzMeterProps {
  value: number;
  size?: number;
  label?: string;
  className?: string;
}

export function BuzzMeter({ value, size = 64, label = 'Buzz', className }: BuzzMeterProps) {
  const reduced = useReducedMotion();
  const v = Math.max(0, Math.min(100, value));
  const r = size / 2 - 6;
  const c = 2 * Math.PI * r;
  const arc = c * 0.75;
  const color = v >= 70 ? 'var(--st-warning)' : v >= 35 ? UP : 'var(--st-info)';
  return (
    <div className={cn('relative inline-flex items-center justify-center', className)} style={{ width: size, height: size }} role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v)} aria-label={label}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-[225deg]" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--st-hairline-strong)" strokeWidth={5} strokeDasharray={`${arc} ${c}`} strokeLinecap="round" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={5}
          strokeLinecap="round"
          strokeDasharray={`${(arc * v) / 100} ${c}`}
          style={reduced ? undefined : { transition: 'stroke-dasharray 900ms cubic-bezier(0.16, 1, 0.3, 1)' }}
        />
      </svg>
      <span className="absolute font-display text-sm font-extrabold tabular-nums">{Math.round(v)}</span>
    </div>
  );
}
