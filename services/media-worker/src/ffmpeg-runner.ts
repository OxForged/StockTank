import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

export interface Tools {
  ffmpeg: string;
  ffprobe: string;
}

/**
 * Resolves binaries: FFMPEG_PATH/FFPROBE_PATH (the production image installs distro ffmpeg), otherwise the
 * ffmpeg-static/ffprobe-static dev dependencies so local development needs no system install.
 */
export function resolveTools(env: Record<string, string | undefined> = process.env): Tools {
  const require = createRequire(import.meta.url);
  const fromPackage = (name: string, pick: (mod: unknown) => unknown): string | null => {
    try {
      const value = pick(require(name));
      return typeof value === 'string' ? value : null;
    } catch {
      return null;
    }
  };
  const ffmpeg = env.FFMPEG_PATH || fromPackage('ffmpeg-static', (m) => m) || 'ffmpeg';
  const ffprobe = env.FFPROBE_PATH || fromPackage('ffprobe-static', (m) => (m as { path?: string }).path) || 'ffprobe';
  return { ffmpeg, ffprobe };
}

export class ToolError extends Error {
  constructor(
    message: string,
    readonly stderrTail: string,
  ) {
    super(message);
    this.name = 'ToolError';
  }
}

/** Runs a binary with an argument array (never a shell string), collecting stdout and streaming stderr. */
export function runTool(bin: string, args: string[], opts: { onStderr?: (chunk: string) => void; timeoutMs?: number } = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    let stdout = '';
    let stderrTail = '';
    const timer = opts.timeoutMs
      ? setTimeout(() => {
          child.kill('SIGKILL');
        }, opts.timeoutMs)
      : null;
    child.stdout.setEncoding('utf8').on('data', (d: string) => {
      stdout += d;
    });
    child.stderr.setEncoding('utf8').on('data', (d: string) => {
      stderrTail = (stderrTail + d).slice(-4000);
      opts.onStderr?.(d);
    });
    child.on('error', (err) => {
      if (timer) clearTimeout(timer);
      reject(err);
    });
    child.on('close', (code, signal) => {
      if (timer) clearTimeout(timer);
      if (code === 0) resolve(stdout);
      else reject(new ToolError(`${bin.split(/[\\/]/).pop()} exited with ${code ?? signal}`, stderrTail));
    });
  });
}
