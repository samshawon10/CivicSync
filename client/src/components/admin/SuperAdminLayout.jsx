import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import Icon from '../ui/Icon.jsx';
import { Badge, Button, IconButton, StatusDot } from '../ui/primitives.jsx';
import { Drawer, Modal } from '../ui/Overlays.jsx';
import CommandPalette from './CommandPalette.jsx';
import NotificationCenter from './NotificationCenter.jsx';
import { adminNav } from './adminNav.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useTheme } from '../../context/ThemeContext.jsx';
import { useAdminRealtime } from '../../context/AdminRealtimeContext.jsx';
import { adminApi } from '../../services/adminService.js';
import { notificationsApi } from '../../services/notificationService.js';
import { cx } from '../../utils/format.js';

const SIDEBAR_KEY = 'civicsync.admin.sidebar';

const healthTone = { operational: 'success', degraded: 'medium', unavailable: 'critical', not_monitored: 'neutral' };
const statusLabel = { operational: 'Operational', degraded: 'Degraded', unavailable: 'Unavailable', not_monitored: 'Not monitored' };

function readCollapsed() {
  try { return window.localStorage.getItem(SIDEBAR_KEY) === 'collapsed'; } catch { return false; }
}

/**
 * Reusable Super Admin application shell: one sidebar, one top navigation and
 * one content frame shared by every administration page.
 */
export default function SuperAdminLayout({ section, title, subtitle, actions, breadcrumb, children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { mode, resolved, cycle } = useTheme();
  const { live } = useAdminRealtime();

  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [unread, setUnread] = useState(null);
  const [health, setHealth] = useState(null);

  useEffect(() => {
    try { window.localStorage.setItem(SIDEBAR_KEY, collapsed ? 'collapsed' : 'expanded'); } catch { /* storage unavailable */ }
  }, [collapsed]);

  useEffect(() => {
    function onKeyDown(event) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setPaletteOpen(true); }
      if (event.key === '[' && event.altKey) { setCollapsed((value) => !value); }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const loadUnread = useCallback(async () => {
    try {
      const { data } = await notificationsApi.list();
      setUnread(data.unreadCount || 0);
    } catch { setUnread(null); }
  }, []);

  const loadHealth = useCallback(async () => {
    try {
      const { data } = await adminApi.systemHealth();
      setHealth(data.checks || []);
    } catch { setHealth(null); }
  }, []);

  useEffect(() => {
    loadUnread();
    loadHealth();
    const timer = window.setInterval(() => { loadUnread(); loadHealth(); }, 60000);
    return () => window.clearInterval(timer);
  }, [loadUnread, loadHealth]);

  const healthSummary = useMemo(() => {
    if (!Array.isArray(health) || !health.length) return { tone: 'neutral', label: 'Health status unavailable' };
    const monitored = health.filter((check) => check.status !== 'not_monitored');
    if (!monitored.length) return { tone: 'neutral', label: 'No monitored services' };
    const unavailable = monitored.filter((check) => check.status === 'unavailable').length;
    const degraded = monitored.filter((check) => check.status === 'degraded').length;
    if (unavailable) return { tone: 'critical', label: `${unavailable} service${unavailable > 1 ? 's' : ''} unavailable` };
    if (degraded) return { tone: 'medium', label: `${degraded} service${degraded > 1 ? 's' : ''} degraded` };
    return { tone: 'success', label: 'All monitored services operational' };
  }, [health]);

  async function signOut() { await logout(); navigate('/login'); }

  function changeSection(path) {
    setMobileOpen(false);
    navigate(path);
  }

  const themeLabel = mode === 'system' ? `System (${resolved})` : mode === 'dark' ? 'Dark' : 'Light';

  const sidebar = (
    <div className="flex h-full flex-col" style={{ backgroundColor: 'var(--sidebar-bg)' }}>
      <div className={cx('flex items-center gap-3 px-4 py-4', collapsed && 'lg:justify-center')}>
        <Link to="/admin/dashboard" className="flex min-w-0 items-center gap-2.5" onClick={() => setMobileOpen(false)}>
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-civic-600 text-sm font-extrabold text-white">CS</span>
          {!collapsed && (
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-bold text-white">CivicSync</span>
              <span className="block truncate text-[11px] font-semibold uppercase tracking-[.14em] text-slate-400">Command Center</span>
            </span>
          )}
        </Link>
        <button type="button" onClick={() => setMobileOpen(false)} className="ml-auto rounded-lg p-2 text-slate-300 lg:hidden" aria-label="Close navigation">
          <Icon name="close" size={18} />
        </button>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-2.5 pb-4" aria-label="Administration sections">
        {adminNav.map((group) => (
          <div key={group.group}>
            {!collapsed && <p className="nav-group-label">{group.group}</p>}
            {collapsed && <div className="my-3 h-px" style={{ backgroundColor: 'rgba(255,255,255,.08)' }} />}
            <div className="space-y-1">
              {group.items.map((item) => (
                <NavLink
                  key={item.key}
                  to={item.path}
                  title={collapsed ? item.label : undefined}
                  className={({ isActive }) => cx('nav-item', collapsed && 'lg:justify-center', section === item.key || isActive ? 'nav-item-active' : '')}
                >
                  <Icon name={item.icon} size={17} />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t px-2.5 py-3" style={{ borderColor: 'rgba(255,255,255,.08)' }}>
        <button type="button" onClick={() => setHelpOpen(true)} className={cx('nav-item w-full', collapsed && 'lg:justify-center')}>
          <Icon name="helpCircle" size={17} />
          {!collapsed && <span>Help &amp; shortcuts</span>}
        </button>
        <button type="button" onClick={cycle} className={cx('nav-item w-full', collapsed && 'lg:justify-center')}>
          <Icon name={resolved === 'dark' ? 'moon' : 'sun'} size={17} />
          {!collapsed && <span>Theme · {themeLabel}</span>}
        </button>
        <button type="button" onClick={() => changeSection('/admin/profile')} className={cx('nav-item w-full text-left', collapsed && 'lg:justify-center')}>
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-civic-600 text-[12px] font-bold text-white">
            {user?.name?.[0]?.toUpperCase() || 'A'}
          </span>
          {!collapsed && (
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-semibold text-white">{user?.name || 'Administrator'}</span>
              <span className="block truncate text-[11px] text-slate-400">Super Admin</span>
            </span>
          )}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--app-bg)' }}>
      {/* Desktop sidebar */}
      <aside
        className={cx('fixed inset-y-0 left-0 z-40 hidden border-r transition-all duration-200 lg:block', collapsed ? 'w-[76px]' : 'w-[264px]')}
        style={{ borderColor: 'rgba(255,255,255,.06)' }}
      >
        {sidebar}
        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          className="absolute -right-3 top-20 hidden h-6 w-6 place-items-center rounded-full border bg-surface text-fg-muted shadow transition hover:text-fg lg:grid"
          style={{ borderColor: 'var(--line)' }}
          aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
          title={`${collapsed ? 'Expand' : 'Collapse'} navigation (Alt + [)`}
        >
          <Icon name={collapsed ? 'chevronRight' : 'chevronLeft'} size={13} />
        </button>
      </aside>

      {/* Mobile sidebar drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" aria-label="Close navigation overlay" onClick={() => setMobileOpen(false)} className="absolute inset-0 bg-slate-950/50" />
          <div className="drawer-panel relative h-full w-[270px]">{sidebar}</div>
        </div>
      )}

      <div className={cx('min-w-0 transition-[padding] duration-200', collapsed ? 'lg:pl-[76px]' : 'lg:pl-[264px]')}>
        <header
          className="sticky top-0 z-30 border-b"
          style={{ backgroundColor: 'color-mix(in oklab, var(--surface) 92%, transparent)', borderColor: 'var(--line)', backdropFilter: 'blur(10px)' }}
        >
          <div className="flex min-h-[60px] items-center gap-2 px-3 sm:px-5">
            <IconButton icon="menu" label="Open navigation" className="lg:hidden" onClick={() => setMobileOpen(true)} />

            <div className="hidden min-w-0 flex-col md:flex">
              <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
                <span>Administration</span>
                <Icon name="chevronRight" size={11} />
                <span>{breadcrumb?.group || 'Overview'}</span>
              </nav>
              <h1 className="truncate text-[15px] font-bold text-fg">{title}</h1>
            </div>

            <div className="flex flex-1 justify-end md:justify-center">
              <button
                type="button"
                onClick={() => setPaletteOpen(true)}
                className="hidden w-full max-w-md items-center gap-2 rounded-xl border px-3 py-2 text-left text-[13px] text-fg-subtle transition hover:border-civic-300 md:flex"
                style={{ borderColor: 'var(--line)', backgroundColor: 'var(--surface-2)' }}
              >
                <Icon name="search" size={15} />
                <span className="flex-1 truncate">Search users, emergencies, departments…</span>
                <span className="flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-semibold" style={{ borderColor: 'var(--line)' }}>
                  <Icon name="command" size={11} /> K
                </span>
              </button>
              <IconButton icon="search" label="Search" className="md:hidden" onClick={() => setPaletteOpen(true)} />
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={loadHealth}
                className="hidden items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[12px] font-semibold text-fg-muted transition hover:text-fg xl:flex"
                style={{ borderColor: 'var(--line)' }}
                title={health ? health.map((check) => `${check.label}: ${statusLabel[check.status] || check.status}`).join(' · ') : 'System status unavailable'}
              >
                <StatusDot tone={healthSummary.tone} />
                {healthSummary.label}
              </button>
              <span className="hidden items-center gap-1.5 rounded-lg px-2 py-1.5 text-[12px] font-semibold lg:flex" title="Live Socket.IO connection for emergency events">
                <StatusDot tone={live ? 'success' : 'muted'} />
                {live ? 'Live' : 'Offline'}
              </span>
              <IconButton icon={resolved === 'dark' ? 'sun' : 'moon'} label={`Theme: ${themeLabel}. Click to change.`} onClick={cycle} />
              <button
                type="button"
                onClick={() => setNotificationsOpen(true)}
                className="relative rounded-lg p-2 text-fg-muted transition hover:bg-surface-2 hover:text-fg"
                aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
              >
                <Icon name="bell" size={18} />
                {unread > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">{unread > 9 ? '9+' : unread}</span>
                )}
              </button>
              <IconButton icon="helpCircle" label="Help and keyboard shortcuts" onClick={() => setHelpOpen(true)} />
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setProfileOpen((value) => !value)}
                  className="flex items-center gap-2 rounded-lg p-1 pr-2 transition hover:bg-surface-2"
                  aria-haspopup="menu"
                  aria-expanded={profileOpen}
                >
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-civic-600 text-[13px] font-bold text-white">{user?.name?.[0]?.toUpperCase() || 'A'}</span>
                  <Icon name="chevronDown" size={14} className="hidden text-fg-subtle sm:block" />
                </button>
                {profileOpen && (
                  <div className="menu-panel absolute right-0 z-40 mt-2 w-56 overflow-hidden rounded-xl border bg-surface py-1 shadow-xl" style={{ borderColor: 'var(--line)' }} role="menu">
                    <div className="border-b px-3 py-2.5" style={{ borderColor: 'var(--line)' }}>
                      <p className="truncate text-[13px] font-semibold text-fg">{user?.name}</p>
                      <p className="truncate text-[11px] text-fg-subtle">{user?.email}</p>
                    </div>
                    {[
                      { label: 'Admin profile', icon: 'user', path: '/admin/profile' },
                      { label: 'System settings', icon: 'settings', path: '/admin/settings' }
                    ].map((entry) => (
                      <button
                        key={entry.path}
                        type="button"
                        role="menuitem"
                        className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] font-medium text-fg hover:bg-surface-2"
                        onClick={() => { setProfileOpen(false); changeSection(entry.path); }}
                      >
                        <Icon name={entry.icon} size={15} /> {entry.label}
                      </button>
                    ))}
                    <button type="button" role="menuitem" className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] font-medium text-red-600 hover:bg-red-50" onClick={signOut}>
                      <Icon name="logout" size={15} /> Sign out
                    </button>
                  </div>
                )}
              </div>
            </div>

          </div>
        </header>

        <main className="mx-auto w-full max-w-[1500px] px-4 py-5 sm:px-6 lg:px-7">
          {(title || actions) && (
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3 md:hidden">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-fg-subtle">{breadcrumb?.group}</p>
                <h1 className="civic-page-heading mt-0.5">{title}</h1>
                {subtitle && <p className="mt-1 text-[13px] text-fg-muted">{subtitle}</p>}
              </div>
              {actions}
            </div>
          )}
          {subtitle && (
            <p className="mb-5 hidden max-w-3xl text-[13px] text-fg-muted md:block">{subtitle}</p>
          )}
          {actions && <div className="mb-5 hidden flex-wrap items-center gap-2 md:flex">{actions}</div>}
          <div className="page-enter">{children}</div>
        </main>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <NotificationCenter open={notificationsOpen} onClose={() => { setNotificationsOpen(false); loadUnread(); }} />

      <Modal open={helpOpen} onClose={() => setHelpOpen(false)} title="Help & keyboard shortcuts" subtitle="Everything in this console is backed by live CivicSync data." size="lg">
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <h3 className="text-[13px] font-bold uppercase tracking-wide text-fg-subtle">Shortcuts</h3>
            <ul className="mt-2 space-y-2 text-[13px] text-fg-muted">
              {[
                ['Ctrl / ⌘ + K', 'Open global search and commands'],
                ['Alt + [', 'Collapse or expand the sidebar'],
                ['Esc', 'Close dialogs, drawers and the palette'],
                ['↑ / ↓ then Enter', 'Move through search results']
              ].map(([keys, description]) => (
                <li key={keys} className="flex items-start gap-2">
                  <kbd className="rounded-md border px-1.5 py-0.5 text-[11px] font-semibold text-fg" style={{ borderColor: 'var(--line)' }}>{keys}</kbd>
                  <span>{description}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-[13px] font-bold uppercase tracking-wide text-fg-subtle">Data sources</h3>
            <ul className="mt-2 space-y-2 text-[13px] text-fg-muted">
              <li><strong className="font-semibold text-fg">Governance KPIs</strong> — live counts from users, complaints, emergencies, teams, facilities and alerts.</li>
              <li><strong className="font-semibold text-fg">System health</strong> — real probes (MongoDB ping, Socket.IO, storage, auth config). Unprobed services are labelled “Not monitored”.</li>
              <li><strong className="font-semibold text-fg">Safety intelligence</strong> — aggregated citizen reports; areas are described as reported incident areas, never as objectively unsafe.</li>
            </ul>
          </div>
        </div>
        <p className="mt-5 rounded-xl border p-3 text-[12px] text-fg-muted" style={{ borderColor: 'var(--line)' }}>
          Sensitive incidents (women safety, child safety, missing person, crime) remain protected: only authenticated Emergency Command and assigned responders can access exact coordinates or victim details. Public maps use rounded aggregates only.
        </p>
      </Modal>

    </div>
  );
}


