import React from 'react';

export const AVATAR_PRESETS = [
  {
    id: 'preset_amber',
    name: 'Amber Spark',
    gradient: 'from-amber-400 via-amber-500 to-amber-600',
    svg: (
      <svg viewBox="0 0 36 36" fill="none" className="w-full h-full">
        <circle cx="18" cy="18" r="18" fill="url(#amber_grad)" />
        <circle cx="18" cy="14" r="6" fill="#08090A" />
        <path d="M7 30c0-6 5-10 11-10s11 4 11 10" fill="#08090A" />
        <defs>
          <linearGradient id="amber_grad" x1="0" y1="0" x2="36" y2="36">
            <stop stopColor="#F59E0B" />
            <stop offset="1" stopColor="#D97706" />
          </linearGradient>
        </defs>
      </svg>
    ),
  },
  {
    id: 'preset_teal',
    name: 'Teal Cyber',
    gradient: 'from-teal-400 via-emerald-500 to-teal-600',
    svg: (
      <svg viewBox="0 0 36 36" fill="none" className="w-full h-full">
        <circle cx="18" cy="18" r="18" fill="url(#teal_grad)" />
        <rect x="12" y="10" width="12" height="10" rx="3" fill="#08090A" />
        <path d="M8 30c0-5 4.5-8 10-8s10 3 10 8" fill="#08090A" />
        <defs>
          <linearGradient id="teal_grad" x1="0" y1="0" x2="36" y2="36">
            <stop stopColor="#14B8A6" />
            <stop offset="1" stopColor="#0D9488" />
          </linearGradient>
        </defs>
      </svg>
    ),
  },
  {
    id: 'preset_purple',
    name: 'Purple Matrix',
    gradient: 'from-purple-400 via-indigo-500 to-purple-700',
    svg: (
      <svg viewBox="0 0 36 36" fill="none" className="w-full h-full">
        <circle cx="18" cy="18" r="18" fill="url(#purple_grad)" />
        <circle cx="18" cy="13" r="5" fill="#08090A" />
        <path d="M9 29c0-5 4-8 9-8s9 3 9 8" fill="#08090A" />
        <defs>
          <linearGradient id="purple_grad" x1="0" y1="0" x2="36" y2="36">
            <stop stopColor="#A855F7" />
            <stop offset="1" stopColor="#6B21A8" />
          </linearGradient>
        </defs>
      </svg>
    ),
  },
];

interface UserAvatarProps {
  name: string;
  avatarUrl?: string;
  size?: number; // size in px (e.g. 40)
  className?: string;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  name,
  avatarUrl,
  size = 40,
  className = '',
}) => {
  const getInitials = (n: string) => {
    if (!n) return 'CR';
    const parts = n.trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return n.slice(0, 2).toUpperCase();
  };

  const selectedPreset = AVATAR_PRESETS.find((p) => p.id === avatarUrl);

  if (selectedPreset) {
    return (
      <div
        className={`rounded-full border border-amber/40 overflow-hidden shrink-0 shadow-sm ${className}`}
        style={{ width: size, height: size }}
      >
        {selectedPreset.svg}
      </div>
    );
  }

  if (avatarUrl && avatarUrl.startsWith('http')) {
    return (
      <img
        src={avatarUrl}
        alt={`${name}'s avatar`}
        className={`rounded-full object-cover border border-amber/40 shrink-0 shadow-sm ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  // High-quality vector initials avatar with gradient ring
  const initials = getInitials(name);
  return (
    <div
      className={`rounded-full bg-gradient-to-br from-amber/20 via-canvas to-amber/10 border border-amber/40 flex items-center justify-center font-display font-bold text-amber shrink-0 shadow-sm ${className}`}
      style={{ width: size, height: size, fontSize: Math.max(12, size * 0.38) }}
    >
      {initials}
    </div>
  );
};
