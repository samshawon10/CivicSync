import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Activity, BriefcaseBusiness, ChartNoAxesCombined, ClipboardList, Command, HardHat, History, LogOut, Menu, NotebookPen, ShieldAlert, Users, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import api, { apiMessage } from '../../services/api.js';
import { departmentApi } from '../../services/departmentService.js';
import { mediaUrl } from '../../services/reportService.js';
import { SkeletonKpiGrid, SkeletonTable } from '../../components/ui/Skeleton.jsx';

const statuses = ['pending', 'verified', 'assigned', 'in_progress', 'under_review', 'completed', 'closed'];
const priorities = ['low', 'medium', 'high', 'urgent'];
const categories = ['road_infrastructure', 'street_light', 'garbage_waste', 'drainage', 'water_supply', 'sewerage', 'traffic', 'public_transport', 'footpath', 'illegal_parking', 'public_safety', 'electricity', 'noise_pollution', 'air_pollution', 'water_pollution', 'public_property_damage', 'parks_recreation', 'mosquito_pest_control', 'tree_environment', 'illegal_construction', 'public_health', 'other'];

function title(value = '') {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Not set';
}

function tone(type, value) {
  if (type === 'priority') return {
    urgent: 'border-red-200 bg-red-50 text-red-700',
    high: 'border-amber-200 bg-amber-50 text-amber-700',
    medium: 'border-blue-200 bg-blue-50 text-blue-700',
    low: 'border-slate-200 bg-slate-50 text-slate-600'
  }[value] || 'border-slate-200 bg-slate-50 text-slate-600';
  return {
    pending: 'border-slate-200 bg-slate-50 text-slate-600',
    verified: 'border-blue-200 bg-blue-50 text-blue-700',
    assigned: 'border-indigo-200 bg-indigo-50 text-indigo-700',
    in_progress: 'border-amber-200 bg-amber-50 text-amber-700',
    completed: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    closed: 'border-slate-200 bg-white text-slate-700'
  }[value] || 'border-slate-200 bg-slate-50 text-slate-600';
}

function Badge({ type = 'status', value }) {
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold ${tone(type, value)}`}>{title(value)}</span>;
}

function IconTile({ label }) {
  return <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-civic-50 text-xs font-black text-civic-700">{label}</span>;
}

function Skeleton() {
  return <SkeletonKpiGrid count={4} />;
}

function EmptyState({ title: heading, message }) {
  return <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center"><div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-slate-100 font-black text-slate-500">0</div><h3 className="mt-4 font-bold text-ink">{heading}</h3><p className="mt-1 text-sm text-slate-500">{message}</p></div>;
}

function ErrorState({ message, onRetry }) {
  return <div className="rounded-xl border border-red-100 bg-red-50 p-5"><h3 className="font-bold text-red-800">Something went wrong</h3><p className="mt-1 text-sm text-red-700">{message}</p><button onClick={onRetry} className="mt-4 rounded-lg bg-red-700 px-4 py-2 text-sm font-bold text-white">Try Again</button></div>;
}

function DepartmentShell({ children, active, setActive }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const isHead = user.role === 'department_head';
  const isWorker = user.role === 'field_worker';
  const canManageStaff = ['department_head', 'department_officer'].includes(user.role);
  const roleName = user.role === 'department_head' ? 'Department Head' : user.role === 'department_officer' ? 'Department Officer' : user.role === 'officer' ? 'Officer' : 'Field Worker';
  const homePath = user.role === 'department_head' ? '/dashboard/department-head' : user.role === 'department_officer' ? '/dashboard/department-officer' : user.role === 'officer' ? '/dashboard/officer' : '/dashboard/field-worker';
  const items = isHead
    ? [['overview', 'Command Center', Command], ['complaints', 'Cases', ClipboardList], ['escalations', 'Escalations', ShieldAlert], ['field', 'People & Workload', Users], ['analytics', 'Department Analytics', ChartNoAxesCombined], ['activity', 'Department Activity', History], ['notifications', 'Notifications', Activity]]
    : isWorker
      ? [['overview', 'Home', HardHat], ['complaints', 'My Tasks', ClipboardList], ['notes', 'Case Notes', NotebookPen], ['notifications', 'Notifications', Activity]]
      : [['overview', 'Operations Desk', BriefcaseBusiness], ['complaints', 'Department Cases', ClipboardList], ...(canManageStaff ? [['field', 'Field Workers', Users]] : []), ['notes', 'Case Notes', NotebookPen], ['analytics', 'Workload Analytics', ChartNoAxesCombined], ['notifications', 'Notifications', Activity]];
  async function signOut() { await logout(); navigate('/login'); }
  function go(key) { setActive(key); setOpen(false); }
  const sidebar = <aside className="flex h-full flex-col bg-ink p-5 text-white"><div><Link to={homePath} className="text-xl font-extrabold">Civic<span className="text-civic-300">Sync</span></Link><p className="mt-2 text-xs font-semibold uppercase tracking-wider text-slate-400">{user.departmentName || 'Department workspace'}</p><div className="mt-6 rounded-lg border border-white/10 bg-white/5 p-3"><p className="text-sm font-bold">{user.name}</p><p className="mt-1 text-xs text-slate-300">{roleName}</p></div></div><nav aria-label={`${roleName} navigation`} className="mt-6 space-y-1">{items.map(([key, label, Icon]) => <button key={key} onClick={() => go(key)} aria-current={active === key ? 'page' : undefined} className={`flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-semibold transition ${active === key ? 'bg-white text-ink shadow-sm' : 'text-slate-200 hover:bg-white/10'}`}><Icon size={17} aria-hidden="true" />{label}</button>)}</nav><button onClick={signOut} className="mt-auto flex min-h-11 items-center gap-3 rounded-lg border border-white/15 px-3 text-sm font-bold text-white hover:bg-white/10"><LogOut size={17} />Sign out</button></aside>;
  return <div className="min-h-screen bg-app text-fg lg:grid lg:grid-cols-[260px_1fr]"><div className="hidden lg:block">{sidebar}</div>{open && <div className="fixed inset-0 z-40 lg:hidden"><button aria-label="Close navigation" className="absolute inset-0 bg-ink/45" onClick={() => setOpen(false)} /><div className="relative h-full w-76 max-w-[86vw]">{sidebar}</div></div>}<div className="min-w-0"><header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-surface/95 px-4 py-3 backdrop-blur sm:px-6"><div className="flex min-w-0 items-center gap-3"><button aria-label={open ? 'Close navigation' : 'Open navigation'} onClick={() => setOpen(!open)} className="grid h-10 w-10 place-items-center rounded-lg border border-line text-fg lg:hidden">{open ? <X size={18} /> : <Menu size={18} />}</button><div className="min-w-0"><p className="text-xs font-bold uppercase tracking-wider text-civic-700">{user.departmentName || 'Department'}</p><h1 className="truncate text-lg font-black text-fg">{items.find(([key]) => key === active)?.[1]}</h1></div></div><div className="hidden items-center gap-3 sm:flex"><span className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-bold text-fg-muted">{isHead ? 'Department command' : isWorker ? 'Field operations' : 'Operations desk'}</span>{user.photoURL ? <img src={user.photoURL} alt="" referrerPolicy="no-referrer" className="h-9 w-9 rounded-full object-cover" /> : <span className="grid h-9 w-9 place-items-center rounded-full bg-civic-100 text-sm font-black text-civic-700">{user.name?.[0] || 'U'}</span>}</div></header><main className="mx-auto max-w-7xl p-4 sm:p-6">{children}</main></div></div>;
}

function Overview({ data, loading, error, reload, setActive, isHead }) {
  const stats = data?.stats || {};
  const role = data?.role;
  const cards = isHead
    ? [['Active cases', stats.active, 'AC'], ['Pending review', stats.pending, 'PR'], ['Overdue', stats.overdue, 'OD'], ['Completed', (stats.completed || 0) + (stats.closed || 0), 'CO']]
    : role === 'field_worker' || role === 'officer'
      ? [['My active cases', stats.active, 'AC'], ['Pending cases', stats.pending, 'PC'], ['Assigned tasks', stats.assigned, 'AT'], ['Urgent cases', stats.critical, 'UC']]
      : [['Active cases', stats.active, 'AC'], ['Pending review', stats.pending, 'PR'], ['In progress', stats.inProgress, 'IP'], ['Awaiting verification', stats.completed, 'AV']];
  if (loading) return <Skeleton />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const kpis = isHead
    ? [['Active officers', stats.activeOfficers], ['Field workers', stats.fieldWorkers], ['Urgent reports', stats.critical], ['Unread notifications', stats.unreadNotifications]]
    : [['In progress', stats.inProgress], ['Completed', stats.completed], ['Urgent reports', stats.critical], ['Unread notifications', stats.unreadNotifications]];
  return <div className="space-y-6"><section className="rounded-xl bg-ink p-5 text-white sm:p-6"><p className="text-sm text-civic-100">{isHead ? 'Department command center' : role === 'field_worker' ? 'Your field assignments' : 'Department operations'}</p><h2 className="mt-1 text-2xl font-black sm:text-3xl">Welcome, {data.userName}</h2><p className="mt-2 max-w-2xl text-sm text-slate-300">{isHead ? 'Review workload, assignments and cases that need management attention.' : role === 'field_worker' ? 'Your assigned work and current case status are ready below.' : 'Review the department queue, coordinate assignments and move cases forward.'}</p></section><section aria-label="Case summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{cards.map(([label, value, icon]) => <article key={label} className="rounded-lg border border-line bg-surface p-4 shadow-sm"><div className="flex items-center justify-between"><p className="text-sm font-bold text-fg-muted">{label}</p><IconTile label={icon} /></div><p className="mt-4 text-3xl font-black text-fg">{Number(value || 0).toLocaleString()}</p></article>)}</section><section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{kpis.map(([label, value]) => <div key={label} className="flex items-center justify-between rounded-lg border border-line bg-surface px-4 py-3"><span className="text-sm font-semibold text-fg-muted">{label}</span><span className="text-lg font-black text-fg">{Number(value || 0).toLocaleString()}</span></div>)}</section><section className="grid gap-4 xl:grid-cols-[minmax(220px,.7fr)_minmax(0,2fr)]"><div className="rounded-lg border border-line bg-surface p-5"><h3 className="font-black text-fg">{isHead ? 'Department actions' : role === 'field_worker' ? 'My work' : 'Work queue'}</h3><div className="mt-4 grid gap-2">{(isHead ? [['complaints', 'Review cases'], ['field', 'View team workload'], ['analytics', 'Open analytics']] : role === 'field_worker' ? [['complaints', 'Open my tasks'], ['notifications', 'View notifications']] : [['complaints', 'Open department cases'], ['field', 'View field worker workload'], ['notifications', 'View notifications']]).map(([key, label]) => <button key={label} onClick={() => setActive(key)} className="min-h-11 rounded-lg border border-line px-3 py-2.5 text-left text-sm font-bold text-fg hover:border-civic-300 hover:bg-civic-50 dark:hover:bg-surface-2">{label}</button>)}</div></div><div className="min-w-0 rounded-lg border border-line bg-surface p-5"><div className="flex items-center justify-between gap-3"><h3 className="font-black text-fg">{isHead ? 'Priority cases' : 'Recent cases'}</h3><button onClick={() => setActive('complaints')} className="text-sm font-bold text-civic-700">View queue</button></div><ReportList reports={data?.recent || []} compact /></div></section></div>;
}

function ReportList({ reports, onSelect, compact = false }) {
  if (!reports.length) return <div className="mt-4"><EmptyState title="No active department cases" message="New reports assigned to this department will appear here." /></div>;
  return <div className="mt-4 overflow-x-auto"><table className="w-full min-w-200 text-left text-sm"><thead className="border-b border-line text-xs uppercase text-fg-muted"><tr><th className="px-3 py-2">Case</th><th className="px-3 py-2">Category</th><th className="px-3 py-2">Priority</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Assigned officer</th><th className="px-3 py-2">Due</th>{!compact && <th className="px-3 py-2">Action</th>}</tr></thead><tbody>{reports.map((report) => { const overdue = report.dueAt && new Date(report.dueAt) < new Date() && !['completed', 'closed'].includes(report.status); return <tr key={report._id} className="border-b border-line align-top hover:bg-surface-2"><td className="max-w-xs px-3 py-3"><p className="text-xs font-bold text-fg-muted">#{report._id.slice(-6).toUpperCase()}</p><p className="mt-1 font-bold text-fg">{report.title}</p><p className="line-clamp-2 text-xs text-fg-muted">{report.description}</p></td><td className="px-3 py-3 text-fg-muted">{title(report.category)}</td><td className="px-3 py-3"><Badge type="priority" value={report.priority} /></td><td className="px-3 py-3"><Badge value={report.status} /></td><td className="px-3 py-3 text-fg-muted">{report.assignedOfficer?.name || 'Unassigned'}</td><td className={`px-3 py-3 ${overdue ? 'font-bold text-red-700' : 'text-fg-muted'}`}>{report.dueAt ? `${overdue ? 'Overdue · ' : ''}${formatDate(report.dueAt)}` : 'No due date'}</td>{!compact && <td className="px-3 py-3"><button onClick={() => onSelect(report._id)} className="rounded-lg bg-ink px-3 py-2 text-xs font-bold text-white">Open</button></td>}</tr>; })}</tbody></table></div>;
}

function Complaints({ isHead, canManage, overdueOnly = false }) {
  const [reports, setReports] = useState([]);
  const [selected, setSelected] = useState('');
  const [staff, setStaff] = useState([]);
  const [filters, setFilters] = useState({ search: '', status: '', priority: '', category: '', officer: '', fieldWorker: '', overdue: overdueOnly, sort: 'priority', page: 1 });
  const [meta, setMeta] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  async function load() {
    setLoading(true); setError('');
    try {
      const query = overdueOnly ? { ...filters, overdue: true } : filters;
      const [{ data }, staffResult] = await Promise.all([departmentApi.reports(query), canManage ? departmentApi.staff() : Promise.resolve({ data: { staff: [] } })]);
      setReports(data.reports); setMeta(data.pagination); setStaff(staffResult.data.staff);
    } catch (err) { setError(apiMessage(err)); } finally { setLoading(false); }
  }
  useEffect(() => { const timer = setTimeout(load, 250); return () => clearTimeout(timer); }, [filters]);
  return <div className="space-y-5"><section className="rounded-lg border border-line bg-surface p-4"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><input value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })} placeholder="Search case title or details" aria-label="Search department cases" /><select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value, page: 1 })} aria-label="Status filter"><option value="">All statuses</option>{['pending', 'verified', 'assigned', 'in_progress', 'under_review', 'completed', 'closed'].map((item) => <option key={item} value={item}>{title(item)}</option>)}</select><select value={filters.priority} onChange={(e) => setFilters({ ...filters, priority: e.target.value, page: 1 })} aria-label="Priority filter"><option value="">All priorities</option>{priorities.map((item) => <option key={item} value={item}>{title(item)}</option>)}</select><select value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value, page: 1 })} aria-label="Category filter"><option value="">All categories</option>{categories.map((item) => <option key={item} value={item}>{title(item)}</option>)}</select>{canManage && <><select value={filters.officer} onChange={(e) => setFilters({ ...filters, officer: e.target.value, page: 1 })} aria-label="Officer assignment filter"><option value="">All officers</option>{staff.filter((person) => ['department_officer', 'officer'].includes(person.role)).map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select><select value={filters.fieldWorker} onChange={(e) => setFilters({ ...filters, fieldWorker: e.target.value, page: 1 })} aria-label="Field worker assignment filter"><option value="">All field workers</option>{staff.filter((person) => ['field_worker', 'officer'].includes(person.role)).map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></>}<label className="flex items-center gap-2 text-sm font-semibold text-fg-muted">Sort<select value={filters.sort} onChange={(e) => setFilters({ ...filters, sort: e.target.value, page: 1 })} aria-label="Sort cases"><option value="priority">Priority and due date</option><option value="updated">Recently updated</option><option value="oldest">Oldest first</option></select></label><button onClick={() => setFilters({ search: '', status: '', priority: '', category: '', officer: '', fieldWorker: '', sort: 'priority', page: 1 })} className="min-h-10 rounded-lg border border-line px-4 py-2 text-sm font-bold text-fg">Clear filters</button></div></section>{error ? <ErrorState message={error} onRetry={load} /> : <section className="rounded-lg border border-line bg-surface p-4">{loading ? <SkeletonTable rows={6} columns={7} /> : <ReportList reports={reports} onSelect={setSelected} />}<div className="mt-4 flex items-center justify-between text-sm text-fg-muted"><span>{meta.total || 0} cases</span><div className="flex gap-2"><button disabled={(meta.page || 1) <= 1} onClick={() => setFilters({ ...filters, page: filters.page - 1 })} className="rounded-lg border border-line px-3 py-2 font-bold disabled:opacity-40">Previous</button><button disabled={(meta.page || 1) >= (meta.pages || 1)} onClick={() => setFilters({ ...filters, page: filters.page + 1 })} className="rounded-lg border border-line px-3 py-2 font-bold disabled:opacity-40">Next</button></div></div></section>}{selected && <DetailsModal id={selected} staff={staff} isHead={isHead} canManage={canManage} onClose={() => setSelected('')} onChanged={load} />}</div>;
}

function DepartmentActivity() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  async function load() {
    setLoading(true); setError('');
    try { const { data } = await departmentApi.activity(); setItems(data.activity || []); } catch (err) { setError(apiMessage(err)); } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);
  if (error) return <ErrorState message={error} onRetry={load} />;
  return <section className="rounded-lg border border-line bg-surface p-5"><h2 className="text-lg font-black text-fg">Department activity</h2>{loading ? <div className="mt-5"><SkeletonTable rows={6} columns={3} /></div> : items.length ? <ol className="mt-5 divide-y divide-line">{items.map((item, index) => <li key={`${item.caseId}-${item.timestamp}-${index}`} className="grid grid-cols-[20px_1fr] gap-3 py-4 first:pt-0"><span aria-hidden="true" className="mt-1.5 h-2.5 w-2.5 rounded-full bg-civic-600 ring-4 ring-civic-100" /><div className="min-w-0"><p className="font-semibold text-fg">{item.action} <span className="font-normal text-fg-muted">on</span> {item.caseLabel}</p><p className="mt-1 text-xs text-fg-muted">{title(item.actorRole)} · {formatDate(item.timestamp)}</p>{item.note && <p className="mt-2 whitespace-pre-wrap text-sm text-fg-muted">{item.note}</p>}</div></li>)}</ol> : <div className="mt-5"><EmptyState title="No department activity yet" message="Case assignments, notes, and status changes will be listed here." /></div>}</section>;
}

function CaseNotes() {
  const { user } = useAuth();
  const storageKey = `civicsync.case-note-draft.${user.id}`;
  const [reports, setReports] = useState([]);
  const [draft] = useState(() => { try { return JSON.parse(window.localStorage.getItem(storageKey) || 'null'); } catch { return null; } });
  const [reportId, setReportId] = useState(draft?.reportId || '');
  const [note, setNote] = useState(draft?.note || '');
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline); window.addEventListener('offline', onOffline);
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); };
  }, []);
  useEffect(() => {
    let alive = true;
    departmentApi.reports({ limit: 50, sort: 'priority' }).then(({ data }) => {
      if (!alive) return;
      const cases = data.reports || [];
      setReports(cases);
      setReportId((current) => current || cases[0]?._id || '');
    }).catch((err) => { if (alive) setError(apiMessage(err)); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);
  useEffect(() => { try { if (note) window.localStorage.setItem(storageKey, JSON.stringify({ reportId, note })); else window.localStorage.removeItem(storageKey); } catch { /* Local draft storage may be unavailable. */ } }, [note, reportId, storageKey]);
  async function submit(event) {
    event.preventDefault(); setError(''); setNotice('');
    if (!reports.some((item) => item._id === reportId)) { setError('Choose a case available to your account before submitting this note.'); return; }
    if (!online) { setError('You are offline. The draft is saved on this device; submit it when you reconnect.'); return; }
    setBusy(true);
    try { await departmentApi.note(reportId, note); setNote(''); setNotice('Note added to the case timeline.'); }
    catch (err) { setError(apiMessage(err)); }
    finally { setBusy(false); }
  }
  return <section className="max-w-3xl rounded-lg border border-line bg-surface p-5 sm:p-6"><h2 className="text-lg font-black text-fg">Add a case note</h2><p className="mt-1 text-sm text-fg-muted">Notes are attributed to your account and added to the case timeline.</p><p className={`mt-4 flex items-center gap-2 text-sm font-semibold ${online ? 'text-emerald-700' : 'text-amber-700'}`}><span aria-hidden="true" className={`h-2 w-2 rounded-full ${online ? 'bg-emerald-600' : 'bg-amber-500'}`} />{online ? 'Connected' : 'Offline · draft saved locally'}</p>{error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}{notice && <p role="status" className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}{loading ? <div className="mt-5"><SkeletonTable rows={3} columns={2} /></div> : reports.length ? <form onSubmit={submit} className="mt-5 space-y-4"><label className="block text-sm font-bold text-fg">Case<select required disabled={Boolean(note.trim())} value={reportId} onChange={(event) => setReportId(event.target.value)} className="mt-2 w-full"><option value="">Choose a case</option>{reportId && !reports.some((report) => report._id === reportId) && <option value={reportId}>Saved draft case is unavailable</option>}{reports.map((report) => <option key={report._id} value={report._id}>#{report._id.slice(-6).toUpperCase()} · {report.title}</option>)}</select></label><label className="block text-sm font-bold text-fg">Operational note<textarea required minLength={3} maxLength={1000} rows={5} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Record an update relevant to this case" className="mt-2 w-full" /></label><div className="flex flex-wrap items-center justify-between gap-3"><span className="text-xs text-fg-muted">{note.length}/1000 characters</span><button type="submit" disabled={busy || !reportId || note.trim().length < 3} className="min-h-11 rounded-lg bg-civic-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{busy ? 'Submitting…' : 'Submit note'}</button></div></form> : <div className="mt-5"><EmptyState title="No active department cases" message="A note can be added once a report is assigned to your department." /></div>}</section>;
}

function DetailsModal({ id, staff, isHead, canManage, onClose, onChanged }) {
  const { user } = useAuth();
  const isFieldWorker = ['field_worker', 'officer'].includes(user.role);
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ officerId: '', fieldWorkerId: '', status: '', priority: '', summary: '', materials: '', notes: '' });
  async function load() {
    setError('');
    try {
      const { data } = await departmentApi.report(id);
      setReport(data.report);
      setForm((old) => ({ ...old, status: data.report.status, priority: data.report.priority, officerId: data.report.assignedOfficer?._id || '', fieldWorkerId: data.report.assignedFieldWorker?._id || '' }));
    } catch (err) { setError(apiMessage(err)); }
  }
  useEffect(() => { load(); }, [id]);
  async function act(callback) {
    setBusy(true); setError('');
    try { await callback(); await load(); onChanged(); } catch (err) { setError(apiMessage(err)); } finally { setBusy(false); }
  }
  const officers = staff.filter((person) => ['department_officer', 'officer'].includes(person.role));
  const workers = staff.filter((person) => ['field_worker', 'officer'].includes(person.role));
  const nextStatusByCurrent = { pending: ['verified'], verified: ['assigned'], assigned: ['in_progress'], in_progress: ['under_review'], under_review: ['completed'], completed: ['closed'], closed: [] };
  const statuses = report ? [report.status, ...(nextStatusByCurrent[report.status] || [])] : [];
  return <div className="fixed inset-0 z-50 grid place-items-end bg-ink/45 p-0 sm:place-items-center sm:p-4"><section className="max-h-[96vh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:max-w-5xl sm:rounded-2xl"><header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white p-4"><div>{report && <p className="text-xs font-bold uppercase tracking-wider text-civic-700">Complaint #{report._id.slice(-6).toUpperCase()}</p>}<h2 className="text-xl font-black text-ink">{report?.title || 'Loading complaint'}</h2></div><button onClick={onClose} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-black">Close</button></header><div className="p-4 sm:p-5">{error && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}{!report ? <div className="h-96 animate-pulse rounded-xl bg-slate-100" /> : <div className="grid gap-5 lg:grid-cols-[1.3fr_.7fr]"><div className="space-y-5"><section className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap gap-2"><Badge type="priority" value={report.priority} /><Badge value={report.status} /></div><p className="mt-4 text-sm leading-6 text-slate-700">{report.description}</p><dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><div><dt className="font-bold text-slate-500">Citizen</dt><dd className="text-ink">{report.createdBy?.name || 'Unknown'}</dd></div><div><dt className="font-bold text-slate-500">Location</dt><dd className="text-ink">{report.location?.address || report.location?.area || 'No location provided'}</dd></div><div><dt className="font-bold text-slate-500">Category</dt><dd className="text-ink">{title(report.category)}</dd></div><div><dt className="font-bold text-slate-500">Created</dt><dd className="text-ink">{formatDate(report.createdAt)}</dd></div></dl></section><section className="rounded-xl border border-slate-200 p-4"><h3 className="font-black text-ink">Status Timeline</h3><div className="mt-4 space-y-3">{(report.activity || []).map((item, index) => <div key={`${item.timestamp}-${index}`} className="grid grid-cols-[28px_1fr] gap-3"><span className="mt-1 h-3 w-3 rounded-full bg-civic-600 ring-4 ring-civic-100" /><div><p className="text-sm font-bold text-ink">{item.action}</p><p className="text-xs text-slate-500">{title(item.actorRole)} - {formatDate(item.timestamp)}</p>{item.note && <p className="mt-1 text-sm text-slate-600">{item.note}</p>}</div></div>)}</div></section><section className="rounded-xl border border-slate-200 p-4"><h3 className="font-black text-ink">Evidence</h3>{report.attachments?.length ? <div className="mt-4 grid gap-3 sm:grid-cols-2">{report.attachments.map((item) => <a key={item.filename} href={mediaUrl(item)} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border border-slate-200 bg-slate-50">{item.mediaType === 'image' ? <img src={mediaUrl(item)} alt={item.originalName} className="h-44 w-full object-cover" /> : <div className="grid h-44 place-items-center text-sm font-bold text-slate-600">Open video</div>}<p className="truncate p-2 text-xs font-semibold text-slate-600">{item.originalName}</p></a>)}</div> : <p className="mt-3 text-sm text-slate-500">No media attached.</p>}</section></div><aside className="space-y-4"><section className="rounded-xl border border-slate-200 p-4"><h3 className="font-black text-ink">Workflow Actions</h3>{isHead && <div className="mt-4 space-y-3"><label className="block text-xs font-bold text-slate-500">Priority<select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>{priorities.map((item) => <option key={item} value={item}>{title(item)}</option>)}</select></label><button disabled={busy} onClick={() => act(() => departmentApi.priority(id, form.priority))} className="w-full rounded-lg bg-ink px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Save Priority</button></div>}{canManage && <div className="mt-4 space-y-3"><label className="block text-xs font-bold text-slate-500">Officer<select value={form.officerId} onChange={(e) => setForm({ ...form, officerId: e.target.value })}><option value="">Unassigned</option>{officers.map((person) => <option key={person.id} value={person.id}>{person.name} ({person.workload})</option>)}</select></label><label className="block text-xs font-bold text-slate-500">Field Worker<select value={form.fieldWorkerId} onChange={(e) => setForm({ ...form, fieldWorkerId: e.target.value })}><option value="">Unassigned</option>{workers.map((person) => <option key={person.id} value={person.id}>{person.name} ({person.workload})</option>)}</select></label><button disabled={busy} onClick={() => act(() => departmentApi.assign(id, { officerId: form.officerId, fieldWorkerId: form.fieldWorkerId }))} className="w-full rounded-lg bg-civic-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Update Assignment</button></div>}<div className="mt-4 space-y-3"><label className="block text-xs font-bold text-slate-500">Status<select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{statuses.map((item) => <option key={item} value={item}>{title(item)}</option>)}</select></label><button disabled={busy} onClick={() => act(() => departmentApi.status(id, form.status))} className="w-full rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-ink disabled:opacity-50">Update Status</button></div></section><section className="rounded-xl border border-slate-200 p-4"><h3 className="font-black text-ink">Completion Report</h3>{report.completionReport?.summary && <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700"><p className="font-bold text-ink">{title(report.completionReport.verificationStatus)}</p><p className="mt-1">{report.completionReport.summary}</p></div>}<div className="mt-3 space-y-3"><textarea rows="3" value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} placeholder="Work summary" /><textarea rows="2" value={form.materials} onChange={(e) => setForm({ ...form, materials: e.target.value })} placeholder="Materials or actions" /><textarea rows="2" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Notes" /><button disabled={busy} onClick={() => act(() => departmentApi.complete(id, form))} className="w-full rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Submit Completion</button>{isHead && <div className="grid grid-cols-2 gap-2"><button disabled={busy} onClick={() => act(() => departmentApi.reviewCompletion(id, { verificationStatus: 'approved' }))} className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700">Approve</button><button disabled={busy} onClick={() => act(() => departmentApi.reviewCompletion(id, { verificationStatus: 'rejected' }))} className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700">Reject</button></div>}</div></section></aside></div>}</div></section></div>;
}

function FieldOperations() {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  async function load() {
    setLoading(true); setError('');
    try { const { data } = await departmentApi.staff(); setStaff(data.staff || []); } catch (err) { setError(apiMessage(err)); } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);
  return <section className="rounded-lg border border-line bg-surface p-5"><h2 className="text-lg font-black text-fg">Department workload</h2><p className="mt-1 text-sm text-fg-muted">Active assignments for department staff.</p>{error ? <ErrorState message={error} onRetry={load} /> : loading ? <div className="mt-5"><SkeletonTable rows={5} columns={3} /></div> : staff.length ? <div className="mt-5 overflow-x-auto"><table className="w-full min-w-120 text-left text-sm"><thead className="border-b border-line text-xs uppercase text-fg-muted"><tr><th className="px-3 py-2">Staff member</th><th className="px-3 py-2">Role</th><th className="px-3 py-2">Active workload</th></tr></thead><tbody>{staff.map((person) => <tr key={person.id} className="border-b border-line"><td className="px-3 py-3 font-bold text-fg">{person.name}</td><td className="px-3 py-3 text-fg-muted">{title(person.role)}</td><td className="px-3 py-3 font-bold text-fg">{person.workload}</td></tr>)}</tbody></table></div> : <div className="mt-5"><EmptyState title="No active department staff" message="Active officers and field workers appear here when assigned to the department." /></div>}</section>;
}

function Analytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  async function load() { setLoading(true); setError(''); try { const { data } = await departmentApi.analytics(); setData(data.analytics); } catch (err) { setError(apiMessage(err)); } finally { setLoading(false); } }
  useEffect(() => { load(); }, []);
  const groups = [['By Status', data?.byStatus], ['By Category', data?.byCategory], ['By Priority', data?.byPriority], ['Over Time', data?.overTime]];
  const max = Math.max(1, ...groups.flatMap(([, rows]) => (rows || []).map((row) => row.count)));
  if (error) return <ErrorState message={error} onRetry={load} />;
  return <div className="grid gap-4 lg:grid-cols-2">{groups.map(([heading, rows]) => <section key={heading} className="rounded-lg border border-line bg-surface p-5"><h2 className="font-black text-fg">{heading}</h2>{loading ? <div className="mt-5"><SkeletonTable rows={4} columns={2} /></div> : rows?.length ? <div className="mt-5 space-y-3">{rows.map((row) => <div key={row._id}><div className="flex justify-between text-sm"><span className="font-bold text-fg">{title(row._id)}</span><span className="text-fg-muted">{row.count}</span></div><div className="mt-1 h-2 rounded-full bg-surface-2"><div className="h-2 rounded-full bg-civic-600" style={{ width: `${(row.count / max) * 100}%` }} /></div></div>)}</div> : <p className="mt-5 rounded-lg bg-surface-2 p-5 text-sm text-fg-muted">No recorded data for this period.</p>}</section>)}</div>;
}

function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [error, setError] = useState('');
  async function load() {
    try { const { data } = await api.get('/notifications'); setNotifications(data.notifications); } catch (err) { setError(apiMessage(err)); }
  }
  useEffect(() => { load(); }, []);
  async function mark(id) { await api.patch(`/notifications/${id}/read`); load(); }
  return <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-black text-ink">Notification Center</h2>{error && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}<div className="mt-5 space-y-3">{notifications.map((item) => <button key={item._id} onClick={() => mark(item._id)} className={`w-full rounded-xl border p-4 text-left transition hover:border-civic-300 ${item.readAt ? 'border-slate-200 bg-white' : 'border-civic-200 bg-civic-50'}`}><p className="font-bold text-ink">{item.message}</p><p className="mt-1 text-xs text-slate-500">{formatDate(item.createdAt)}</p></button>)}</div>{!notifications.length && <div className="mt-4"><EmptyState title="No notifications" message="Assignments, status changes, and approvals will show here." /></div>}</section>;
}

export default function DepartmentDashboard({ role }) {
  const { user } = useAuth();
  const [active, setActive] = useState('overview');
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const isHead = role === 'department_head';
  const canManage = ['department_head', 'department_officer'].includes(role);
  const data = useMemo(() => ({ ...dashboardData, role, userName: user.name }), [dashboardData, role, user.name]);
  async function loadDashboard() {
    setLoading(true); setError('');
    try { const { data } = await departmentApi.dashboard(); setDashboardData(data); } catch (err) { setError(apiMessage(err)); } finally { setLoading(false); }
  }
  useEffect(() => { loadDashboard(); }, []);
  const activeLabel = { overview: isHead ? 'Department command center' : role === 'field_worker' ? 'My active work' : 'Operations queue', complaints: role === 'field_worker' ? 'Assigned tasks' : 'Department cases', escalations: 'Overdue and unresolved cases', field: isHead ? 'People and workload' : 'Field worker workload', analytics: isHead ? 'Department analytics' : 'Workload analytics', activity: 'Department activity', notes: 'Case notes', notifications: 'Notifications' }[active];
  return <DepartmentShell active={active} setActive={setActive}><div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm font-bold text-civic-700">{isHead ? 'Department-wide command center' : role === 'field_worker' ? 'Assigned field work' : 'Assigned operations workspace'}</p><h2 className="text-2xl font-black text-fg">{activeLabel}</h2></div><span className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-bold text-fg-muted">{new Date().toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}</span></div>{active === 'overview' && <Overview data={data} loading={loading} error={error} reload={loadDashboard} setActive={setActive} isHead={isHead} />}{active === 'complaints' && <Complaints isHead={isHead} canManage={canManage} />}{active === 'escalations' && <Complaints isHead canManage overdueOnly />}{active === 'field' && <FieldOperations />}{active === 'analytics' && <Analytics />}{active === 'activity' && <DepartmentActivity />}{active === 'notes' && <CaseNotes />}{active === 'notifications' && <Notifications />}</DepartmentShell>;
}
