import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { OrbitMark } from './OrbitMark';

export const Nav: React.FC = () => {
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-40 backdrop-blur-md bg-canvas/70 border-b border-border2">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5">
          <OrbitMark size={28} animate={false} />
          <span className="font-display text-[15px] tracking-tight">
            Creator<span className="text-amber font-semibold">OS</span>
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-8 text-sm text-slate-400">
          <a href="#how-it-works" className="hover:text-slate-100 transition-colors">How it works</a>
          <a href="#agents" className="hover:text-slate-100 transition-colors">Agents</a>
        </nav>

        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-1.5 text-xs font-semibold bg-amber text-[#08090A] px-4 py-2 rounded-xl hover:bg-amber-soft transition-colors shadow-sm"
          >
            <span>Open Dashboard</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
};
