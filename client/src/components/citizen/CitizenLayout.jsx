import { Bell, ClipboardList, FilePlus2, Hospital, LayoutDashboard, MapPinned, Menu, PhoneCall, Settings, ShieldCheck, Siren, UserRound, X } from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import PageHead from '../../components/ui/PageHead.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

const links = [
  ['Overview', '/dashboard/citizen', LayoutDashboard], ['SOS / Emergency', '/dashboard/citizen/emergency', Siren],
  ['Report Emergency', '/dashboard/citizen/emergency/new', ClipboardList], ['Women Safety', '/dashboard/citizen/women-safety', ShieldCheck],
  ['Safety Map', '/dashboard/citizen/safety-map', MapPinned], ['Safety Alerts', '/dashboard/citizen/alerts', Bell],
  ['Nearby Services', '/dashboard/citizen/nearby-services', Hospital], ['Emergency Contacts', '/dashboard/citizen/emergency-contacts', PhoneCall],
  ['My Reports', '/dashboard/citizen/reports', ClipboardList], ['Create Report', '/dashboard/citizen/reports/new', FilePlus2], ['Notifications', '/dashboard/citizen/notifications', Bell],
  ['Profile', '/dashboard/citizen/profile', UserRound], ['Settings', '/dashboard/citizen/settings', Settings]
];

export default function CitizenLayout({ title, children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
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
    <div className="min-h-screen bg-slate-50 lg:grid lg:grid-cols-[250px_1fr]">
      <PageHead title={title} description={`${title} services and tools from CivicSync.`} />
      <div className={`${open ? 'translate-x-0' : '-translate-x-full'} fixed inset-y-0 left-0 z-40 w-72 transition-transform duration-200 lg:static lg:w-auto lg:translate-x-0`}>{sidebar}</div>
      {open && <button aria-label="Close navigation overlay" onClick={() => setOpen(false)} className="fixed inset-0 z-30 bg-slate-950/35 lg:hidden" />}
      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex min-h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-8">
          <div className="flex items-center gap-3"><button onClick={() => setOpen(true)} className="grid h-11 w-11 place-items-center rounded-lg border border-slate-200 lg:hidden" aria-label="Open navigation"><Menu size={21} /></button><div><p className="text-xs font-bold tracking-[.14em] text-civic-600">CITIZEN PORTAL</p><h1 className="font-bold text-ink">{title}</h1></div></div>
          <span className="hidden text-sm text-slate-500 sm:block">{user?.name}</span>
        </header>
        <main className="mx-auto max-w-7xl p-4 sm:p-7">{children}</main>
      </div>
    </div>
  );
}
