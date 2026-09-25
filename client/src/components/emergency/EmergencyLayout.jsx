import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { roleLabels } from '../../utils/roles.js';
import { useGlobalSearch } from '../search/GlobalSearch.jsx';

const linksByRole = {
  emergency_department_head: [['/dashboard/emergency-head', 'Command center'], ['/dashboard/emergency-head/analytics', 'Analytics']],
  emergency_department_officer: [['/dashboard/emergency-officer', 'Assigned emergencies']],
  emergency_officer: [['/dashboard/emergency-officer', 'Assigned emergencies']],
  emergency_field_worker: [['/dashboard/emergency-field-worker', 'My assignments']]
};

export default function EmergencyLayout({ title, children }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const links = linksByRole[user?.role] || linksByRole.emergency_department_head;
  const search = useGlobalSearch();

  async function signOut() {
    await logout();
    navigate('/login');
  }

  return <div className="min-h-screen bg-slate-50 lg:grid lg:grid-cols-[250px_1fr]">
    <aside className="flex h-full flex-col bg-ink p-5 text-white">
      <div><p className="text-xl font-black tracking-tight">Civic<span className="text-civic-300">Sync</span></p><p className="mt-2 text-xs font-bold uppercase tracking-[.16em] text-civic-200">Emergency response</p></div>
      <nav className="mt-8 space-y-1" aria-label="Emergency navigation">{links.map(([to, text]) => <NavLink key={to} to={to} end className={({ isActive }) => `flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold transition ${isActive || (to === '/dashboard/emergency-head' && location.pathname.startsWith(to)) ? 'bg-civic-600 text-white' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`}>{text}</NavLink>)}</nav>
      <div className="mt-auto border-t border-white/10 pt-4"><p className="truncate text-sm font-semibold">{user?.name}</p><p className="mt-1 text-xs text-slate-400">{roleLabels[user?.role] || 'Emergency staff'}</p><button onClick={signOut} className="mt-4 min-h-11 w-full rounded-lg border border-white/20 px-3 text-sm font-bold text-white hover:bg-white/10">Log out</button></div>
    </aside>
    <div className="min-w-0"><header className="flex min-h-16 items-center border-b border-slate-200 bg-white px-4 sm:px-8"><div><p className="text-xs font-bold tracking-[.14em] text-civic-600">EMERGENCY OPERATIONS</p><h1 className="text-lg font-black text-ink">{title}</h1></div><button type="button" onClick={() => search.open()} className="ml-auto grid h-10 w-10 place-items-center rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800" aria-label="Search CivicSync"><Search size={18} /></button></header><main className="p-4 sm:p-7">{children}</main></div>
  </div>;
}
