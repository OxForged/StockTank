import * as React from 'react';
import { motion, Variants } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import { UserAvatar } from '../UserAvatar';

export interface NavItem {
  icon: React.ReactNode;
  label: string;
  href: string;
  isSeparator?: boolean;
  onClick?: () => void;
  isActive?: boolean;
}

export interface UserProfile {
  name: string;
  email: string;
  avatarUrl: string;
}

export interface UserProfileSidebarProps {
  user: UserProfile;
  navItems: NavItem[];
  logoutItem: {
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
  };
  isCollapsed?: boolean;
  className?: string;
}

const sidebarVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, x: -10 },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      type: 'spring',
      stiffness: 120,
      damping: 18,
    },
  },
};

export const UserProfileSidebar = React.forwardRef<HTMLDivElement, UserProfileSidebarProps>(
  ({ user, navItems, logoutItem, isCollapsed = false, className }, ref) => {
    return (
      <motion.aside
        ref={ref}
        className={cn(
          'flex h-full w-full flex-col rounded-xl text-slate-100 shadow-sm transition-all duration-300',
          className
        )}
        initial="hidden"
        animate="visible"
        variants={sidebarVariants}
        aria-label="User Profile Menu"
      >
        {/* User Info Header */}
        <motion.div
          variants={itemVariants}
          className={cn(
            'flex items-center space-x-3 p-1.5 transition-all',
            isCollapsed && 'justify-center space-x-0'
          )}
          title={isCollapsed ? `${user.name} (${user.email})` : undefined}
        >
          <UserAvatar name={user.name} avatarUrl={user.avatarUrl} size={isCollapsed ? 34 : 40} />
          {!isCollapsed && (
            <div className="flex flex-col truncate">
              <span className="font-semibold text-sm text-slate-100 truncate">{user.name}</span>
              <span className="text-xs text-slate-300 truncate">{user.email}</span>
            </div>
          )}
        </motion.div>

        <motion.div variants={itemVariants} className="my-2 border-t border-border2" />

        {/* Navigation Links */}
        <nav className="flex-1 space-y-1 overflow-y-auto overflow-x-hidden" role="navigation">
          {navItems.map((item, index) => (
            <React.Fragment key={index}>
              {item.isSeparator && <motion.div variants={itemVariants} className="h-2" />}
              <motion.a
                href={item.href}
                title={isCollapsed ? item.label : undefined}
                onClick={(e: React.MouseEvent<HTMLAnchorElement>) => {
                  if (item.onClick) {
                    e.preventDefault();
                    item.onClick();
                  }
                }}
                variants={itemVariants}
                className={cn(
                  'group flex items-center rounded-xl py-2.5 text-sm font-medium transition-all border-l-2',
                  isCollapsed ? 'justify-center px-0 border-l-0' : 'px-3',
                  item.isActive
                    ? 'text-slate-50 border-amber bg-white/[0.08] shadow-sm'
                    : 'text-slate-300 border-transparent hover:text-slate-50 hover:bg-white/[0.04]'
                )}
              >
                <span
                  className={cn(
                    'h-4 w-4 shrink-0 flex items-center justify-center transition-all',
                    !isCollapsed && 'mr-2.5',
                    item.isActive ? 'text-amber' : 'text-slate-300 group-hover:text-slate-100'
                  )}
                >
                  {item.icon}
                </span>

                {!isCollapsed && <span className="truncate">{item.label}</span>}

                {!isCollapsed && (
                  <ChevronRight className="ml-auto h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100 text-amber" />
                )}
              </motion.a>
            </React.Fragment>
          ))}
        </nav>

        {/* Logout Button */}
        <motion.div variants={itemVariants} className="mt-2 pt-2 border-t border-border2">
          <button
            onClick={logoutItem.onClick}
            title={isCollapsed ? logoutItem.label : undefined}
            className={cn(
              'group flex w-full items-center rounded-xl py-2.5 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/10',
              isCollapsed ? 'justify-center px-0' : 'px-3'
            )}
          >
            <span className={cn('h-4 w-4 shrink-0 flex items-center justify-center', !isCollapsed && 'mr-2.5')}>
              {logoutItem.icon}
            </span>
            {!isCollapsed && <span>{logoutItem.label}</span>}
          </button>
        </motion.div>
      </motion.aside>
    );
  }
);

UserProfileSidebar.displayName = 'UserProfileSidebar';
