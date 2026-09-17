import type { ErrorRequestHandler, RequestHandler } from 'express';
import type { Logger } from 'pino';
import { ZodError } from 'zod';
import type { ApiError, ErrorCode } from '@stocktank/types';
import { AppError, errors } from '../lib/errors.js';
import { getRequestId } from '../lib/logger.js';

interface HttpLikeError {
  status?: number;
  statusCode?: number;
  type?: string;
  expose?: boolean;
}

function isHttpLikeError(err: unknown): err is HttpLikeError & Error {
  if (!(err instanceof Error)) return false;
  const status = (err as HttpLikeError).status ?? (err as HttpLikeError).statusCode;
  return typeof status === 'number' && status >= 400 && status < 600;
}

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(errors.notFound(`Route ${req.method} ${req.path} not found`));
};

/** Translates any thrown value into the `apiErrorSchema` envelope. Stack traces never leave production. */
export function errorHandler(logger: Logger, isProduction: boolean): ErrorRequestHandler {
  return (err: unknown, req, res, next) => {
    if (res.headersSent) return next(err);

    const requestId = getRequestId(req);
    let status = 500;
    let code: ErrorCode = 'INTERNAL';
    let message = 'Internal server error';
    let details: unknown;

    if (err instanceof AppError) {
      status = err.status;
      code = err.code;
      message = err.message;
      details = err.details;
    } else if (err instanceof ZodError) {
      status = 400;
      code = 'VALIDATION_FAILED';
      message = 'Validation failed';
      details = {
        issues: err.issues.map((i) => ({ path: i.path.map(String).join('.'), message: i.message, code: i.code })),
      };
    } else if (isHttpLikeError(err)) {
      // body-parser / raw-body errors: malformed JSON, oversized payloads, wrong charset.
      status = err.status ?? err.statusCode ?? 400;
      code = status === 429 ? 'RATE_LIMITED' : status < 500 ? 'BAD_REQUEST' : 'INTERNAL';
      message = status < 500 ? describeHttpError(err) : 'Internal server error';
    }

    if (status >= 500) {
      logger.error({ err, requestId, method: req.method, url: req.originalUrl }, 'Unhandled error');
      if (!isProduction && err instanceof Error) {
        details = { name: err.name, message: err.message, stack: err.stack };
      }
    }

    const body: ApiError = { error: { code, message, requestId, ...(details !== undefined ? { details } : {}) } };
    res.status(status).json(body);
  };
}

function describeHttpError(err: HttpLikeError & Error): string {
  switch (err.type) {
    case 'entity.parse.failed':
      return 'Malformed JSON body';
    case 'entity.too.large':
      return 'Request body too large';
    case 'charset.unsupported':
    case 'encoding.unsupported':
      return 'Unsupported request encoding';
    default:
      return err.expose ? err.message : 'Bad request';
  }
}
