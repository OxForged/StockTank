'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useAuthDispatch } from '@/hooks/useAuthDispatch';
import { devLogin, isLocalDev } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const { status } = useAuth();
  const { login } = useAuthDispatch();
  const [devLoading, setDevLoading] = useState(false);
  const [devError, setDevError] = useState('');
  const showDevLogin = useSyncExternalStore(
    () => () => { },
    () => isLocalDev(),
    () => false,
  );

  const [reducedMotion, setReducedMotion] = useState(false);
  const [showAnimations, setShowAnimations] = useState(true);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      t = setTimeout(() => {
        setReducedMotion(true);
        setShowAnimations(false);
      }, 0);
    } else {
      t = setTimeout(() => setShowAnimations(false), 3000);
    }
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/explore');
    }
  }, [status, router]);

  if (status === 'loading' || status === 'authenticated') {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-cream">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#111] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh justify-center bg-cream pt-[80px] sm:items-center sm:px-6 sm:pt-0">
      <div className="relative w-full max-w-[393px] px-6 py-20 sm:rounded-2xl sm:shadow-[0px_0px_0px_1px_rgba(224,224,216,0.5),0px_25px_50px_-12px_rgba(0,0,0,0.05)]" style={{ overflow: showAnimations && !reducedMotion ? 'visible' : 'hidden' }}>

        {/* Real Content container */}
        <div className="relative flex flex-col pointer-events-none" style={{ zIndex: 30 }}>
          {/* Logo */}
          <div className="mb-12 flex items-center justify-center pointer-events-auto" style={{ animation: !reducedMotion ? 'scale-in 0.8s 100ms cubic-bezier(0.16,1,0.3,1) both' : 'none' }}>
            <span
              className="font-serif text-2xl font-bold uppercase leading-[32px] tracking-[-1.2px] text-[#111]"
              style={{ animation: !reducedMotion ? 'tracking-reveal 1.2s 200ms cubic-bezier(0.16,1,0.3,1) both' : 'none' }}
            >
              Your
            </span>
            <div className="relative mx-1">
              {!reducedMotion && (
                <>
                  <div className="absolute inset-0 rounded-full bg-[#111]/25" style={{ animation: 'pulse-ripple 3s 0s ease-out infinite' }} />
                  <div className="absolute inset-0 rounded-full bg-[#111]/20" style={{ animation: 'pulse-ripple 3s 1s ease-out infinite' }} />
                  <div className="absolute inset-0 rounded-full bg-[#111]/15" style={{ animation: 'pulse-ripple 3s 2s ease-out infinite' }} />
                </>
              )}
              <span className="relative flex h-6 w-6 items-center justify-center rounded-full border-[1px] border-[#111] bg-cream z-10 transition-transform hover:scale-105">
                <span className="text-[10px] leading-none">&#x1F399;&#xFE0F;</span>
              </span>
            </div>
            <span
              className="font-serif text-2xl font-bold uppercase leading-[32px] tracking-[-1.2px] text-[#111]"
              style={{ animation: !reducedMotion ? 'tracking-reveal 1.2s 400ms cubic-bezier(0.16,1,0.3,1) both' : 'none' }}
            >
              Podcast
            </span>
          </div>

          <div className="pointer-events-auto">
            {/* Heading */}
            <h1
              className="mb-4 text-center font-serif text-4xl leading-[40px] text-[#111]"
              style={{ animation: !reducedMotion && showAnimations ? 'fade-in 1s 800ms cubic-bezier(0.16,1,0.3,1) both' : 'none' }}
            >
              Welcome
            </h1>
            <p
              className="mx-auto mb-12 max-w-[260px] text-center font-serif italic text-base leading-[26px] text-[#111]/60"
              style={{ animation: !reducedMotion && showAnimations ? 'fade-in 1s 1100ms cubic-bezier(0.16,1,0.3,1) both' : 'none' }}
            >
              Your daily podcast, curated just for you.
            </p>

            <div style={{ animation: !reducedMotion && showAnimations ? 'fade-in 1s 1400ms cubic-bezier(0.16,1,0.3,1) both' : 'none' }}>
              {/* Divider */}
              <div className="relative mb-6 flex items-center">
                <div className="flex-1 border-t border-border-warm" />
                <span className="bg-cream px-4 font-inter text-[10px] uppercase leading-[15px] tracking-[1px] text-[#666]">
                  Sign in with
                </span>
                <div className="flex-1 border-t border-border-warm" />
              </div>

              {/* Google button */}
              <button
                type="button"
                onClick={() => login('google')}
                className="mb-3 flex h-[56px] w-full items-center justify-between rounded-[10px] border border-border-warm px-[25px] tap-feedback transition-colors hover:bg-white bg-cream"
              >
                <span className="font-serif text-lg leading-[28px] text-[#111]">
                  Continue with Google
                </span>
                <span className="font-inter text-xl font-bold text-[#111]">G</span>
              </button>

              {/* Dev login — only visible in local development */}
              {showDevLogin && (
                <>
                  <div className="relative mt-6 flex items-center">
                    <div className="flex-1 border-t border-border-warm" />
                    <span className="bg-cream px-4 font-inter text-[10px] uppercase leading-[15px] tracking-[1px] text-[#666]">
                      Dev only
                    </span>
                    <div className="flex-1 border-t border-border-warm" />
                  </div>
                  <button
                    type="button"
                    disabled={devLoading}
                    onClick={async () => {
                      setDevLoading(true);
                      setDevError('');
                      try {
                        await devLogin();
                        window.location.href = '/explore';
                      } catch (err) {
                        setDevError(err instanceof Error ? err.message : 'Dev login failed — is the backend running?');
                        setDevLoading(false);
                      }
                    }}
                    className="mt-3 flex h-[56px] w-full items-center justify-between rounded-[10px] border border-dashed border-[#c0c0b5] px-[25px] tap-feedback transition-colors hover:bg-[#f5f5ed]"
                  >
                    <span className="font-serif text-lg leading-[28px] text-[#666]">
                      {devLoading ? 'Logging in...' : 'Dev Login (Seed User)'}
                    </span>
                    <span className="font-inter text-base text-[#666]">~</span>
                  </button>
                  {devError && (
                    <p className="mt-2 text-center font-inter text-[12px] text-[#c07060]">{devError}</p>
                  )}
                </>
              )}

              {/* Footer */}
              <div className="mt-8 flex items-center justify-center gap-2 font-inter">
                <Link href="/privacy" className="text-[10px] leading-[15px] text-[#666] hover:text-[#111]">
                  Privacy Policy
                </Link>
                <span className="text-[10px] leading-[15px] text-[#666]">|</span>
                <Link href="/terms" className="text-[10px] leading-[15px] text-[#666] hover:text-[#111]">
                  Terms of Service
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
