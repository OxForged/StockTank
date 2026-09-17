import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { pino, type Logger, type LevelWithSilent } from 'pino';
import { pinoHttp, type HttpLogger } from 'pino-http';

export const REQUEST_ID_HEADER = 'x-request-id';
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

/** Fields that must never reach the logs (README section 37). */
export const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  'password',
  'token',
  '*.password',
  '*.token',
  'req.body.password',
  'req.body.token',
];

export interface LoggerOptions {
  level?: LevelWithSilent;
  pretty?: boolean;
}

export function createLogger(options: LoggerOptions = {}): Logger {
  const level = options.level ?? 'info';
  const transport = options.pretty ? { target: 'pino-pretty', options: { colorize: true } } : undefined;
  return pino({
    level,
    redact: { paths: REDACT_PATHS, censor: '[Redacted]' },
    ...(transport ? { transport } : {}),
  });
}

/** Honour a well-formed incoming `x-request-id`; otherwise mint one. Always echo it back. */
export function resolveRequestId(req: IncomingMessage, res: ServerResponse): string {
  const incoming = req.headers[REQUEST_ID_HEADER];
  const candidate = Array.isArray(incoming) ? incoming[0] : incoming;
  const id = candidate && REQUEST_ID_PATTERN.test(candidate) ? candidate : randomUUID();
  res.setHeader(REQUEST_ID_HEADER, id);
  return id;
}

export function createHttpLogger(logger: Logger): HttpLogger {
  return pinoHttp({
    logger,
    genReqId: resolveRequestId,
    customLogLevel: (_req, res, err) => {
      if (err || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
    autoLogging: { ignore: (req) => req.url === '/health' },
    // Only a compact request/response summary is logged; bodies are never serialised.
    serializers: {
      req: (req: { id: unknown; method: string; url: string; remoteAddress?: string }) => ({
        id: req.id,
        method: req.method,
        url: req.url,
        remoteAddress: req.remoteAddress,
      }),
      res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
    },
  });
}

export function getRequestId(req: IncomingMessage): string {
  return typeof req.id === 'string' ? req.id : String(req.id);
}
