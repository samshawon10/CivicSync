import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'civicsync.theme';
const ThemeContext = createContext(null);

function readStoredMode() {
  if (typeof window === 'undefined') return 'system';
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return ['light', 'dark', 'system'].includes(stored) ? stored : 'system';
  } catch { return 'system'; }
}

function systemPrefersDark() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/**
 * Theme provider for the whole CivicSync product.
 * - mode: 'light' | 'dark' | 'system' (persisted in localStorage)
 * - the resolved theme is applied as `.dark` on <html>, which every semantic
 *   token in index.css responds to.
 */
export function ThemeProvider({ children }) {
  const [mode, setMode] = useState(readStoredMode);
  const [systemDark, setSystemDark] = useState(systemPrefersDark);

  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = (event) => setSystemDark(event.matches);
    query.addEventListener?.('change', listener);
    return () => query.removeEventListener?.('change', listener);
  }, []);

  const resolved = mode === 'system' ? (systemDark ? 'dark' : 'light') : mode;

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', resolved === 'dark');
    root.style.colorScheme = resolved;
    try { window.localStorage.setItem(STORAGE_KEY, mode); } catch { /* storage unavailable */ }
  }, [mode, resolved]);

  const cycle = useCallback(() => setMode((current) => (current === 'light' ? 'dark' : current === 'dark' ? 'system' : 'light')), []);
  const toggle = useCallback(() => setMode((current) => (current === 'dark' ? 'light' : 'dark')), []);
  const value = useMemo(() => ({ mode, resolved, setMode, toggle, cycle }), [mode, resolved, toggle, cycle]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) return { mode: 'system', resolved: 'light', setMode: () => {}, toggle: () => {}, cycle: () => {} };
  return context;
}

export const themeStorageKey = STORAGE_KEY;
