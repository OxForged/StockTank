import type { ErrorCode } from '@stocktank/types';

const DEFAULT_STATUS: Record<ErrorCode, number> = {
  BAD_REQUEST: 400,
  VALIDATION_FAILED: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INTERNAL: 500,
};

/** An error that maps directly onto the `apiErrorSchema` envelope. */
export class AppError extends Error {
  readonly status: number;

  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
    status?: number,
  ) {
    super(message);
    this.name = 'AppError';
    this.status = status ?? DEFAULT_STATUS[code];
  }
}

export const errors = {
  badRequest: (message = 'Bad request', details?: unknown) => new AppError('BAD_REQUEST', message, details),
  unauthenticated: (message = 'Authentication required') => new AppError('UNAUTHENTICATED', message),
  forbidden: (message = 'Forbidden') => new AppError('FORBIDDEN', message),
  notFound: (message = 'Not found') => new AppError('NOT_FOUND', message),
  conflict: (message: string) => new AppError('CONFLICT', message),
  rateLimited: (message = 'Too many requests, please try again later') =>
    new AppError('RATE_LIMITED', message),
};
