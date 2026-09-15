import React from 'react';

export const AmbientBackground: React.FC = () => {
  return (
    <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden" aria-hidden="true">
      <video
        className="absolute inset-0 w-full h-full object-cover"
        style={{ filter: 'blur(6px) saturate(1.1) brightness(0.75)' }}
        src="/videos/dashboard-bg.mp4"
        autoPlay
        muted
        loop
        playsInline
      />
      <div className="absolute inset-0" style={{ background: 'rgba(10,16,17,0.85)' }} />
    </div>
  );
};
