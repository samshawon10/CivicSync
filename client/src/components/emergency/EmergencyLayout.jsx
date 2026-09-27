import { useCallback, useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Bell, CircleUserRound, Moon, Search, Sparkles, Sun } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useTheme } from '../../context/ThemeContext.jsx';
import { roleLabels } from '../../utils/roles.js';
import { useGlobalSearch } from '../search/GlobalSearch.jsx';
import { useCivicAIContext } from '../ai/CivicAIProvider.jsx';
import NotificationCenter from '../admin/NotificationCenter.jsx';
import { Modal } from '../ui/Overlays.jsx';
import { notificationsApi } from '../../services/notificationService.js';

const linksByRole = {
  emergency_department_head: [['/dashboard/emergency-head', 'Command center'], ['/dashboard/emergency-head/analytics', 'Analytics']],
  emergency_department_officer: [['/dashboard/emergency-department-officer', 'My emergencies']],
  emergency_officer: [['/dashboard/emergency-officer', 'Response operations']],
  emergency_field_worker: [['/dashboard/emergency-field-worker', 'My assignment']]
};

export default function EmergencyLayout({ title, children }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { resolved, toggle } = useTheme();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [unread, setUnread] = useState(null);
  const links = linksByRole[user?.role] || [];
  const search = useGlobalSearch();
  const ai = useCivicAIContext();
  const loadUnread = useCallback(async () => {
    try {
      const { data } = await notificationsApi.list();
      setUnread(data.unreadCount || 0);
    } catch { setUnread(null); }
  }, []);
  useEffect(() => { loadUnread(); }, [loadUnread]);

  async function signOut() {
    await logout();
    navigate('/login');
  }

  return <div className="min-h-screen bg-app lg:grid lg:grid-cols-[250px_1fr]">
    <aside className="flex h-full flex-col bg-ink p-5 text-white">
      <div><p className="text-xl font-black tracking-tight">Civic<span className="text-civic-300">Sync</span></p><p className="mt-2 text-xs font-bold uppercase tracking-[.16em] text-civic-200">Emergency response</p></div>
      <nav className="mt-4 flex gap-1 overflow-x-auto lg:mt-8 lg:flex-col lg:overflow-visible" aria-label="Emergency navigation">{links.map(([to, text]) => <NavLink key={to} to={to} end className={({ isActive }) => `flex min-h-11 shrink-0 items-center rounded-lg px-3 text-sm font-semibold transition ${isActive || (to === '/dashboard/emergency-head' && location.pathname.startsWith(to)) ? 'bg-civic-600 text-white' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`}>{text}</NavLink>)}</nav>
      <div className="mt-auto border-t border-white/10 pt-4"><button type="button" onClick={() => setProfileOpen(true)} className="flex min-h-11 w-full items-center gap-2 rounded-lg px-1 text-left hover:bg-white/10"><CircleUserRound size={18}/><span className="truncate text-sm font-semibold">{user?.name}</span></button><p className="mt-1 text-xs text-slate-400">{roleLabels[user?.role] || 'Emergency staff'}</p><button onClick={signOut} className="mt-4 min-h-11 w-full rounded-lg border border-white/20 px-3 text-sm font-bold text-white hover:bg-white/10">Log out</button></div>
    </aside>
    <div className="min-w-0"><header className="flex min-h-16 items-center border-b border-line bg-surface px-4 sm:px-8"><div><p className="text-xs font-bold tracking-[.14em] text-civic-600">EMERGENCY OPERATIONS</p><h1 className="text-lg font-black text-fg">{title}</h1></div><div className="ml-auto flex items-center gap-1"><button type="button" onClick={toggle} className="grid h-10 w-10 place-items-center rounded-lg text-fg-muted hover:bg-surface-2" aria-label={`Switch to ${resolved === 'dark' ? 'light' : 'dark'} mode`}>{resolved === 'dark' ? <Sun size={18}/> : <Moon size={18}/>}</button><button type="button" onClick={() => { setNotificationsOpen(true); loadUnread(); }} className="relative grid h-10 w-10 place-items-center rounded-lg text-fg-muted hover:bg-surface-2" aria-label="Open notifications"><Bell size={18}/>{unread > 0 && <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-red-600 px-1 text-[9px] font-black text-white">{unread > 99 ? '99+' : unread}</span>}</button><button type="button" onClick={() => search.open()} className="grid h-10 w-10 place-items-center rounded-lg text-fg-muted hover:bg-surface-2" aria-label="Search CivicSync"><Search size={18} /></button><button type="button" onClick={() => ai?.openCopilot()} className="ml-1 inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-civic-500/40 bg-civic-500/10 px-3 text-sm font-bold text-civic-700 transition hover:bg-civic-500/20 dark:text-civic-300" aria-label="Open CivicSync Intelligence"><Sparkles size={16} /><span className="hidden sm:inline">AI</span></button></div></header><main className="p-4 sm:p-7">{children}</main><NotificationCenter open={notificationsOpen} onClose={() => { setNotificationsOpen(false); loadUnread(); }} showSettingsLink={false}/><Modal open={profileOpen} onClose={() => setProfileOpen(false)} title="Profile" subtitle="Authenticated CivicSync emergency staff account" icon="user"><dl className="space-y-3 text-sm"><div><dt className="text-fg-subtle">Name</dt><dd className="font-semibold text-fg">{user?.name || '—'}</dd></div><div><dt className="text-fg-subtle">Email</dt><dd className="font-semibold text-fg">{user?.email || '—'}</dd></div><div><dt className="text-fg-subtle">Role</dt><dd className="font-semibold text-fg">{roleLabels[user?.role] || 'Emergency staff'}</dd></div></dl></Modal></div>
  </div>;
}
