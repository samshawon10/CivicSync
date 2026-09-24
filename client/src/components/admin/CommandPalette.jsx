import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../ui/Icon.jsx';
import { Badge } from '../ui/primitives.jsx';
import { adminApi } from '../../services/adminService.js';
import { apiMessage } from '../../services/api.js';
import { allNavItems } from './adminNav.js';
import { cx } from '../../utils/format.js';

const RECENT_KEY = 'civicsync.admin.recentSearch';

function readRecent() {
  try { return JSON.parse(window.localStorage.getItem(RECENT_KEY) || '[]').slice(0, 6); } catch { return []; }
}

/**
 * Global search / command palette (Ctrl + K).
 * Real backend search across users, emergencies, departments, response teams,
 * facilities, alerts and audit events, plus navigation commands.
 */
export default function CommandPalette({ open, onClose }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState(readRecent);
  const inputRef = useRef(null);

  const commands = useMemo(() => allNavItems.map((item) => ({
    id: `cmd-${item.key}`,
    group: `Go to ${item.group}`,
    title: item.label,
    subtitle: `Administration · ${item.group}`,
    icon: item.icon,
    run: () => navigate(item.path)
  })), [navigate]);

  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 30); }, [open]);
  useEffect(() => { if (!open) { setQuery(''); setGroups([]); setError(''); setActive(0); } }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const trimmed = query.trim();
    if (trimmed.length < 2) { setGroups([]); setError(''); return undefined; }
    let alive = true;
    setLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const { data } = await adminApi.search(trimmed);
        if (!alive) return;
        setGroups(data.groups || []);
        setError('');
        setActive(0);
      } catch (err) {
        if (alive) setError(apiMessage(err));
      } finally {
        if (alive) setLoading(false);
      }
    }, 260);
    return () => { alive = false; window.clearTimeout(timer); };
  }, [query, open]);

  const searching = query.trim().length >= 2;
  const flat = useMemo(() => {
    if (!searching) return commands;
    return groups.flatMap((group) => group.items.map((item) => ({ ...item, group: group.label, type: 'result', run: () => navigate(item.path) })));
  }, [groups, commands, searching, navigate]);

  function commit(entry) {
    if (!entry) return;
    if (entry.type === 'result' && searching) {
      try {
        const next = [query.trim(), ...recent.filter((value) => value !== query.trim())].slice(0, 6);
        window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
        setRecent(next);
      } catch { /* storage unavailable */ }
    }
    entry.run?.();
    onClose?.();
  }

  function onKeyDown(event) {
    if (event.key === 'ArrowDown') { event.preventDefault(); setActive((value) => Math.min(value + 1, flat.length - 1)); }
    if (event.key === 'ArrowUp') { event.preventDefault(); setActive((value) => Math.max(value - 1, 0)); }
    if (event.key === 'Enter') { event.preventDefault(); commit(flat[active]); }
    if (event.key === 'Escape') { event.preventDefault(); onClose?.(); }
  }

  if (!open) return null;
  let cursor = '';
  return (
    <div className="fixed inset-0 z-[65] flex items-start justify-center bg-slate-950/50 p-4 pt-[10vh]" role="presentation">
      <button type="button" aria-label="Close search" tabIndex={-1} onClick={onClose} className="absolute inset-0 cursor-default" />
      <div className="modal-panel relative w-full max-w-2xl overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl" role="dialog" aria-modal="true" aria-label="Global search">
        <div className="flex items-center gap-3 border-b border-line px-4 py-3">
          <Icon name="search" size={18} className="text-fg-subtle" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search users, emergency IDs, departments, teams, facilities, audit events…"
            aria-label="Search CivicSync"
            className="search-input"
          />
          <span className="hidden items-center gap-1 rounded-md border border-line px-1.5 py-0.5 text-[11px] font-semibold text-fg-subtle sm:flex">
            <Icon name="keyboard" size={12} /> Esc
          </span>
        </div>

        <div className="max-h-[60vh] overflow-y-auto px-2 py-2">
          {error && <p className="m-2 rounded-lg bg-red-50 p-3 text-[13px] text-red-700">{error}</p>}
          {loading && <p className="flex items-center gap-2 px-3 py-3 text-[13px] text-fg-muted"><Icon name="refresh" size={14} /> Searching live records…</p>}

          {!loading && searching && !flat.length && !error && (
            <div className="px-3 py-8 text-center">
              <p className="text-sm font-semibold text-fg">No matches for “{query.trim()}”</p>
              <p className="mt-1 text-[13px] text-fg-muted">Try an emergency ID (EM-…), a person’s name, a department or a facility.</p>
            </div>
          )}

          {!loading && !searching && recent.length > 0 && (
            <div className="mb-1">
              <p className="px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wider text-fg-subtle">Recent searches</p>
              {recent.map((value) => (
                <button key={value} type="button" onClick={() => setQuery(value)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] text-fg-muted hover:bg-surface-2">
                  <Icon name="clock" size={14} />{value}
                </button>
              ))}
            </div>
          )}

          {flat.map((entry, index) => {
            const heading = entry.group !== cursor ? entry.group : null;
            cursor = entry.group;
            return (
              <div key={entry.id || `${entry.group}-${entry.title}`}>
                {heading && <p className="px-3 pb-1 pt-3 text-[11px] font-bold uppercase tracking-wider text-fg-subtle">{heading}</p>}
                <button
                  type="button"
                  onMouseEnter={() => setActive(index)}
                  onClick={() => commit(entry)}
                  className={cx('flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition', index === active ? 'bg-surface-2' : 'hover:bg-surface-2')}
                >
                  <span className="mt-0.5 text-fg-subtle"><Icon name={entry.icon || 'fileText'} size={16} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-fg">{entry.title}</span>
                    {entry.subtitle && <span className="block truncate text-xs text-fg-muted">{entry.subtitle}</span>}
                  </span>
                  {entry.tone === 'critical' && <Badge tone="critical">Critical</Badge>}
                  {entry.tone === 'high' && <Badge tone="high">High</Badge>}
                  {entry.tone === 'muted' && <Badge tone="muted">Archived</Badge>}
                </button>
              </div>
            );
          })}
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-line px-4 py-2.5 text-[11px] text-fg-subtle">
          <span className="flex items-center gap-3">
            <span><Icon name="chevronUp" size={12} className="inline" /> <Icon name="chevronDown" size={12} className="inline" /> navigate</span>
            <span><Icon name="arrowRight" size={12} className="inline" /> open</span>
          </span>
          <span>Live CivicSync records only</span>
        </footer>
      </div>
    </div>
  );
}

