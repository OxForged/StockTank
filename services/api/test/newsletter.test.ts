import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { createEmailProvider, MemoryEmailProvider } from '../src/lib/email.js';
import { createLogger } from '../src/lib/logger.js';
import { CSRF_HEADERS, createTestContext, resetAdvertising, type TestContext } from './helpers.js';

function tokenFrom(text: string, path: 'confirm' | 'unsubscribe'): string {
  const match = new RegExp(`/newsletter/${path}\\?token=([A-Za-z0-9_-]+)`).exec(text);
  if (!match?.[1]) throw new Error(`no ${path} link in email`);
  return match[1];
}

describe('newsletter double opt-in', () => {
  let ctx: TestContext;
  const email = new MemoryEmailProvider();

  beforeAll(async () => {
    ctx = await createTestContext({ redis: false, email });
  });
  beforeEach(async () => {
    await resetAdvertising(ctx.prisma);
    email.sent.length = 0;
  });
  afterAll(async () => {
    await resetAdvertising(ctx.prisma);
    await ctx.close();
  });

  const subscribe = (body: object) =>
    request(ctx.app).post('/api/v1/newsletter/subscribe').set(CSRF_HEADERS).send({ consent: true, ...body });

  it('creates a pending subscriber, emails a confirmation link and stores only token hashes', async () => {
    const res = await subscribe({ email: 'Reader@Example.com', source: 'homepage', utm: { source: 'x' } });
    expect(res.status).toBe(202);
    expect(res.body).toEqual({ status: 'check_inbox' });

    const row = await ctx.prisma.newsletterSubscriber.findUniqueOrThrow({ where: { email: 'reader@example.com' } });
    expect(row.status).toBe('pending');
    expect(row.utmSource).toBe('x');
    const token = tokenFrom(email.sent[0]!.text, 'confirm');
    expect(row.confirmTokenHash).not.toBe(token);
    expect(JSON.stringify(row)).not.toContain(token);
  });

  it('confirms with the emailed token and then unsubscribes', async () => {
    await subscribe({ email: 'reader@example.com' });
    const text = email.sent[0]!.text;

    const confirm = await request(ctx.app).post('/api/v1/newsletter/confirm').set(CSRF_HEADERS).send({ token: tokenFrom(text, 'confirm') });
    expect(confirm.status).toBe(200);
    expect(confirm.body).toEqual({ status: 'confirmed' });

    const reuse = await request(ctx.app).post('/api/v1/newsletter/confirm').set(CSRF_HEADERS).send({ token: tokenFrom(text, 'confirm') });
    expect(reuse.status).toBe(404);

    const unsub = await request(ctx.app).post('/api/v1/newsletter/unsubscribe').set(CSRF_HEADERS).send({ token: tokenFrom(text, 'unsubscribe') });
    expect(unsub.body).toEqual({ status: 'unsubscribed' });
    const row = await ctx.prisma.newsletterSubscriber.findUniqueOrThrow({ where: { email: 'reader@example.com' } });
    expect(row.status).toBe('unsubscribed');
  });

  it('gives the same answer for an already-confirmed address and sends nothing new', async () => {
    await subscribe({ email: 'reader@example.com' });
    await request(ctx.app).post('/api/v1/newsletter/confirm').set(CSRF_HEADERS).send({ token: tokenFrom(email.sent[0]!.text, 'confirm') });
    email.sent.length = 0;

    const res = await subscribe({ email: 'reader@example.com' });
    expect(res.status).toBe(202);
    expect(res.body).toEqual({ status: 'check_inbox' });
    expect(email.sent).toHaveLength(0);
  });

  it('rejects unknown tokens and discards honeypot sign-ups', async () => {
    const bad = await request(ctx.app).post('/api/v1/newsletter/confirm').set(CSRF_HEADERS).send({ token: 'a'.repeat(43) });
    expect(bad.status).toBe(404);

    const bot = await subscribe({ email: 'bot@example.com', website: 'http://spam' });
    expect(bot.status).toBe(202);
    expect(await ctx.prisma.newsletterSubscriber.count()).toBe(0);
  });

  it('returns 503 instead of pretending when no email provider is configured', async () => {
    const env = { ...ctx.env, EMAIL_PROVIDER: 'none' as const };
    const logger = createLogger({ level: 'silent' });
    const app = createApp({ env, prisma: ctx.prisma, redis: null, logger, email: createEmailProvider(env, logger) });
    const res = await request(app).post('/api/v1/newsletter/subscribe').set(CSRF_HEADERS).send({ email: 'a@example.com', consent: true });
    expect(res.status).toBe(503);
    expect(await ctx.prisma.newsletterSubscriber.count()).toBe(0);
  });
});
