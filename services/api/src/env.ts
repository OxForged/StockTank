import { aiEnvSchema, type AiEnv } from '@stocktank/ai';
import { loadServerEnv, type ServerEnv } from '@stocktank/config';
import { marketDataEnvSchema, type MarketDataEnv } from '@stocktank/market-data';
import { mediaEnvSchema, type MediaEnv } from '@stocktank/media';
import { castopodEnvSchema, type CastopodEnv } from '@stocktank/podcast';
import { azuracastEnvSchema, type AzuraCastEnv } from '@stocktank/radio';
import { z } from 'zod';

/**
 * Express `trust proxy` setting. Accepts the same values Express does:
 * `false`/`true`, a hop count, or a named/CIDR list such as `loopback` or `10.0.0.0/8`.
 */
const trustProxySchema = z
  .string()
  .default('false')
  .transform((raw): boolean | number | string => {
    const value = raw.trim();
    if (value === '' || value.toLowerCase() === 'false') return false;
    if (value.toLowerCase() === 'true') return true;
    if (/^\d+$/.test(value)) return Number(value);
    return value;
  });

const apiOnlyEnvSchema = z.object({
  TRUST_PROXY: trustProxySchema,
  LOG_LEVEL: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).optional(),
  ),
  /** Local-only one-click staff sign-in. Refused at boot when NODE_ENV=production. */
  DEV_LOGIN_ENABLED: z
    .string()
    .optional()
    .transform((v) => v?.trim().toLowerCase() === 'true'),
  /** Public site origin, used to build links in emails (newsletter confirmation, unsubscribe). */
  PUBLIC_WEB_URL: z.url().default('http://localhost:5190'),
  /** `resend` sends real email; `log` (development only) prints messages to the API log; `none` disables sending. */
  EMAIL_PROVIDER: z.enum(['resend', 'log', 'none']).optional(),
  EMAIL_PROVIDER_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  /** Where new advertising inquiries are forwarded. Optional. */
  SALES_NOTIFY_EMAIL: z.preprocess((v) => (v === '' ? undefined : v), z.email().optional()),
  /** Meilisearch index names are `<prefix>_<type>`; tests use their own prefix. */
  MEILISEARCH_INDEX_PREFIX: z.string().regex(/^[a-z0-9_]{1,40}$/).default('stocktank'),
  /** itunes:owner in podcast feeds; directories send ownership verification to the email. */
  PODCAST_OWNER_NAME: z.preprocess((v) => (v === '' ? undefined : v), z.string().max(120).default('StockTank')),
  PODCAST_OWNER_EMAIL: z.preprocess((v) => (v === '' ? undefined : v), z.email().optional()),
  GIT_COMMIT: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() !== '' ? v.trim() : null)),
});

export type ApiEnv = ServerEnv & z.infer<typeof apiOnlyEnvSchema> & MediaEnv & CastopodEnv & AzuraCastEnv & MarketDataEnv & AiEnv;

/** Parses the shared server env plus API-specific settings. Throws on invalid config. */
export function loadEnv(source: Record<string, string | undefined> = process.env): ApiEnv {
  const shared = loadServerEnv(source);
  const parsed = apiOnlyEnvSchema.safeParse(source);
  const mediaParsed = mediaEnvSchema.safeParse(source);
  const castopodParsed = castopodEnvSchema.safeParse(source);
  const azuracastParsed = azuracastEnvSchema.safeParse(source);
  const marketParsed = marketDataEnvSchema.safeParse(source);
  const aiParsed = aiEnvSchema.safeParse(source);
  if (!aiParsed.success) {
    const issues = aiParsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid API environment:\n${issues}`);
  }
  if (!marketParsed.success) {
    const issues = marketParsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid API environment:\n${issues}`);
  }
  if (marketParsed.data.MARKET_DATA_PROVIDER === 'polygon' && !marketParsed.data.MARKET_DATA_API_KEY) {
    throw new Error('MARKET_DATA_PROVIDER=polygon requires MARKET_DATA_API_KEY');
  }
  if (!azuracastParsed.success) {
    const issues = azuracastParsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid API environment:\n${issues}`);
  }
  if (!castopodParsed.success) {
    const issues = castopodParsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid API environment:\n${issues}`);
  }
  if (!mediaParsed.success) {
    const issues = mediaParsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid API environment:\n${issues}`);
  }
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid API environment:\n${issues}`);
  }
  const emailProvider = parsed.data.EMAIL_PROVIDER ?? (shared.NODE_ENV === 'production' ? 'none' : 'log');
  if (emailProvider === 'log' && shared.NODE_ENV === 'production') {
    throw new Error('EMAIL_PROVIDER=log is for development only');
  }
  if (emailProvider === 'resend' && (!parsed.data.EMAIL_PROVIDER_API_KEY || !parsed.data.EMAIL_FROM)) {
    throw new Error('EMAIL_PROVIDER=resend requires EMAIL_PROVIDER_API_KEY and EMAIL_FROM');
  }
  parsed.data.EMAIL_PROVIDER = emailProvider;
  if (parsed.data.DEV_LOGIN_ENABLED && shared.NODE_ENV === 'production') {
    throw new Error('DEV_LOGIN_ENABLED must not be set in production');
  }
  return { ...shared, ...parsed.data, ...mediaParsed.data, ...castopodParsed.data, ...azuracastParsed.data, ...marketParsed.data, ...aiParsed.data };
}
