import type { Logger } from 'pino';
import type { ApiEnv } from '../env.js';

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/** Provider-agnostic email sending (§36). Adapters must throw on delivery failure. */
export interface EmailProvider {
  readonly name: 'resend' | 'log' | 'none';
  /** False when no provider is configured; callers must surface that instead of pretending to send. */
  readonly canSend: boolean;
  send(message: EmailMessage): Promise<void>;
}

export class EmailNotConfiguredError extends Error {
  constructor() {
    super('No email provider is configured');
    this.name = 'EmailNotConfiguredError';
  }
}

class ResendProvider implements EmailProvider {
  readonly name = 'resend' as const;
  readonly canSend = true;

  constructor(
    private readonly apiKey: string,
    private readonly from: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async send(message: EmailMessage): Promise<void> {
    const res = await this.fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: this.from,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        ...(message.html ? { html: message.html } : {}),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      // The response body can echo the request; only the status is recorded.
      throw new Error(`Resend rejected the message with status ${res.status}`);
    }
  }
}

/** Development only (refused in production at boot): writes the message to the API log. */
class LogProvider implements EmailProvider {
  readonly name = 'log' as const;
  readonly canSend = true;

  constructor(private readonly logger: Logger) {}

  async send(message: EmailMessage): Promise<void> {
    this.logger.info({ email: { to: message.to, subject: message.subject, text: message.text } }, 'Email (log provider, development only)');
  }
}

class DisabledProvider implements EmailProvider {
  readonly name = 'none' as const;
  readonly canSend = false;

  async send(): Promise<void> {
    throw new EmailNotConfiguredError();
  }
}

export function createEmailProvider(env: ApiEnv, logger: Logger): EmailProvider {
  switch (env.EMAIL_PROVIDER) {
    case 'resend':
      return new ResendProvider(env.EMAIL_PROVIDER_API_KEY ?? '', env.EMAIL_FROM ?? '');
    case 'log':
      return new LogProvider(logger);
    default:
      return new DisabledProvider();
  }
}

/** Test double that records messages. */
export class MemoryEmailProvider implements EmailProvider {
  readonly name = 'log' as const;
  readonly canSend = true;
  readonly sent: EmailMessage[] = [];

  async send(message: EmailMessage): Promise<void> {
    this.sent.push(message);
  }
}
