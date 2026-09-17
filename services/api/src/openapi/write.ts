/**
 * Writes the generated OpenAPI document to docs/api/openapi.json.
 * Run with `pnpm --filter @stocktank/api openapi`. Needs no database or env.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { buildOpenApiDocument } from './document.js';

async function packageVersion(): Promise<string> {
  const raw = await readFile(path.resolve(import.meta.dirname, '../../package.json'), 'utf8');
  const parsed: unknown = JSON.parse(raw);
  if (parsed && typeof parsed === 'object' && typeof (parsed as { version?: unknown }).version === 'string') {
    return (parsed as { version: string }).version;
  }
  throw new Error('package.json has no version');
}

async function main(): Promise<void> {
  const version = process.env.APP_VERSION?.trim() || (await packageVersion());
  const document = buildOpenApiDocument({ version });
  const outFile = path.resolve(import.meta.dirname, '../../../../docs/api/openapi.json');
  await mkdir(path.dirname(outFile), { recursive: true });
  await writeFile(outFile, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
  const pathCount = Object.keys(document.paths ?? {}).length;
  const schemaCount = Object.keys(document.components?.schemas ?? {}).length;
  console.log(`Wrote ${path.relative(process.cwd(), outFile)} (${pathCount} paths, ${schemaCount} schemas)`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
