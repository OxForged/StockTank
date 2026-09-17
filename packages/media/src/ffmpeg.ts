/**
 * Pure FFmpeg command builders (§13). No I/O here, so every argument list is unit-testable and the worker
 * only executes them. Output layout is fixed so the API can build playback URLs without asking the worker.
 */

export interface ProbeResult {
  durationSeconds: number;
  hasVideo: boolean;
  hasAudio: boolean;
  width: number | null;
  height: number | null;
  videoCodec: string | null;
  audioCodec: string | null;
  formatName: string;
}

interface FfprobeJson {
  format?: { duration?: string; format_name?: string };
  streams?: Array<{ codec_type?: string; codec_name?: string; width?: number; height?: number; duration?: string }>;
}

export const probeArgs = (input: string): string[] => ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', input];

export function parseProbe(json: string): ProbeResult {
  const data = JSON.parse(json) as FfprobeJson;
  const video = data.streams?.find((s) => s.codec_type === 'video' && s.codec_name !== 'mjpeg' && s.codec_name !== 'png');
  const audio = data.streams?.find((s) => s.codec_type === 'audio');
  const duration = Number(data.format?.duration ?? video?.duration ?? audio?.duration ?? 0);
  return {
    durationSeconds: Number.isFinite(duration) ? duration : 0,
    hasVideo: Boolean(video),
    hasAudio: Boolean(audio),
    width: video?.width ?? null,
    height: video?.height ?? null,
    videoCodec: video?.codec_name ?? null,
    audioCodec: audio?.codec_name ?? null,
    formatName: data.format?.format_name ?? '',
  };
}

/** Rejects files whose real content does not match the declared kind, or that are empty/too long. */
export function validateProbe(probe: ProbeResult, kind: 'video' | 'audio', maxDurationSeconds = 6 * 3600): string | null {
  if (probe.durationSeconds <= 0) return 'The file has no playable duration';
  if (probe.durationSeconds > maxDurationSeconds) return 'The file is longer than the 6 hour limit';
  if (kind === 'video' && !probe.hasVideo) return 'Declared as video but no video stream was found';
  if (!probe.hasAudio && kind === 'audio') return 'Declared as audio but no audio stream was found';
  return null;
}

export interface Rendition {
  name: string;
  height: number;
  videoBitrateK: number;
  maxrateK: number;
  bufsizeK: number;
  audioBitrateK: number;
}

/** HLS ladder (§13: 1080p, 720p; plus 480p so slow connections still play). Never upscales. */
export const LADDER: readonly Rendition[] = [
  { name: '1080p', height: 1080, videoBitrateK: 5000, maxrateK: 5350, bufsizeK: 7500, audioBitrateK: 160 },
  { name: '720p', height: 720, videoBitrateK: 2800, maxrateK: 2996, bufsizeK: 4200, audioBitrateK: 128 },
  { name: '480p', height: 480, videoBitrateK: 1400, maxrateK: 1498, bufsizeK: 2100, audioBitrateK: 128 },
];

export function selectLadder(sourceHeight: number | null): Rendition[] {
  if (!sourceHeight) return [];
  const fitting = LADDER.filter((r) => r.height <= sourceHeight);
  // A source smaller than 480p still gets one rendition at its own height (rounded to even).
  return fitting.length > 0 ? fitting : [{ ...LADDER[LADDER.length - 1]!, name: `${sourceHeight}p`, height: sourceHeight - (sourceHeight % 2) }];
}

const SEGMENT_SECONDS = 6;

/** One video rendition as an HLS playlist with fMP4-compatible TS segments. */
export function hlsVideoArgs(input: string, outDir: string, r: Rendition, hasAudio: boolean): string[] {
  return [
    '-hide_banner',
    '-y',
    '-i',
    input,
    '-map',
    '0:v:0',
    ...(hasAudio ? ['-map', '0:a:0'] : []),
    '-vf',
    `scale=-2:${r.height}:flags=lanczos,format=yuv420p`,
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-profile:v',
    'high',
    '-b:v',
    `${r.videoBitrateK}k`,
    '-maxrate',
    `${r.maxrateK}k`,
    '-bufsize',
    `${r.bufsizeK}k`,
    // Keyframes aligned to segment boundaries so every rendition switches cleanly.
    '-force_key_frames',
    `expr:gte(t,n_forced*${SEGMENT_SECONDS})`,
    '-sc_threshold',
    '0',
    ...(hasAudio ? ['-c:a', 'aac', '-b:a', `${r.audioBitrateK}k`, '-ac', '2', '-ar', '48000'] : []),
    '-f',
    'hls',
    '-hls_time',
    String(SEGMENT_SECONDS),
    '-hls_playlist_type',
    'vod',
    '-hls_segment_filename',
    `${outDir}/${r.name}_%05d.ts`,
    `${outDir}/${r.name}.m3u8`,
  ];
}

/** Audio-only HLS rendition, listed in the master playlist for listen mode and poor connections. */
export function hlsAudioArgs(input: string, outDir: string): string[] {
  return [
    '-hide_banner',
    '-y',
    '-i',
    input,
    '-map',
    '0:a:0',
    '-vn',
    '-c:a',
    'aac',
    '-b:a',
    '128k',
    '-ac',
    '2',
    '-ar',
    '48000',
    '-f',
    'hls',
    '-hls_time',
    String(SEGMENT_SECONDS),
    '-hls_playlist_type',
    'vod',
    '-hls_segment_filename',
    `${outDir}/audio_%05d.ts`,
    `${outDir}/audio.m3u8`,
  ];
}

/** Downloadable MP3 (podcast enclosure for Milestone 4 RSS). */
export function mp3Args(input: string, output: string): string[] {
  return ['-hide_banner', '-y', '-i', input, '-map', '0:a:0', '-vn', '-c:a', 'libmp3lame', '-b:a', '128k', '-ac', '2', '-ar', '44100', output];
}

export function posterArgs(input: string, output: string, atSeconds: number): string[] {
  return ['-hide_banner', '-y', '-ss', atSeconds.toFixed(2), '-i', input, '-frames:v', '1', '-vf', 'scale=1280:-2', '-q:v', '3', output];
}

export function masterPlaylist(renditions: Array<{ name: string; height: number; width: number; bandwidth: number }>, includeAudio: boolean): string {
  const lines = ['#EXTM3U', '#EXT-X-VERSION:3'];
  for (const r of renditions) {
    lines.push(`#EXT-X-STREAM-INF:BANDWIDTH=${r.bandwidth},RESOLUTION=${r.width}x${r.height},CODECS="avc1.640028,mp4a.40.2"`, `${r.name}.m3u8`);
  }
  if (includeAudio) {
    lines.push('#EXT-X-STREAM-INF:BANDWIDTH=140000,CODECS="mp4a.40.2"', 'audio.m3u8');
  }
  return `${lines.join('\n')}\n`;
}

export function evenWidthFor(height: number, sourceWidth: number, sourceHeight: number): number {
  const w = Math.round((sourceWidth * height) / sourceHeight);
  return w - (w % 2);
}

// ───────── Clips (§13 vertical + square; §14 source timestamps kept) ─────────

export type ClipShape = 'horizontal' | 'vertical' | 'square';

/**
 * Crop geometry for a centered reframe. Vertical 9:16 and square 1:1 crop the middle of a 16:9 source;
 * the output is then scaled to the delivery size. Subject-aware framing is a later AI clipping upgrade.
 */
export function cropFilter(shape: ClipShape): string {
  switch (shape) {
    case 'vertical':
      return "crop='min(iw,ih*9/16)':'min(ih,iw*16/9)',scale=1080:1920:flags=lanczos,setsar=1,format=yuv420p";
    case 'square':
      return "crop='min(iw,ih)':'min(iw,ih)',scale=1080:1080:flags=lanczos,setsar=1,format=yuv420p";
    default:
      return 'scale=-2:720:flags=lanczos,setsar=1,format=yuv420p';
  }
}

export function clipVideoArgs(input: string, output: string, start: number, end: number, shape: ClipShape, hasAudio: boolean): string[] {
  if (!(end > start)) throw new Error('Clip end must be after start');
  return [
    '-hide_banner',
    '-y',
    '-ss',
    start.toFixed(3),
    '-i',
    input,
    '-t',
    (end - start).toFixed(3),
    '-map',
    '0:v:0',
    ...(hasAudio ? ['-map', '0:a:0'] : []),
    '-vf',
    cropFilter(shape),
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    '21',
    ...(hasAudio ? ['-c:a', 'aac', '-b:a', '128k', '-ac', '2'] : []),
    '-movflags',
    '+faststart',
    output,
  ];
}

export function clipAudioArgs(input: string, output: string, start: number, end: number): string[] {
  if (!(end > start)) throw new Error('Clip end must be after start');
  return ['-hide_banner', '-y', '-ss', start.toFixed(3), '-i', input, '-t', (end - start).toFixed(3), '-map', '0:a:0', '-vn', '-c:a', 'libmp3lame', '-b:a', '128k', output];
}

/** Parses `time=HH:MM:SS.xx` progress from ffmpeg stderr into a 0–100 percentage. */
export function progressFromStderr(chunk: string, totalSeconds: number): number | null {
  const matches = [...chunk.matchAll(/time=(\d+):(\d+):(\d+(?:\.\d+)?)/g)];
  const last = matches[matches.length - 1];
  if (!last || totalSeconds <= 0) return null;
  const seconds = Number(last[1]) * 3600 + Number(last[2]) * 60 + Number(last[3]);
  return Math.max(0, Math.min(100, Math.round((seconds / totalSeconds) * 100)));
}
