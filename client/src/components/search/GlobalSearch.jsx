import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../ui/Icon.jsx';
import { Badge } from '../ui/primitives.jsx';
import { Skeleton } from '../ui/Skeleton.jsx';
import { apiMessage } from '../../services/api.js';
import { searchApi } from '../../services/searchService.js';
import { cx } from '../../utils/format.js';

const RECENT_KEY = 'civicsync.search.recent';

function readRecent() {
  try { return JSON.parse(window.localStorage.getItem(RECENT_KEY) || '[]').slice(0, 6); } catch { return []; }
}

/**
 * Highlights the matched part of a title/subtitle. Plain React nodes only —
 * no dangerouslySetInnerHTML, so search text can never be injected as markup.
 */
export function Highlight({ text = '', query = '' }) {
  const value = String(text ?? '');
  const term = String(query || '').trim();
  if (term.length < 2) return value;
  const index = value.toLowerCase().indexOf(term.toLowerCase());
  if (index < 0) return value;
  return (
    <>
      {value.slice(0, index)}
      <mark className="rounded bg-civic-100 px-0.5 font-semibold text-civic-800">{value.slice(index, index + term.length)}</mark>
      {value.slice(index + term.length)}
    </>
  );
}

const toneBadge = { critical: 'critical', high: 'high', muted: 'muted', success: 'success' };

/**
 * Global CivicSearch overlay.
 *
 * One implementation serves every role: the backend returns only the
 * categories the authenticated role may search, so the same component is safe
 * on a citizen phone and in the Super Admin command palette. Keyboard-first
 * (Ctrl/Cmd+K to open, arrows to move, Enter to open a result).
 */
export default function GlobalSearch({ open, onClose, navCommands = [], placeholder = 'Search CivicSync…' }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [groups, setGroups] = useState([]);
  const [available, setAvailable] = useState([]);
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState(readRecent);
  const inputRef = useRef(null);

  const searching = query.trim().length >= 2;

  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 30); }, [open]);
  useEffect(() => { if (!open) { setQuery(''); setGroups([]); setError(''); setActive(0); } }, [open]);

  // Category chips the role may filter by. Loaded once; a failure simply hides
  // the chips (search itself keeps working).
  useEffect(() => {
    if (!open || available.length) return undefined;
    let alive = true;
    searchApi.categories()
      .then(({ data }) => { if (alive) setAvailable(data.categories || []); })
      .catch(() => { /* filters are optional */ });
    return () => { alive = false; };
  }, [open, available.length]);

  // Debounced search: one request per settled keystroke, stale responses dropped.
  useEffect(() => {
    if (!open) return undefined;
    const trimmed = query.trim();
    if (trimmed.length < 2) { setGroups([]); setError(''); setLoading(false); return undefined; }
    let alive = true;
    setLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const { data } = await searchApi.global(trimmed, category ? { categories: category } : {});
        if (!alive) return;
        setGroups(data.groups || []);
        setActive(0);
        setError('');
      } catch (err) {
        if (alive) setError(apiMessage(err));
      } finally {
        if (alive) setLoading(false);
      }
    }, 260);
    return () => { alive = false; window.clearTimeout(timer); };
  }, [query, category, open]);

  const flat = useMemo(() => {
    if (!searching) {
      return [
        ...recent.map((value) => ({ id: `recent-${value}`, group: 'Recent searches', title: value, subtitle: 'Press Enter to search again', icon: 'clock', type: 'recent' })),
        ...navCommands.map((item) => ({ id: `nav-${item.id}`, group: item.group || 'Go to', title: item.label, subtitle: item.subtitle, icon: item.icon, type: 'nav', path: item.path }))
      ];
    }
    return groups.flatMap((group) => group.items.map((item) => ({ ...item, group: group.label, type: 'result' })));
  }, [searching, recent, navCommands, groups]);

  function commit(entry) {
    if (!entry) return;
    if (entry.type === 'recent') { setQuery(entry.title); inputRef.current?.focus(); return; }
    if (entry.type === 'result') {
      const trimmed = query.trim();
      const next = [trimmed, ...recent.filter((value) => value !== trimmed)].slice(0, 6);
      setRecent(next);
      try { window.localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* storage unavailable */ }
    }
    navigate(entry.path);
    onClose?.();
  }

  function onKeyDown(event) {
    if (event.key === 'ArrowDown') { event.preventDefault(); setActive((value) => Math.min(value + 1, Math.max(flat.length - 1, 0))); }
    if (event.key === 'ArrowUp') { event.preventDefault(); setActive((value) => Math.max(value - 1, 0)); }
    if (event.key === 'Home') { event.preventDefault(); setActive(0); }
    if (event.key === 'End') { event.preventDefault(); setActive(Math.max(flat.length - 1, 0)); }
    if (event.key === 'Enter') { event.preventDefault(); commit(flat[active]); }
    if (event.key === 'Escape') { event.preventDefault(); onClose?.(); }
  }

  const hasResults = flat.length > 0;
  if (!open) return null;
  let cursor = null;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-slate-950/45 sm:p-4 sm:py-14" role="presentation">
      <button type="button" aria-label="Close search" tabIndex={-1} onClick={onClose} className="absolute inset-0 cursor-default" />
      <div role="dialog" aria-modal="true" aria-label="Global CivicSearch" className="relative flex h-full w-full flex-col bg-surface shadow-2xl sm:h-auto sm:max-w-2xl sm:rounded-2xl sm:border sm:border-line">
        <div className="flex items-center gap-2 border-b border-line px-3 py-3 sm:px-4">
          <Icon name="search" size={18} className="shrink-0 text-fg-subtle" aria-hidden="true" />
          <label className="sr-only" htmlFor="civic-global-search">Search CivicSync</label>
          <input
            id="civic-global-search"
            ref={inputRef}
            type="search"
            autoComplete="off"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            aria-controls="civic-search-results"
            aria-expanded={hasResults}
            className="!border-0 !bg-transparent !px-0"
          />
          {query && (
            <button type="button" onClick={() => { setQuery(''); inputRef.current?.focus(); }} aria-label="Clear search" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-fg-subtle hover:bg-surface-2">
              <Icon name="close" size={16} />
            </button>
          )}
          <button type="button" onClick={onClose} className="hidden shrink-0 items-center gap-1 rounded-md border border-line px-1.5 py-0.5 text-[11px] font-semibold text-fg-subtle sm:flex">
            <Icon name="keyboard" size={12} aria-hidden="true" /> Esc
          </button>
        </div>

        {available.length > 1 && (
          <div className="flex items-center gap-1.5 overflow-x-auto border-b border-line px-3 py-2 sm:px-4" role="group" aria-label="Filter search by category">
            <button type="button" onClick={() => setCategory('')} aria-pressed={!category} className={cx('shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold transition', !category ? 'bg-civic-600 text-white' : 'bg-surface-2 text-fg-muted hover:text-fg')}>All</button>
            {available.map((item) => (
              <button key={item.key} type="button" onClick={() => setCategory(category === item.key ? '' : item.key)} aria-pressed={category === item.key} className={cx('shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold transition', category === item.key ? 'bg-civic-600 text-white' : 'bg-surface-2 text-fg-muted hover:text-fg')}>{item.label}</button>
            ))}
          </div>
        )}

        <div id="civic-search-results" role="listbox" aria-label="Search results" className="max-h-[65vh] flex-1 overflow-y-auto px-2 py-2">
          {error && (
            <div role="alert" className="m-2 rounded-lg bg-red-50 p-3 text-[13px] text-red-700">
              {error}
              <button type="button" onClick={() => setQuery((value) => `${value} `.trimEnd())} className="ml-2 font-bold underline">Retry</button>
            </div>
          )}

          {loading && (
            <div className="space-y-2 px-2 py-2">
              {[0, 1, 2, 3].map((row) => (
                <div key={row} className="flex items-center gap-3">
                  <Skeleton width={28} height={28} radius={8} />
                  <div className="flex-1 space-y-1.5"><Skeleton height={10} width="55%" /><Skeleton height={9} width="35%" /></div>
                </div>
              ))}
            </div>
          )}

          {!loading && !hasResults && (
            <div className="px-4 py-10 text-center">
              <Icon name={searching ? 'search' : 'command'} size={22} className="mx-auto text-fg-subtle" aria-hidden="true" />
              <p className="mt-3 text-sm font-semibold text-fg">{searching ? `No matches for “${query.trim()}”` : 'Search CivicSync'}</p>
              <p className="mt-1 text-[13px] text-fg-muted">
                {searching
                  ? 'Try a case title, an area name, a facility or a hashtag. Only records you are authorized to see are searched.'
                  : 'Search the cases, community posts, facilities, alerts and civic services you have access to.'}
              </p>
            </div>
          )}

          {!loading && flat.map((entry, index) => {
            const heading = entry.group !== cursor ? entry.group : null;
            cursor = entry.group;
            return (
              <div key={entry.id || `${entry.group}-${entry.title}`}>
                {heading && <p className="px-3 pb-1 pt-3 text-[11px] font-bold uppercase tracking-wider text-fg-subtle">{heading}</p>}
                <button
                  id={`civic-search-option-${index}`}
                  type="button"
                  role="option"
                  aria-selected={index === active}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => commit(entry)}
                  className={cx('flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition', index === active ? 'bg-surface-2' : 'hover:bg-surface-2')}
                >
                  <span className="mt-0.5 shrink-0 text-fg-subtle"><Icon name={entry.icon || 'fileText'} size={16} aria-hidden="true" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-fg"><Highlight text={entry.title} query={searching ? query : ''} /></span>
                    {entry.subtitle && <span className="block truncate text-xs text-fg-muted"><Highlight text={entry.subtitle} query={searching ? query : ''} /></span>}
                  </span>
                  {toneBadge[entry.tone] && <Badge tone={toneBadge[entry.tone]}>{entry.tone === 'critical' ? 'Critical' : entry.tone === 'high' ? 'High' : entry.tone === 'muted' ? 'Archived' : 'Available'}</Badge>}
                </button>
              </div>
            );
          })}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-2.5 text-[11px] text-fg-subtle">
          <span className="flex items-center gap-3">
            <span><Icon name="chevronUp" size={12} className="inline" aria-hidden="true" /> <Icon name="chevronDown" size={12} className="inline" aria-hidden="true" /> navigate</span>
            <span><Icon name="arrowRight" size={12} className="inline" aria-hidden="true" /> open</span>
          </span>
          <span>Authorized CivicSync records only</span>
        </footer>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Provider */

export const GlobalSearchContext = createContext(null);

/** Access the dashboard search overlay: `const search = useGlobalSearch(); search.open()`. */
export function useGlobalSearch() {
  return useContext(GlobalSearchContext) || { open: () => {}, close: () => {} };
}

/**
 * Owns the single search overlay for a dashboard and exposes it through
 * context. Shells add their own trigger button instead of mounting a second
 * instance — two instances would both handle Ctrl/Cmd+K and open twice.
 */
export function GlobalSearchProvider({ children }) {
  const [open, setOpen] = useState(false);
  const value = useMemo(() => ({ open: () => setOpen(true), close: () => setOpen(false) }), []);
  useEffect(() => {
    function onKey(event) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setOpen(true); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return (
    <GlobalSearchContext.Provider value={value}>
      {children}
      <GlobalSearch open={open} onClose={() => setOpen(false)} />
    </GlobalSearchContext.Provider>
  );
}
