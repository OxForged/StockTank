import React from 'react';

interface OrbitMarkProps {
  size?: number;
  animate?: boolean;
}

export const OrbitMark: React.FC<OrbitMarkProps> = ({ size = 40, animate = true }) => {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" role="img" aria-label="CreatorOS">
      <defs>
        <radialGradient id="core" cx="35%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#FFD27A" />
          <stop offset="55%" stopColor="#E8A339" />
          <stop offset="100%" stopColor="#B8791F" />
        </radialGradient>
        <radialGradient id="sat" cx="35%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#FFDA9A" />
          <stop offset="100%" stopColor="#D4901F" />
        </radialGradient>
      </defs>
      <g transform="translate(60,64)">
        <g className={animate ? 'animate-[spin_18s_linear_infinite]' : ''} style={{ transformOrigin: '0px 0px' }}>
          <ellipse cx="0" cy="0" rx="46" ry="28" fill="none" stroke="#E8A339" strokeOpacity="0.35" strokeWidth="1" transform="rotate(-18)" />
          <g stroke="#E8A339" strokeOpacity="0.55" strokeWidth="1" transform="rotate(-18)">
            <line x1="0" y1="0" x2="-6" y2="-28" />
            <line x1="0" y1="0" x2="40" y2="-12" />
            <line x1="0" y1="0" x2="6" y2="27" />
          </g>
          <g transform="rotate(-18)">
            <circle cx="-6" cy="-28" r="4.5" fill="url(#sat)" />
            <circle cx="40" cy="-12" r="3.5" fill="url(#sat)" />
            <circle cx="6" cy="27" r="3.5" fill="url(#sat)" />
          </g>
        </g>
        <circle cx="0" cy="0" r="12.5" fill="url(#core)" />
      </g>
    </svg>
  );
};
