import type { z } from 'zod';
import { AppError } from './errors.js';

export type ValidationSource = 'body' | 'query' | 'params';

/**
 * Parses `value` with `schema` and returns the typed result.
 * Throws a 400 VALIDATION_FAILED `AppError` whose `details` lists every issue.
 */
export function validate<S extends z.ZodType>(schema: S, value: unknown, source: ValidationSource): z.output<S> {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  const issues = result.error.issues.map((issue) => ({
    path: issue.path.map(String).join('.'),
    message: issue.message,
    code: issue.code,
  }));
  return thrown(new AppError('VALIDATION_FAILED', `Invalid request ${source}`, { source, issues }));
}

function thrown(error: AppError): never {
  throw error;
}
