import { create } from 'zustand';

export interface PlayerMedia {
  hlsUrl: string | null;
  audioUrl: string | null;
  posterUrl: string | null;
}

export interface PlayerItem {
  id: string;
  kind: 'episode' | 'clip';
  title: string;
  showTitle: string;
  showSlug: string;
  /** Used to link back and to look up media when the opener did not have it. */
  episodeSlug: string;
  isDemo: boolean;
  /**
   * Known media. `undefined` means "look it up from the episode"; `null` means the item has no playable media.
   */
  media?: PlayerMedia | null;
  /** Clip bounds within the source media, in seconds. */
  startAt?: number;
  endAt?: number;
}

interface PlayerState {
  current: PlayerItem | null;
  open: (item: PlayerItem) => void;
  close: () => void;
}

/**
 * The persistent mini player's current item. It never simulates playback: items without processed media
 * are shown with a plain "not available" state.
 */
export const usePlayer = create<PlayerState>((set) => ({
  current: null,
  open: (item) => set({ current: item }),
  close: () => set({ current: null }),
}));
