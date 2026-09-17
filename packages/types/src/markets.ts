import { z } from 'zod';
import { clipSummarySchema, companySummarySchema, episodeSummarySchema } from './content.js';

/** Stocks and meme stocks (owner direction 2026-09-17). Every market payload says where its numbers come from. */

export const chartRangeSchema = z.enum(['1D', '5D', '1M', '6M', '1Y']);
export type ChartRange = z.infer<typeof chartRangeSchema>;
export const marketDataSourceSchema = z.enum(['demo', 'polygon']);
export type MarketDataSource = z.infer<typeof marketDataSourceSchema>;

export const MARKET_DISCLAIMER = 'Market data is for information only and may be delayed. Not investment advice.';
export const DEMO_MARKET_NOTICE = 'DEMO data: synthetic prices for fictional companies. Not real market data.';

export const quoteSchema = z.object({
  symbol: z.string(),
  price: z.number(),
  change: z.number(),
  changePercent: z.number(),
  volume: z.number(),
  asOf: z.string(),
  delayed: z.boolean(),
  source: marketDataSourceSchema,
});
export type Quote = z.infer<typeof quoteSchema>;

export const barSchema = z.object({ t: z.number(), o: z.number(), h: z.number(), l: z.number(), c: z.number(), v: z.number() });
export type Bar = z.infer<typeof barSchema>;

export const stockSummarySchema = z.object({
  symbol: z.string(),
  name: z.string(),
  slug: z.string(),
  exchange: z.string().nullable(),
  sector: z.string().nullable(),
  memeStock: z.boolean(),
  isDemo: z.boolean(),
  quote: quoteSchema.nullable(),
  /** Recent closes for sparklines (1D range). */
  sparkline: z.array(z.number()),
});
export type StockSummary = z.infer<typeof stockSummarySchema>;

export const stockListResponseSchema = z.object({
  items: z.array(stockSummarySchema),
  source: marketDataSourceSchema,
  disclaimer: z.string(),
  /** Set when any listed stock uses synthetic data. */
  demoNotice: z.string().nullable(),
});
export type StockListResponse = z.infer<typeof stockListResponseSchema>;

export const barsResponseSchema = z.object({
  symbol: z.string(),
  range: chartRangeSchema,
  bars: z.array(barSchema),
  source: marketDataSourceSchema,
  stats: z.object({
    open: z.number().nullable(),
    close: z.number().nullable(),
    high: z.number().nullable(),
    low: z.number().nullable(),
    change: z.number().nullable(),
    changePercent: z.number().nullable(),
    volume: z.number(),
    /** Last bar volume / trailing average. */
    relativeVolume: z.number().nullable(),
  }),
  /** 20-period simple moving average aligned to `bars`. */
  sma20: z.array(z.number().nullable()),
});
export type BarsResponse = z.infer<typeof barsResponseSchema>;

export const moversResponseSchema = z.object({
  gainers: z.array(stockSummarySchema),
  losers: z.array(stockSummarySchema),
  mostActive: z.array(stockSummarySchema),
  source: marketDataSourceSchema,
  demoNotice: z.string().nullable(),
});
export type MoversResponse = z.infer<typeof moversResponseSchema>;

export const buzzSignalsSchema = z.object({
  pageViews: z.number().int(),
  follows: z.number().int(),
  searches: z.number().int(),
  mentions: z.number().int(),
});

export const radarItemSchema = stockSummarySchema.extend({
  /** 0–100 relative to the most-discussed stock in the window. */
  buzzScore: z.number(),
  /** Percent change in StockTank activity vs the previous window; null when there was none. */
  buzzChange: z.number().nullable(),
  signals: buzzSignalsSchema,
});
export type RadarItem = z.infer<typeof radarItemSchema>;

export const radarResponseSchema = z.object({
  windowDays: z.number().int(),
  items: z.array(radarItemSchema),
  /** How the buzz score is built, shown next to the radar. */
  methodology: z.string(),
  source: marketDataSourceSchema,
  demoNotice: z.string().nullable(),
});
export type RadarResponse = z.infer<typeof radarResponseSchema>;

export const stockDetailResponseSchema = z.object({
  stock: stockSummarySchema.extend({ description: z.string().nullable(), website: z.string().nullable(), country: z.string().nullable() }),
  company: companySummarySchema,
  buzz: z.object({
    daily: z.array(z.object({ date: z.string(), pageViews: z.number().int(), searches: z.number().int() })),
    signals: buzzSignalsSchema,
  }),
  episodes: z.array(episodeSummarySchema),
  clips: z.array(clipSummarySchema),
  disclaimer: z.string(),
  demoNotice: z.string().nullable(),
});
export type StockDetailResponse = z.infer<typeof stockDetailResponseSchema>;
