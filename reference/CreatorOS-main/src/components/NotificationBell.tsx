import React, { useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { AppNotification } from '../context/DashboardContext';

interface NotificationBellProps {
  notifications: AppNotification[];
}

export const NotificationBell: React.FC<NotificationBellProps> = ({ notifications }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative text-slate-400 hover:text-slate-100 transition-colors"
        aria-label="Notifications"
      >
        <Bell size={18} />
        {notifications.length > 0 && <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber" />}
      </button>
      {open && (
        <div className="absolute right-0 mt-3 w-80 rounded-xl border border-border2-strong bg-panel-strong shadow-lg z-20 overflow-hidden">
          <div className="px-4 py-3 border-b border-border2">
            <p className="text-sm font-medium text-slate-100">Notifications</p>
          </div>
          {notifications.length === 0 ? (
            <p className="text-slate-500 text-sm px-4 py-6 text-center">
              Nothing yet — you'll see updates here as things happen.
            </p>
          ) : (
            <ul className="max-h-72 overflow-y-auto divide-y divide-border2">
              {notifications.map((n) => (
                <li key={n.id} className="px-4 py-3 text-sm">
                  <p className="text-slate-100">{n.message}</p>
                  <p className="text-slate-500 text-xs font-mono2 mt-1">{n.time}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
