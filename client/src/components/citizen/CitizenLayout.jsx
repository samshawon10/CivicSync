import { Bell, ClipboardList, FilePlus2, Hospital, LayoutDashboard, MapPinned, Menu, Moon, PhoneCall, Search, Settings, ShieldCheck, Siren, Sparkles, Sun, UserRound, UsersRound, X } from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import PageHead from '../../components/ui/PageHead.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useTheme } from '../../context/ThemeContext.jsx';
import { useGlobalSearch } from '../search/GlobalSearch.jsx';
import { useCivicAIContext } from '../ai/CivicAIProvider.jsx';

const links = [
  ['Overview', '/dashboard/citizen', LayoutDashboard], ['SOS / Emergency', '/dashboard/citizen/emergency', Siren],
  ['Report Emergency', '/dashboard/citizen/emergency/new', ClipboardList], ['Women Safety', '/dashboard/citizen/women-safety', ShieldCheck],
  ['Safety Map', '/dashboard/citizen/safety-map', MapPinned], ['Safety Alerts', '/dashboard/citizen/alerts', Bell],
  ['Nearby Services', '/dashboard/citizen/nearby-services', Hospital], ['Emergency Contacts', '/dashboard/citizen/emergency-contacts', PhoneCall],
  ['Community', '/dashboard/citizen/community', UsersRound],
  ['My Reports', '/dashboard/citizen/reports', ClipboardList], ['Create Report', '/dashboard/citizen/reports/new', FilePlus2], ['Notifications', '/dashboard/citizen/notifications', Bell],
  ['Profile', '/dashboard/citizen/profile', UserRound], ['Settings', '/dashboard/citizen/settings', Settings]
];

export default function CitizenLayout({ title, children, unreadCount = 0 }) {
  const { user, logout } = useAuth();
  const { resolved, toggle } = useTheme();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const search = useGlobalSearch();
  const ai = useCivicAIContext();
  async function signOut() { await logout(); navigate('/login'); }
  const sidebar = (
    <aside className="flex h-full flex-col bg-ink p-5 text-white">
      <div className="flex items-center justify-between">
        <NavLink onClick={() => setOpen(false)} to="/dashboard/citizen" className="text-xl font-extrabold tracking-tight">Civic<span className="text-civic-300">Sync</span></NavLink>
        <button onClick={() => setOpen(false)} className="grid h-11 w-11 place-items-center rounded-lg text-slate-300 lg:hidden" aria-label="Close navigation"><X size={21} /></button>
      </div>
      <p className="mt-2 text-xs font-bold uppercase tracking-[.16em] text-slate-400">Citizen services</p>
      <nav className="mt-7 space-y-1">{links.map(([label, to, NavIcon]) => (
        <NavLink end={to === '/dashboard/citizen'} key={to} onClick={() => setOpen(false)} to={to} className={({ isActive }) => `flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold transition ${isActive ? 'bg-civic-600 text-white shadow-sm' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`}>
          <NavIcon size={18} aria-hidden="true" /><span>{label}</span>
        </NavLink>
      ))}</nav>
      <div className="mt-auto border-t border-white/10 pt-4">
        <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-full bg-civic-100 font-bold text-civic-800">{user?.name?.[0]?.toUpperCase() || 'C'}</span><div className="min-w-0"><p className="truncate text-sm font-semibold">{user?.name}</p><p className="truncate text-xs text-slate-400">Citizen</p></div></div>
        <button onClick={signOut} className="mt-4 min-h-11 w-full rounded-lg border border-white/20 px-3 text-sm font-bold hover:bg-white/10">Log out</button>
      </div>
    </aside>
  );
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 lg:grid lg:grid-cols-[250px_1fr]">
      <PageHead title={title} description={`${title} services and tools from CivicSync.`} />
      <div className={`${open ? 'translate-x-0' : '-translate-x-full'} fixed inset-y-0 left-0 z-40 w-72 transition-transform duration-200 lg:static lg:w-auto lg:translate-x-0`}>{sidebar}</div>
      {open && <button aria-label="Close navigation overlay" onClick={() => setOpen(false)} className="fixed inset-0 z-30 bg-slate-950/35 lg:hidden" />}
      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex min-h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 sm:px-8">
          <div className="flex items-center gap-3"><button onClick={() => setOpen(true)} className="grid h-11 w-11 place-items-center rounded-lg border border-slate-200 lg:hidden" aria-label="Open navigation"><Menu size={21} /></button><div><p className="text-xs font-bold tracking-[.14em] text-civic-600">CITIZEN PORTAL</p><h1 className="font-bold text-ink">{title}</h1></div></div>
          <div className="flex items-center gap-1">{ai && <button type="button" onClick={() => ai.openCopilot()} className="flex h-10 items-center gap-1.5 rounded-lg px-2.5 text-civic-700 hover:bg-civic-500/10 dark:text-civic-300" aria-label="Open CivicSync Intelligence"><Sparkles size={18} aria-hidden="true" /><span className="hidden text-sm font-bold sm:inline">AI</span></button>}<button type="button" onClick={() => search.open()} className="grid h-10 w-10 place-items-center rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800" aria-label="Search CivicSync"><Search size={18} /></button><button type="button" onClick={toggle} className="grid h-10 w-10 place-items-center rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800" aria-label={`Switch to ${resolved === 'dark' ? 'light' : 'dark'} theme`}>{resolved === 'dark' ? <Sun size={18} /> : <Moon size={18} />}</button><NavLink to="/dashboard/citizen/notifications" className="relative grid h-10 w-10 place-items-center rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800" aria-label={unreadCount ? `${unreadCount} unread notifications` : 'Notifications'}><Bell size={18} />{unreadCount > 0 && <span className="absolute right-1 top-1 grid min-w-4 h-4 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">{unreadCount > 9 ? '9+' : unreadCount}</span>}</NavLink><span className="hidden text-sm text-slate-500 dark:text-slate-300 sm:block">{user?.name}</span></div>
        </header>
        <main className="mx-auto max-w-7xl p-4 pb-24 sm:p-7 lg:pb-7">{children}</main>
        <nav aria-label="Mobile quick navigation" className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-slate-200 bg-white/95 px-2 py-2 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 lg:hidden">{[['Home', '/dashboard/citizen', LayoutDashboard], ['Cases', '/dashboard/citizen/reports', ClipboardList], ['Help', '/dashboard/citizen/emergency', Siren], ['Profile', '/dashboard/citizen/profile', UserRound]].map(([label, to, NavIcon]) => <NavLink end={to === '/dashboard/citizen'} key={to} to={to} className={({ isActive }) => `grid min-h-12 place-items-center gap-0.5 rounded-lg text-[11px] font-bold ${isActive ? 'text-civic-700 dark:text-civic-300' : 'text-slate-500 dark:text-slate-400'}`}><NavIcon size={18} /><span>{label}</span></NavLink>)}</nav>
      </div>
    </div>
  );
}
