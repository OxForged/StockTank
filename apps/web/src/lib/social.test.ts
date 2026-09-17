import { describe, expect, it } from 'vitest';

import { socialChannels } from './social';

describe('socialChannels', () => {
  it('builds every platform from one handle, with official marks', () => {
    const channels = socialChannels({ VITE_SOCIAL_HANDLE: '@StockTankTV' });
    expect(channels.map((c) => c.name)).toEqual(['X', 'Kick', 'YouTube', 'Facebook', 'Instagram', 'Twitch', 'TikTok']);
    expect(channels.find((c) => c.name === 'YouTube')?.url).toBe('https://www.youtube.com/@StockTankTV');
    expect(channels.find((c) => c.name === 'X')?.handle).toBe('@StockTankTV');
    expect(channels.every((c) => c.icon.path.length > 20 && /^#[0-9A-F]{6}$/.test(c.color))).toBe(true);
  });

  it('accepts per-platform overrides, full URLs, and hides platforms set to empty', () => {
    const channels = socialChannels({ VITE_SOCIAL_HANDLE: 'stocktank', VITE_SOCIAL_KICK: '', VITE_SOCIAL_TIKTOK: 'https://www.tiktok.com/@stocktank.tv', VITE_SOCIAL_X: 'stocktank_tv' });
    expect(channels.some((c) => c.name === 'Kick')).toBe(false);
    expect(channels.find((c) => c.name === 'TikTok')).toMatchObject({ url: 'https://www.tiktok.com/@stocktank.tv', handle: 'TikTok' });
    expect(channels.find((c) => c.name === 'X')?.url).toBe('https://x.com/stocktank_tv');
  });
});
