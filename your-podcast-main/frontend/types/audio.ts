export interface Source {
  readonly id: string;
  readonly title: string;
  readonly url: string;
  readonly source: string;
}

export interface Episode {
  readonly id: string;
  readonly title: string;
  readonly keywords: readonly string[];
  readonly coverUrl: string;
  readonly audioUrl: string;
  readonly duration: number;
  readonly isPublic: boolean;
  readonly creatorId: string;
  readonly creatorName: string;
  readonly publishedAt: string;
  readonly color: string;
}

export interface EpisodeWithSources extends Episode {
  readonly sources: readonly Source[];
}

export interface AudioState {
  readonly currentEpisode: Episode | null;
  readonly isPlaying: boolean;
  readonly isLoading: boolean;
  readonly currentTime: number;
  readonly duration: number;
}

export type AudioAction =
  | { readonly type: 'PLAY'; readonly episode: Episode }
  | { readonly type: 'PAUSE' }
  | { readonly type: 'RESUME' }
  | { readonly type: 'STOP' }
  | { readonly type: 'SET_LOADING'; readonly isLoading: boolean }
  | { readonly type: 'SET_TIME'; readonly currentTime: number }
  | { readonly type: 'SET_DURATION'; readonly duration: number };

export interface AudioDispatch {
  play: (episode: Episode) => void;
  pause: () => void;
  resume: () => void;
  toggle: (episode: Episode) => void;
  seek: (time: number) => void;
  skipForward: (seconds?: number) => void;
  skipBack: (seconds?: number) => void;
  stop: () => void;
}
