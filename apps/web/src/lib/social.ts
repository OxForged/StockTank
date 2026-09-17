import { siFacebook, siInstagram, siKick, siTiktok, siTwitch, siX, siYoutube, type SimpleIcon } from 'simple-icons';

/**
 * Social channels for "Follow us". Handles come from VITE_SOCIAL_<PLATFORM> (or VITE_SOCIAL_HANDLE for all),
 * so the site never links to accounts the owner has not set. Icons are the official marks from simple-icons (CC0).
 */
export interface SocialChannel {
  key: string;
  name: string;
  handle: string;
  url: string;
  icon: SimpleIcon;
  /** Brand colour used on hover; the resting state stays on-brand for StockTank. */
  color: string;
}

const PLATFORMS: ReadonlyArray<{ key: string; name: string; icon: SimpleIcon; profile: (h: string) => string }> = [
  { key: 'X', name: 'X', icon: siX, profile: (h) => `https://x.com/${h}` },
  { key: 'KICK', name: 'Kick', icon: siKick, profile: (h) => `https://kick.com/${h}` },
  { key: 'YOUTUBE', name: 'YouTube', icon: siYoutube, profile: (h) => `https://www.youtube.com/@${h}` },
  { key: 'FACEBOOK', name: 'Facebook', icon: siFacebook, profile: (h) => `https://www.facebook.com/${h}` },
  { key: 'INSTAGRAM', name: 'Instagram', icon: siInstagram, profile: (h) => `https://www.instagram.com/${h}` },
  { key: 'TWITCH', name: 'Twitch', icon: siTwitch, profile: (h) => `https://www.twitch.tv/${h}` },
  { key: 'TIKTOK', name: 'TikTok', icon: siTiktok, profile: (h) => `https://www.tiktok.com/@${h}` },
];

const clean = (v: string | undefined) => v?.trim().replace(/^@/, '') || undefined;

export function socialChannels(env: Record<string, string | undefined> = import.meta.env as Record<string, string | undefined>): SocialChannel[] {
  const shared = clean(env.VITE_SOCIAL_HANDLE) ?? 'stocktank';
  return PLATFORMS.flatMap((p) => {
    const raw = env[`VITE_SOCIAL_${p.key}`];
    if (raw !== undefined && raw.trim() === '') return []; // explicitly disabled
    const value = clean(raw) ?? shared;
    const url = /^https?:\/\//i.test(value) ? value : p.profile(value);
    const handle = /^https?:\/\//i.test(value) ? p.name : `@${value}`;
    return [{ key: p.key.toLowerCase(), name: p.name, handle, url, icon: p.icon, color: `#${p.icon.hex}` }];
  });
}
