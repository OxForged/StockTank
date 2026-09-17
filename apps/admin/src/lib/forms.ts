export type FieldErrors<T extends string = string> = Partial<Record<T, string>>;

interface IssueLike {
  path: PropertyKey[];
  message: string;
}

/** Structural subset of a Zod schema, so the app does not need a direct zod dependency. */
export interface SchemaLike<T> {
  safeParse(
    input: unknown,
  ): { success: true; data: T } | { success: false; error: { issues: ReadonlyArray<IssueLike> } };
}

/** Run a schema and return either parsed data or a flat map of the first error per field. */
export function validate<T>(
  schema: SchemaLike<T>,
  input: unknown,
): { ok: true; data: T } | { ok: false; errors: FieldErrors } {
  const result = schema.safeParse(input);
  if (result.success) return { ok: true, data: result.data };
  const errors: FieldErrors = {};
  for (const issue of result.error.issues) {
    const key = String(issue.path[0] ?? '_form');
    if (!errors[key]) errors[key] = issue.message;
  }
  return { ok: false, errors };
}

export function formValues(form: HTMLFormElement): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of new FormData(form).entries()) out[k] = typeof v === 'string' ? v : '';
  return out;
}
