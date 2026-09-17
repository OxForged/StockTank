import { create } from 'zustand';

export interface PlayerItem {
  id: string;
  kind: 'episode' | 'clip';
  title: string;
  showTitle: string;
  showSlug: string;
  /** Null until the media pipeline (Milestone 3) attaches HLS/audio renditions. */
  mediaUrl: string | null;
  isDemo: boolean;
}

interface PlayerState {
  current: PlayerItem | null;
  open: (item: PlayerItem) => void;
  close: () => void;
}

/**
 * The persistent mini player's queue. It never simulates playback: without a media URL it
 * shows the item and says plainly that playback is not available yet.
 */
export const usePlayer = create<PlayerState>((set) => ({
  current: null,
  open: (item) => set({ current: item }),
  close: () => set({ current: null }),
}));
