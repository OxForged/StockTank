import { describe, expect, it } from 'vitest';
import {
  clipAudioArgs,
  clipVideoArgs,
  cropFilter,
  evenWidthFor,
  hlsVideoArgs,
  LADDER,
  masterPlaylist,
  parseProbe,
  progressFromStderr,
  selectLadder,
  validateProbe,
} from './ffmpeg.js';
import { ACCEPTED_MEDIA, acceptedMimeSchema, jobIdFor, keys, mediaJobSchema } from './jobs.js';
import { isStorageConfigured, loadMediaEnv } from './config.js';

const probeJson = JSON.stringify({
  format: { duration: '125.4', format_name: 'mov,mp4,m4a,3gp,3g2,mj2' },
  streams: [
    { codec_type: 'video', codec_name: 'h264', width: 1920, height: 1080 },
    { codec_type: 'audio', codec_name: 'aac' },
  ],
});

describe('probe', () => {
  it('parses ffprobe json', () => {
    const p = parseProbe(probeJson);
    expect(p).toMatchObject({ durationSeconds: 125.4, hasVideo: true, hasAudio: true, width: 1920, height: 1080, videoCodec: 'h264' });
  });

  it('ignores cover art streams when deciding if audio has video', () => {
    const p = parseProbe(JSON.stringify({ format: { duration: '10' }, streams: [{ codec_type: 'audio' }, { codec_type: 'video', codec_name: 'mjpeg' }] }));
    expect(p.hasVideo).toBe(false);
  });

  it('rejects mismatched or empty media', () => {
    const p = parseProbe(probeJson);
    expect(validateProbe(p, 'video')).toBeNull();
    expect(validateProbe({ ...p, hasVideo: false }, 'video')).toMatch(/no video/);
    expect(validateProbe({ ...p, hasAudio: false }, 'audio')).toMatch(/no audio/);
    expect(validateProbe({ ...p, durationSeconds: 0 }, 'video')).toMatch(/duration/);
    expect(validateProbe({ ...p, durationSeconds: 7 * 3600 }, 'video')).toMatch(/6 hour/);
  });
});

describe('ladder', () => {
  it('never upscales', () => {
    expect(selectLadder(1080).map((r) => r.name)).toEqual(['1080p', '720p', '480p']);
    expect(selectLadder(720).map((r) => r.name)).toEqual(['720p', '480p']);
    expect(selectLadder(null)).toEqual([]);
  });

  it('keeps one rendition for small sources', () => {
    expect(selectLadder(361)).toEqual([expect.objectContaining({ name: '361p', height: 360 })]);
  });

  it('computes even widths', () => {
    expect(evenWidthFor(720, 1920, 1080)).toBe(1280);
    expect(evenWidthFor(480, 1920, 1080)).toBe(852);
  });
});

describe('hls', () => {
  it('builds aligned-keyframe HLS args', () => {
    const args = hlsVideoArgs('in.mp4', 'out', LADDER[1]!, true);
    expect(args).toContain('scale=-2:720:flags=lanczos,format=yuv420p');
    expect(args).toContain('expr:gte(t,n_forced*6)');
    expect(args.at(-1)).toBe('out/720p.m3u8');
    expect(args).toContain('0:a:0');
  });

  it('omits audio mapping for silent video', () => {
    expect(hlsVideoArgs('in.mp4', 'out', LADDER[0]!, false)).not.toContain('0:a:0');
  });

  it('writes a master playlist with an audio-only variant', () => {
    const m = masterPlaylist([{ name: '720p', height: 720, width: 1280, bandwidth: 3_000_000 }], true);
    expect(m).toContain('#EXT-X-STREAM-INF:BANDWIDTH=3000000,RESOLUTION=1280x720');
    expect(m).toContain('720p.m3u8');
    expect(m).toContain('audio.m3u8');
    expect(m.startsWith('#EXTM3U\n')).toBe(true);
  });
});

describe('clips', () => {
  it('crops to vertical and square', () => {
    expect(cropFilter('vertical')).toContain('scale=1080:1920');
    expect(cropFilter('square')).toContain('scale=1080:1080');
    expect(cropFilter('horizontal')).toContain('scale=-2:720');
  });

  it('cuts by source timestamps', () => {
    const args = clipVideoArgs('in.mp4', 'v.mp4', 12.5, 42, 'vertical', true);
    expect(args.slice(2, 4)).toEqual(['-ss', '12.500']);
    expect(args[args.indexOf('-t') + 1]).toBe('29.500');
    expect(clipAudioArgs('in.mp4', 'a.mp3', 1, 2)).toContain('libmp3lame');
  });

  it('refuses inverted ranges', () => {
    expect(() => clipVideoArgs('in', 'out', 5, 5, 'square', true)).toThrow();
    expect(() => clipAudioArgs('in', 'out', 9, 2)).toThrow();
  });
});

describe('progress', () => {
  it('uses the last time marker', () => {
    expect(progressFromStderr('frame=1 time=00:00:10.00 x time=00:00:30.00', 60)).toBe(50);
    expect(progressFromStderr('time=01:00:00.00', 60)).toBe(100);
    expect(progressFromStderr('no marker', 60)).toBeNull();
  });
});

describe('jobs and config', () => {
  it('validates job payloads and accepted mime types', () => {
    expect(mediaJobSchema.parse({ type: 'transcode', assetId: 'a1' })).toEqual({ type: 'transcode', assetId: 'a1' });
    expect(() => mediaJobSchema.parse({ type: 'delete-everything' })).toThrow();
    expect(acceptedMimeSchema.safeParse('video/webm').success).toBe(false);
    expect(ACCEPTED_MEDIA['audio/mpeg'].kind).toBe('audio');
  });

  it('uses deterministic job ids and stable keys', () => {
    expect(jobIdFor({ type: 'transcode', assetId: 'x' }, 2)).toBe('transcode-x-2');
    expect(keys.original('x', 'mov')).toBe('originals/x/source.mov');
    expect(keys.hlsMaster('x')).toBe('renditions/x/hls/master.m3u8');
  });

  it('reports storage configuration', () => {
    expect(isStorageConfigured(loadMediaEnv({}))).toBe(false);
    const env = loadMediaEnv({
      S3_ENDPOINT: 'http://localhost:9000',
      S3_ACCESS_KEY: 'k',
      S3_SECRET_KEY: 's',
      MEDIA_PUBLIC_BASE_URL: 'http://localhost:9000/stocktank-media',
    });
    expect(isStorageConfigured(env)).toBe(true);
    expect(env.MEDIA_MAX_UPLOAD_MB).toBe(4096);
  });
});
