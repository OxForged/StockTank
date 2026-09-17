import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { BuzzMeter, HeatMap, PriceChart, Sparkline, TimeSeriesChart, squarify } from './charts.js';
import { AnimatedNumber, ChangeBadge } from './motion.js';

const bars = Array.from({ length: 30 }, (_, i) => ({ t: Date.UTC(2026, 8, 1 + i), o: 10 + i, h: 12 + i, l: 9 + i, c: 11 + i, v: 1000 + i * 10 }));

describe('squarify', () => {
  it('fills the box exactly with proportional areas', () => {
    const rects = squarify([6, 6, 4, 3, 2, 2, 1], { x: 0, y: 0, w: 600, h: 400 });
    const total = rects.reduce((s, r) => s + r.w * r.h, 0);
    expect(total).toBeCloseTo(600 * 400, 3);
    expect(rects[0]!.w * rects[0]!.h).toBeCloseTo((6 / 24) * 240_000, 3);
    for (const r of rects) {
      expect(r.x).toBeGreaterThanOrEqual(-1e-6);
      expect(r.x + r.w).toBeLessThanOrEqual(600 + 1e-6);
      expect(r.y + r.h).toBeLessThanOrEqual(400 + 1e-6);
    }
  });
});

describe('charts', () => {
  it('describes price charts for assistive tech and supports keyboard crosshair', () => {
    render(<PriceChart bars={bars} label="SQZM price, 1 month" formatTime={(t) => new Date(t).toISOString().slice(0, 10)} />);
    const chart = screen.getByRole('img', { name: /SQZM price, 1 month\. 30 bars from 2026-09-01 to 2026-09-30; opened 10\.00, last 40\.00, high 41\.00, low 9\.00/ });
    const readout = () => chart.parentElement!.querySelector('[aria-live="polite"]')!;
    fireEvent.keyDown(chart, { key: 'End' });
    expect(readout()).toHaveTextContent('2026-09-30');
    expect(readout()).toHaveTextContent('C 40.00');
    fireEvent.keyDown(chart, { key: 'ArrowLeft' });
    expect(readout()).toHaveTextContent('2026-09-29');
    expect(readout()).toHaveTextContent('C 39.00');
    fireEvent.keyDown(chart, { key: 'Escape' });
    expect(screen.getByText(/use ← → to inspect/)).toBeInTheDocument();
  });

  it('renders candles and an empty state', () => {
    const { container, rerender } = render(<PriceChart bars={bars} mode="candles" label="candles" />);
    expect(container.querySelectorAll('g > rect').length).toBeGreaterThanOrEqual(30);
    rerender(<PriceChart bars={[]} label="empty" />);
    expect(screen.getByText('No price data for this range.')).toBeInTheDocument();
  });

  it('exposes dashboard series as a data table', () => {
    render(<TimeSeriesChart data={[{ label: 'Mon', value: 3 }, { label: 'Tue', value: 9 }]} label="Visitors" kind="bars" />);
    expect(screen.getByRole('table', { name: 'Visitors' })).toHaveTextContent('Tue9');
  });

  it('labels heat map tiles and sparklines, and reports buzz as a meter', () => {
    render(
      <>
        <HeatMap
          label="Stocks by volume"
          items={[
            { id: 'a', label: 'SQZM', sublabel: 'Squeeze Motors', change: 4.2, weight: 10 },
            { id: 'b', label: 'STDY', change: -1.5, weight: 5 },
          ]}
        />
        <Sparkline data={[1, 2, 3]} label="SQZM today" />
        <BuzzMeter value={87.4} label="SQZM buzz" />
      </>,
    );
    expect(screen.getByRole('list', { name: 'Stocks by volume' })).toBeInTheDocument();
    expect(screen.getByText(/Squeeze Motors, up 4\.20 percent/)).toBeInTheDocument();
    expect(screen.getByText(/down 1\.50 percent/)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'SQZM today' })).toBeInTheDocument();
    expect(screen.getByRole('meter', { name: 'SQZM buzz' })).toHaveAttribute('aria-valuenow', '87');
  });

  it('shows change direction in words and final numbers to screen readers', async () => {
    render(
      <>
        <ChangeBadge changePercent={-2.345} />
        <AnimatedNumber value={1234} />
      </>,
    );
    expect(screen.getByText('down')).toBeInTheDocument();
    expect(screen.getByText('2.35%', { exact: false })).toBeInTheDocument();
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(screen.getAllByText('1,234').length).toBeGreaterThan(0);
  });
});
