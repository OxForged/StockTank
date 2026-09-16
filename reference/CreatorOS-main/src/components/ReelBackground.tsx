import React from 'react';

export const ReelBackground: React.FC<{ opacity?: number }> = ({ opacity = 0.3 }) => {
  return (
    <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none" aria-hidden="true">
      <video
        className="absolute inset-0 w-full h-full object-cover"
        style={{ filter: 'grayscale(1) brightness(0.6) contrast(1.15)', opacity }}
        src="/videos/reel-bg.mp4"
        autoPlay
        muted
        loop
        playsInline
      />
      <div className="absolute inset-0" style={{ background: '#1F8C99', mixBlendMode: 'color', opacity: 0.85 }} />
      <div className="absolute inset-0 bg-canvas/70" />
    </div>
  );
};
