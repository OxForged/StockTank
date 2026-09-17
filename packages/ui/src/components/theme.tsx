import { Moon, Sun } from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';

import { cn } from '../lib/cn.js';
import { Button, type ButtonProps } from './button.js';

export type Theme = 'dark' | 'light' | 'system';
export type ResolvedTheme = 'dark' | 'light';

interface ThemeContextValue {
  theme: Theme;
  resolved: ResolvedTheme;
  setTheme: (t: Theme) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const DEFAULT_KEY = 'stocktank.theme';
const LIGHT_QUERY = '(prefers-color-scheme: light)';

function readStored(key: string): Theme | null {
  try {
    const v = globalThis.localStorage?.getItem(key);
    return v === 'dark' || v === 'light' || v === 'system' ? v : null;
  } catch {
    return null;
  }
}

function writeStored(key: string, value: Theme) {
  try {
    globalThis.localStorage?.setItem(key, value);
  } catch {
    /* storage unavailable (private mode, blocked): the theme still applies for the session */
  }
}

function getMediaQuery(): MediaQueryList | undefined {
  try {
    return globalThis.matchMedia?.(LIGHT_QUERY);
  } catch {
    return undefined;
  }
}

function systemPrefersLight(): boolean {
  return getMediaQuery()?.matches ?? false;
}

function subscribeSystem(onChange: () => void) {
  const mql = getMediaQuery();
  if (!mql) return () => {};
  mql.addEventListener('change', onChange);
  return () => mql.removeEventListener('change', onChange);
}

export function resolveTheme(theme: Theme): ResolvedTheme {
  if (theme === 'system') return systemPrefersLight() ? 'light' : 'dark';
  return theme;
}

/** Apply the resolved theme to <html data-theme>. Dark is the design default. */
export function applyTheme(resolved: ResolvedTheme) {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', resolved);
}

export interface ThemeProviderProps {
  children: ReactNode;
  /** localStorage key. Use a distinct key per app if they should not share a preference. */
  storageKey?: string;
  /** Used when nothing is stored. Defaults to 'system' (dark unless the OS prefers light). */
  defaultTheme?: Theme;
}

export function ThemeProvider({ children, storageKey = DEFAULT_KEY, defaultTheme = 'system' }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(() => readStored(storageKey) ?? defaultTheme);
  const systemLight = useSyncExternalStore(subscribeSystem, systemPrefersLight, () => false);
  const resolved: ResolvedTheme = theme === 'system' ? (systemLight ? 'light' : 'dark') : theme;

  // Sync the resolved theme to the document (an external system).
  useEffect(() => {
    applyTheme(resolved);
  }, [resolved]);

  const setTheme = useCallback(
    (t: Theme) => {
      setThemeState(t);
      writeStored(storageKey, t);
    },
    [storageKey],
  );

  const toggle = useCallback(() => {
    setTheme(resolved === 'dark' ? 'light' : 'dark');
  }, [resolved, setTheme]);

  const value = useMemo(() => ({ theme, resolved, setTheme, toggle }), [theme, resolved, setTheme, toggle]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within <ThemeProvider>');
  return ctx;
}

export interface ThemeToggleProps extends Omit<ButtonProps, 'onClick' | 'children'> {
  showLabel?: boolean;
}

export function ThemeToggle({ className, showLabel = false, variant = 'ghost', size, ...props }: ThemeToggleProps) {
  const { resolved, toggle } = useTheme();
  const next = resolved === 'dark' ? 'light' : 'dark';
  return (
    <Button
      variant={variant}
      size={size ?? (showLabel ? 'md' : 'icon')}
      onClick={toggle}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
      aria-pressed={resolved === 'light'}
      className={cn(className)}
      {...props}
    >
      {resolved === 'dark' ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
      {showLabel ? <span>{resolved === 'dark' ? 'Light mode' : 'Dark mode'}</span> : null}
    </Button>
  );
}

/**
 * Inline script for <head> to apply the stored theme before first paint (avoids a flash).
 * The same logic is pasted into each app's index.html.
 */
export function themeBootstrapScript(storageKey = DEFAULT_KEY): string {
  return `(function(){try{var k=${JSON.stringify(storageKey)};var t=localStorage.getItem(k);if(t!=='light'&&t!=='dark'){t=matchMedia('${LIGHT_QUERY}').matches?'light':'dark'}document.documentElement.setAttribute('data-theme',t)}catch(e){document.documentElement.setAttribute('data-theme','dark')}})();`;
}
