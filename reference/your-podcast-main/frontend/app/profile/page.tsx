'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { BottomNav } from '@/components/BottomNav';
import { ChevronRightIcon } from '@/components/icons/ChevronRightIcon';
import { useAudioState } from '@/hooks/useAudioState';
import { useAuth } from '@/hooks/useAuth';
import { useAuthDispatch } from '@/hooks/useAuthDispatch';

function SettingRow({
  label,
  subtitle,
  onClick,
}: {
  readonly label: string;
  readonly subtitle?: string;
  readonly onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between py-4 border-b border-border-warm tap-feedback"
    >
      <div className="text-left">
        <p className="font-serif text-[16px] leading-6 text-[#111]">{label}</p>
        {subtitle && (
          <p className="font-inter text-[12px] text-[#666] mt-0.5">{subtitle}</p>
        )}
      </div>
      <ChevronRightIcon className="size-[18px] text-[#c0c0b5]" />
    </button>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const { currentEpisode } = useAudioState();
  const { status, user } = useAuth();
  const { logout } = useAuthDispatch();
  const hasPlayer = currentEpisode !== null;

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
    }
  }, [status, router]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#111] border-t-transparent" />
      </div>
    );
  }

  if (status === 'unauthenticated' || !user) {
    return null;
  }

  async function handleLogout() {
    await logout();
    router.replace('/login');
  }

  return (
    <div className="min-h-screen bg-cream">
      <main
        className={`mx-auto w-full max-w-[428px] px-6 pt-6 ${hasPlayer ? 'pb-36' : 'pb-24'}`}
      >
        {/* Header */}
        <div className="flex flex-col gap-3 mb-10 animate-fade-in">
          <h1 className="font-serif text-4xl leading-10 text-[#111]">Profile</h1>
          <p className="font-serif italic text-[14px] text-[#666] leading-5 opacity-70">
            Your account &amp; preferences
          </p>
        </div>

        {/* Profile row */}
        <div className="flex w-full items-center gap-4 pb-4 border-b border-border-warm animate-fade-in anim-delay-1">
          <div className="flex-1 min-w-0 text-left">
            <p className="font-serif font-bold text-[16px] leading-5 text-[#111]">{user.name}</p>
            <p className="font-inter text-[12px] text-[#666] mt-1">{user.email}</p>
          </div>
        </div>

        {/* General section */}
        <section className="mt-8 animate-fade-in anim-delay-2">
          <h2 className="font-serif font-bold text-[14px] text-black/60 tracking-[1.4px] uppercase mb-4">
            General
          </h2>
          <SettingRow
            label="Interests"
            subtitle={user.interests.length > 0 ? `${user.interests.length} selected` : 'Set your interests'}
            onClick={() => router.push('/onboarding')}
          />
          <SettingRow label="Help & FAQ" onClick={() => router.push('/help')} />
        </section>

        {/* Log Out */}
        <div className="mt-12 flex justify-center animate-fade-in anim-delay-3">
          <button
            type="button"
            onClick={handleLogout}
            className="font-serif text-[14px] text-[#c07060] tap-feedback"
          >
            Log Out
          </button>
        </div>

        {/* Version */}
        <p className="mt-4 text-center font-inter text-[10px] text-[#ccc] tracking-[0.5px] animate-fade-in anim-delay-3">
          v0.1.0
        </p>
      </main>

      <BottomNav />
    </div>
  );
}
