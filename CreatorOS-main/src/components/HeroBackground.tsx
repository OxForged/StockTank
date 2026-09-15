import React from 'react';

export const HeroBackground: React.FC = () => {
  return (
    <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden" aria-hidden="true">
      <div
        className="absolute inset-0 bg-cover bg-center animate-kenburns"
        style={{ backgroundImage: 'url(/images/hero-bg.png)', filter: 'blur(26px) saturate(0.9)' }}
      />
      <div className="absolute inset-0" style={{ background: 'rgba(8,9,10,0.75)' }} />
    </div>
  );
};
