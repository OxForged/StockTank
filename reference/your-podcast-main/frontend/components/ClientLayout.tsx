'use client';

import { ViewTransition } from 'react';
import type { ReactNode } from 'react';
import { AuthProvider } from '@/contexts/AuthContext';
import { AudioProvider } from '@/contexts/AudioContext';

interface ClientLayoutProps {
  readonly children: ReactNode;
}

export function ClientLayout({ children }: ClientLayoutProps) {
  return (
    <AuthProvider>
      <AudioProvider>
        <ViewTransition>{children}</ViewTransition>
      </AudioProvider>
    </AuthProvider>
  );
}
