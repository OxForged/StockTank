'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { Episode } from '@/types/audio';
import { BottomNav } from '@/components/BottomNav';
import { EpisodeRow } from '@/components/EpisodeRow';
import { useAudioState } from '@/hooks/useAudioState';
import { useAudioDispatch } from '@/hooks/useAudioDispatch';
import { useAuth } from '@/hooks/useAuth';
import { ApiError, fetchMyEpisodes, generateEpisode, fetchTaskStatus } from '@/lib/api';
import { formatDate, formatDuration } from '@/lib/format';

type LoadState = 'loading' | 'loaded' | 'error';
type GenerateState = 'idle' | 'starting' | 'generating' | 'done' | 'error';

const POLL_INTERVAL_MS = 3000;

const PROGRESS_LABELS: Record<string, string> = {
  queued: 'Queued...',
  starting: 'Starting...',
  fetching_rss: 'Fetching news...',
  filtering_articles: 'Selecting articles...',
  generating_script: 'Writing script...',
  synthesizing_tts: 'Generating audio...',
  merging_audio: 'Merging audio...',
  generating_cover: 'Creating cover...',
  uploading: 'Uploading...',
  saving: 'Saving...',
  done: 'Done!',
};

export default function ShowsPage() {
  const [episodes, setEpisodes] = useState<readonly Episode[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [generateState, setGenerateState] = useState<GenerateState>('idle');
  const [progressText, setProgressText] = useState('');
  const { currentEpisode, isPlaying } = useAudioState();
  const { toggle, play } = useAudioDispatch();
  const { status, user } = useAuth();
  const router = useRouter();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const hasPlayer = currentEpisode !== null;

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
    }
  }, [status, router]);

  const loadEpisodes = useCallback(() => {
    if (status !== 'authenticated') return;
    fetchMyEpisodes()
      .then((result) => {
        setEpisodes(result.episodes);
        setLoadState('loaded');
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          router.replace('/login');
          return;
        }
        setLoadState('error');
      });
  }, [status, router]);

  useEffect(() => {
    loadEpisodes();
  }, [loadEpisodes]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
      }
    };
  }, []);

  function handleGenerate() {
    setGenerateState('starting');
    setProgressText('Starting...');

    generateEpisode(user?.interests)
      .then((res) => {
        setGenerateState('generating');
        pollRef.current = setInterval(() => {
          fetchTaskStatus(res.task_id)
            .then((task) => {
              setProgressText(PROGRESS_LABELS[task.progress] ?? task.progress);

              if (task.status === 'completed') {
                if (pollRef.current) {
                  clearInterval(pollRef.current);
                  pollRef.current = null;
                }
                setGenerateState('done');
                setProgressText('Done!');
                loadEpisodes();
                // Reset to idle after a brief delay
                setTimeout(() => {
                  setGenerateState('idle');
                  setProgressText('');
                }, 2000);
              } else if (task.status === 'failed') {
                if (pollRef.current) {
                  clearInterval(pollRef.current);
                  pollRef.current = null;
                }
                setGenerateState('error');
                setProgressText(task.progress);
              }
            })
            .catch(() => {
              // Polling error — keep trying
            });
        }, POLL_INTERVAL_MS);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 409) {
          setGenerateState('generating');
          setProgressText('Generation already in progress...');
        } else {
          setGenerateState('error');
          setProgressText('Failed to start generation');
        }
      });
  }

  const isGenerating = generateState === 'starting' || generateState === 'generating';

  return (
    <div className="min-h-screen bg-cream">
      <main className={`mx-auto w-full max-w-[428px] px-6 pt-6 ${hasPlayer ? 'pb-36' : 'pb-24'}`}>
        {/* Header */}
        <div className="flex items-start justify-between mb-10 animate-fade-in">
          <div className="flex flex-col gap-3">
            <h1 className="font-serif text-4xl leading-10 text-[#111]">Daily Podcast</h1>
            <p className="font-serif italic text-[14px] text-[#666] leading-5 opacity-70">
              AI-generated podcasts based on your interests
            </p>
          </div>
          {loadState === 'loaded' && (
            <button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating || generateState === 'done'}
              aria-label="Generate new podcast"
              className={`shrink-0 mt-1 size-10 rounded-full flex items-center justify-center transition-all duration-200 ${
                isGenerating
                  ? 'bg-[#e5e5e0] cursor-not-allowed'
                  : generateState === 'done'
                    ? 'bg-green-100 cursor-not-allowed'
                    : generateState === 'error'
                      ? 'bg-red-50 hover:bg-red-100 active:scale-90'
                      : 'bg-[#111] hover:bg-[#333] active:scale-90'
              }`}
            >
              {isGenerating ? (
                <span className="size-4 border-2 border-[#999] border-t-transparent rounded-full animate-spin" />
              ) : generateState === 'done' ? (
                <svg className="size-5 text-green-700" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
              ) : (
                <svg className={`size-5 ${generateState === 'error' ? 'text-red-600' : 'text-white'}`} viewBox="0 0 20 20" fill="currentColor"><path d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" /></svg>
              )}
            </button>
          )}
        </div>
        {isGenerating && progressText && (
          <p className="font-inter text-xs text-[#999] text-center -mt-6 mb-6 animate-fade-in">{progressText}</p>
        )}
        {generateState === 'error' && progressText && (
          <p className="font-inter text-xs text-red-500 text-center -mt-6 mb-6 animate-fade-in">{progressText}</p>
        )}

        {/* Content */}
        {loadState === 'loading' && (
          <div className="flex flex-col gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex gap-4 items-start pb-4 animate-pulse">
                <div className="size-20 shrink-0 rounded-[10px] bg-[#e5e5e0]" />
                <div className="flex-1 pt-1 space-y-2">
                  <div className="h-4 w-3/4 rounded bg-[#e5e5e0]" />
                  <div className="h-3 w-1/2 rounded bg-[#e5e5e0]" />
                  <div className="h-3 w-1/3 rounded bg-[#e5e5e0]" />
                </div>
              </div>
            ))}
          </div>
        )}

        {loadState === 'error' && (
          <p className="font-inter text-sm text-[#666] text-center py-16 animate-fade-in">
            Failed to load podcasts.
          </p>
        )}

        {loadState === 'loaded' && episodes.length === 0 && !isGenerating && (
          <p className="font-inter text-sm text-[#666] text-center py-16 animate-fade-in">
            No podcasts yet. Generate your first one!
          </p>
        )}

        {loadState === 'loaded' && episodes.length > 0 && (
          <section>
            <div className="flex flex-col gap-4">
              {episodes.map((ep, index) => (
                <EpisodeRow
                  key={ep.id}
                  title={ep.title}
                  keywords={ep.keywords}
                  creatorName={formatDate(ep.publishedAt)}
                  duration={formatDuration(ep.duration)}
                  coverUrl={ep.coverUrl}
                  color={ep.color}
                  isPlaying={currentEpisode?.id === ep.id && isPlaying}
                  onPlay={() => toggle(ep)}
                  onTap={() => {
                    play(ep);
                    router.push(`/episode/${ep.id}`);
                  }}
                  className="animate-list-item"
                  style={{ animationDelay: `${200 + index * 60}ms` }}
                />
              ))}
            </div>
          </section>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
