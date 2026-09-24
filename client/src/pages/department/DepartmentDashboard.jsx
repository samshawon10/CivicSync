import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import api, { apiMessage } from '../../services/api.js';
import { departmentApi } from '../../services/departmentService.js';
import { mediaUrl } from '../../services/reportService.js';

const statuses = ['pending', 'verified', 'assigned', 'in_progress', 'completed', 'closed'];
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
  return <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-32 animate-pulse rounded-xl border border-slate-200 bg-white" />)}</div>;
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
  const canManageStaff = ['department_head', 'department_officer'].includes(user.role);
  const roleName = user.role === 'department_head' ? 'Department Head' : user.role === 'department_officer' ? 'Department Officer' : user.role === 'officer' ? 'Officer' : 'Field Worker';
  const homePath = user.role === 'department_head' ? '/dashboard/department-head' : user.role === 'department_officer' ? '/dashboard/department-officer' : user.role === 'officer' ? '/dashboard/officer' : '/dashboard/field-worker';
  const items = [
    ['overview', 'Dashboard', 'DB'],
    ['complaints', isHead ? 'Complaints' : 'My Complaints', 'CP'],
    ...(canManageStaff ? [['field', 'Field Operations', 'FO'], ['analytics', 'Analytics', 'AN']] : []),
    ['notifications', 'Notifications', 'NT']
  ];
  async function signOut() { await logout(); navigate('/login'); }
  function go(key) { setActive(key); setOpen(false); }
  const sidebar = <aside className="flex h-full flex-col bg-ink p-5 text-white"><div><Link to={homePath} className="text-xl font-extrabold">Civic<span className="text-civic-300">Sync</span></Link><p className="mt-2 text-xs font-semibold uppercase tracking-wider text-slate-400">{user.departmentName || 'Department workspace'}</p><div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-3"><p className="text-sm font-bold">{user.name}</p><p className="mt-1 text-xs text-slate-300">{roleName}</p></div></div><nav className="mt-6 space-y-1">{items.map(([key, label, icon]) => <button key={key} onClick={() => go(key)} className={`flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-semibold transition ${active === key ? 'bg-white text-ink shadow-sm' : 'text-slate-200 hover:bg-white/10'}`}><span className="grid h-7 w-7 place-items-center rounded-md bg-white/10 text-[10px] font-black">{icon}</span>{label}</button>)}</nav><button onClick={signOut} className="mt-auto min-h-11 rounded-lg border border-white/15 px-3 text-sm font-bold text-white hover:bg-white/10">Logout</button></aside>;
  return <div className="min-h-screen bg-slate-50 lg:grid lg:grid-cols-[280px_1fr]"><div className="hidden lg:block">{sidebar}</div>{open && <div className="fixed inset-0 z-40 lg:hidden"><button aria-label="Close navigation" className="absolute inset-0 bg-ink/45" onClick={() => setOpen(false)} /><div className="relative h-full w-76 max-w-[86vw]">{sidebar}</div></div>}<div className="min-w-0"><header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-6"><div className="flex min-w-0 items-center gap-3"><button aria-label="Open navigation" onClick={() => setOpen(true)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-black text-ink lg:hidden">ME</button><div className="min-w-0"><p className="text-xs font-bold uppercase tracking-wider text-civic-700">{user.departmentName || 'Department'}</p><h1 className="truncate text-lg font-black text-ink">{items.find(([key]) => key === active)?.[1]}</h1></div></div><div className="hidden items-center gap-3 sm:flex"><span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600">{isHead ? 'Command Center' : 'Operations Desk'}</span>{user.photoURL ? <img src={user.photoURL} alt="" referrerPolicy="no-referrer" className="h-9 w-9 rounded-full object-cover" /> : <span className="grid h-9 w-9 place-items-center rounded-full bg-civic-100 text-sm font-black text-civic-700">{user.name?.[0] || 'U'}</span>}</div></header><main className="mx-auto max-w-7xl p-4 sm:p-6">{children}</main></div></div>;
}

function Overview({ data, loading, error, reload, setActive, isHead }) {
  const stats = data?.stats || {};
  const cards = [
    ['Total Complaints', stats.total, 'TC'],
    ['Pending Review', stats.pending, 'PR'],
    ['In Progress', stats.inProgress, 'IP'],
    ['Completed', stats.completed, 'CO'],
    ['Critical', stats.critical, 'CR'],
    ['Unread Alerts', stats.unreadNotifications, 'NT']
  ];
  if (loading) return <Skeleton />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  return <div className="space-y-6"><section className="rounded-2xl bg-ink p-5 text-white sm:p-6"><p className="text-sm text-civic-100">Good morning,</p><h2 className="mt-1 text-2xl font-black sm:text-3xl">{data.userName}</h2><p className="mt-2 max-w-2xl text-sm text-slate-300">Department operations overview powered by live CivicSync reports and assignments.</p></section><section className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">{cards.map(([label, value, icon]) => <article key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><div className="flex items-center justify-between"><p className="text-sm font-bold text-slate-500">{label}</p><IconTile label={icon} /></div><p className="mt-5 text-3xl font-black text-ink">{Number(value || 0).toLocaleString()}</p><p className="mt-1 text-xs font-semibold text-slate-500">Live department data</p></article>)}</section><section className="grid gap-4 lg:grid-cols-[1fr_2fr]"><div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="font-black text-ink">Quick Actions</h3><div className="mt-4 grid gap-2">{(isHead ? [['complaints', 'Review complaints'], ['complaints', 'Assign personnel'], ['field', 'Review completed work'], ['analytics', 'View performance']] : [['complaints', 'My complaints'], ['complaints', 'Update status'], ['field', 'Submit completion report'], ['notifications', 'Check notifications']]).map(([key, label]) => <button key={label} onClick={() => setActive(key)} className="rounded-lg border border-slate-200 px-3 py-2.5 text-left text-sm font-bold text-ink hover:border-civic-300 hover:bg-civic-50">{label}</button>)}</div></div><div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between gap-3"><h3 className="font-black text-ink">Important Complaints</h3><button onClick={() => setActive('complaints')} className="text-sm font-bold text-civic-700">View all</button></div><ReportList reports={data?.recent || []} compact /></div></section></div>;
}

function ReportList({ reports, onSelect, compact = false }) {
  if (!reports.length) return <div className="mt-4"><EmptyState title="No complaints found" message="New department complaints will appear here." /></div>;
  return <div className="mt-4 overflow-x-auto"><table className="w-full min-w-200 text-left text-sm"><thead className="border-b border-slate-200 text-xs uppercase text-slate-500"><tr><th className="px-3 py-2">Complaint</th><th className="px-3 py-2">Category</th><th className="px-3 py-2">Priority</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Officer</th><th className="px-3 py-2">Updated</th>{!compact && <th className="px-3 py-2">Action</th>}</tr></thead><tbody>{reports.map((report) => <tr key={report._id} className="border-b border-slate-100 align-top hover:bg-slate-50"><td className="max-w-xs px-3 py-3"><p className="font-bold text-ink">{report.title}</p><p className="line-clamp-2 text-xs text-slate-500">{report.description}</p></td><td className="px-3 py-3 text-slate-600">{title(report.category)}</td><td className="px-3 py-3"><Badge type="priority" value={report.priority} /></td><td className="px-3 py-3"><Badge value={report.status} /></td><td className="px-3 py-3 text-slate-600">{report.assignedOfficer?.name || 'Unassigned'}</td><td className="px-3 py-3 text-slate-500">{formatDate(report.updatedAt)}</td>{!compact && <td className="px-3 py-3"><button onClick={() => onSelect(report._id)} className="rounded-lg bg-ink px-3 py-2 text-xs font-bold text-white">Open</button></td>}</tr>)}</tbody></table></div>;
}

function Complaints({ isHead, canManage }) {
  const [reports, setReports] = useState([]);
  const [selected, setSelected] = useState('');
  const [staff, setStaff] = useState([]);
  const [filters, setFilters] = useState({ search: '', status: '', priority: '', category: '', page: 1 });
  const [meta, setMeta] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  async function load() {
    setLoading(true); setError('');
    try {
      const [{ data }, staffResult] = await Promise.all([departmentApi.reports(filters), canManage ? departmentApi.staff() : Promise.resolve({ data: { staff: [] } })]);
      setReports(data.reports); setMeta(data.pagination); setStaff(staffResult.data.staff);
    } catch (err) { setError(apiMessage(err)); } finally { setLoading(false); }
  }
  useEffect(() => { const timer = setTimeout(load, 250); return () => clearTimeout(timer); }, [filters]);
  return <div className="space-y-5"><section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="grid gap-3 md:grid-cols-[2fr_1fr_1fr_1fr_auto]"><input value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })} placeholder="Search complaints..." aria-label="Search complaints" /><select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value, page: 1 })} aria-label="Status filter"><option value="">All statuses</option>{statuses.map((item) => <option key={item} value={item}>{title(item)}</option>)}</select><select value={filters.priority} onChange={(e) => setFilters({ ...filters, priority: e.target.value, page: 1 })} aria-label="Priority filter"><option value="">All priorities</option>{priorities.map((item) => <option key={item} value={item}>{title(item)}</option>)}</select><select value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value, page: 1 })} aria-label="Category filter"><option value="">All categories</option>{categories.map((item) => <option key={item} value={item}>{title(item)}</option>)}</select><button onClick={() => setFilters({ search: '', status: '', priority: '', category: '', page: 1 })} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700">Clear</button></div></section>{error ? <ErrorState message={error} onRetry={load} /> : <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">{loading ? <div className="h-80 animate-pulse rounded-lg bg-slate-100" /> : <ReportList reports={reports} onSelect={setSelected} />}<div className="mt-4 flex items-center justify-between text-sm text-slate-500"><span>{meta.total || 0} complaints</span><div className="flex gap-2"><button disabled={(meta.page || 1) <= 1} onClick={() => setFilters({ ...filters, page: filters.page - 1 })} className="rounded-lg border border-slate-200 px-3 py-2 font-bold disabled:opacity-40">Previous</button><button disabled={(meta.page || 1) >= (meta.pages || 1)} onClick={() => setFilters({ ...filters, page: filters.page + 1 })} className="rounded-lg border border-slate-200 px-3 py-2 font-bold disabled:opacity-40">Next</button></div></div></section>}{selected && <DetailsModal id={selected} staff={staff} isHead={isHead} canManage={canManage} onClose={() => setSelected('')} onChanged={load} />}</div>;
}

function DetailsModal({ id, staff, isHead, canManage, onClose, onChanged }) {
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
  return <div className="fixed inset-0 z-50 grid place-items-end bg-ink/45 p-0 sm:place-items-center sm:p-4"><section className="max-h-[96vh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:max-w-5xl sm:rounded-2xl"><header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white p-4"><div>{report && <p className="text-xs font-bold uppercase tracking-wider text-civic-700">Complaint #{report._id.slice(-6).toUpperCase()}</p>}<h2 className="text-xl font-black text-ink">{report?.title || 'Loading complaint'}</h2></div><button onClick={onClose} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-black">Close</button></header><div className="p-4 sm:p-5">{error && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}{!report ? <div className="h-96 animate-pulse rounded-xl bg-slate-100" /> : <div className="grid gap-5 lg:grid-cols-[1.3fr_.7fr]"><div className="space-y-5"><section className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap gap-2"><Badge type="priority" value={report.priority} /><Badge value={report.status} /></div><p className="mt-4 text-sm leading-6 text-slate-700">{report.description}</p><dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><div><dt className="font-bold text-slate-500">Citizen</dt><dd className="text-ink">{report.createdBy?.name || 'Unknown'}</dd></div><div><dt className="font-bold text-slate-500">Location</dt><dd className="text-ink">{report.location?.address || report.location?.area || 'No location provided'}</dd></div><div><dt className="font-bold text-slate-500">Category</dt><dd className="text-ink">{title(report.category)}</dd></div><div><dt className="font-bold text-slate-500">Created</dt><dd className="text-ink">{formatDate(report.createdAt)}</dd></div></dl></section><section className="rounded-xl border border-slate-200 p-4"><h3 className="font-black text-ink">Status Timeline</h3><div className="mt-4 space-y-3">{(report.activity || []).map((item, index) => <div key={`${item.timestamp}-${index}`} className="grid grid-cols-[28px_1fr] gap-3"><span className="mt-1 h-3 w-3 rounded-full bg-civic-600 ring-4 ring-civic-100" /><div><p className="text-sm font-bold text-ink">{item.action}</p><p className="text-xs text-slate-500">{title(item.actorRole)} - {formatDate(item.timestamp)}</p>{item.note && <p className="mt-1 text-sm text-slate-600">{item.note}</p>}</div></div>)}</div></section><section className="rounded-xl border border-slate-200 p-4"><h3 className="font-black text-ink">Evidence</h3>{report.attachments?.length ? <div className="mt-4 grid gap-3 sm:grid-cols-2">{report.attachments.map((item) => <a key={item.filename} href={mediaUrl(item)} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border border-slate-200 bg-slate-50">{item.mediaType === 'image' ? <img src={mediaUrl(item)} alt={item.originalName} className="h-44 w-full object-cover" /> : <div className="grid h-44 place-items-center text-sm font-bold text-slate-600">Open video</div>}<p className="truncate p-2 text-xs font-semibold text-slate-600">{item.originalName}</p></a>)}</div> : <p className="mt-3 text-sm text-slate-500">No media attached.</p>}</section></div><aside className="space-y-4"><section className="rounded-xl border border-slate-200 p-4"><h3 className="font-black text-ink">Workflow Actions</h3>{isHead && <div className="mt-4 space-y-3"><label className="block text-xs font-bold text-slate-500">Priority<select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>{priorities.map((item) => <option key={item} value={item}>{title(item)}</option>)}</select></label><button disabled={busy} onClick={() => act(() => departmentApi.priority(id, form.priority))} className="w-full rounded-lg bg-ink px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Save Priority</button></div>}{canManage && <div className="mt-4 space-y-3"><label className="block text-xs font-bold text-slate-500">Officer<select value={form.officerId} onChange={(e) => setForm({ ...form, officerId: e.target.value })}><option value="">Unassigned</option>{officers.map((person) => <option key={person.id} value={person.id}>{person.name} ({person.workload})</option>)}</select></label><label className="block text-xs font-bold text-slate-500">Field Worker<select value={form.fieldWorkerId} onChange={(e) => setForm({ ...form, fieldWorkerId: e.target.value })}><option value="">Unassigned</option>{workers.map((person) => <option key={person.id} value={person.id}>{person.name} ({person.workload})</option>)}</select></label><button disabled={busy} onClick={() => act(() => departmentApi.assign(id, { officerId: form.officerId, fieldWorkerId: form.fieldWorkerId }))} className="w-full rounded-lg bg-civic-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Update Assignment</button></div>}<div className="mt-4 space-y-3"><label className="block text-xs font-bold text-slate-500">Status<select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{statuses.map((item) => <option key={item} value={item}>{title(item)}</option>)}</select></label><button disabled={busy} onClick={() => act(() => departmentApi.status(id, form.status))} className="w-full rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-ink disabled:opacity-50">Update Status</button></div></section><section className="rounded-xl border border-slate-200 p-4"><h3 className="font-black text-ink">Completion Report</h3>{report.completionReport?.summary && <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700"><p className="font-bold text-ink">{title(report.completionReport.verificationStatus)}</p><p className="mt-1">{report.completionReport.summary}</p></div>}<div className="mt-3 space-y-3"><textarea rows="3" value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} placeholder="Work summary" /><textarea rows="2" value={form.materials} onChange={(e) => setForm({ ...form, materials: e.target.value })} placeholder="Materials or actions" /><textarea rows="2" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Notes" /><button disabled={busy} onClick={() => act(() => departmentApi.complete(id, form))} className="w-full rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Submit Completion</button>{isHead && <div className="grid grid-cols-2 gap-2"><button disabled={busy} onClick={() => act(() => departmentApi.reviewCompletion(id, { verificationStatus: 'approved' }))} className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700">Approve</button><button disabled={busy} onClick={() => act(() => departmentApi.reviewCompletion(id, { verificationStatus: 'rejected' }))} className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700">Reject</button></div>}</div></section></aside></div>}</div></section></div>;
}

function FieldOperations() {
  const [staff, setStaff] = useState([]);
  const [error, setError] = useState('');
  useEffect(() => { departmentApi.staff().then(({ data }) => setStaff(data.staff)).catch((err) => setError(apiMessage(err))); }, []);
  return <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-black text-ink">Field Operations</h2>{error && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}<div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{staff.map((person) => <article key={person.id} className="rounded-xl border border-slate-200 p-4"><div className="flex items-center justify-between gap-3"><div><p className="font-bold text-ink">{person.name}</p><p className="text-sm text-slate-500">{title(person.role)}</p></div><Badge value={person.workload ? 'in_progress' : 'verified'} /></div><p className="mt-4 text-2xl font-black text-ink">{person.workload}</p><p className="text-xs font-semibold text-slate-500">Active workload</p></article>)}</div>{!staff.length && <div className="mt-4"><EmptyState title="No active staff found" message="Department officers and field workers will appear once assigned to this department." /></div>}</section>;
}

function Analytics() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { departmentApi.analytics().then(({ data }) => setData(data.analytics)).catch((err) => setError(apiMessage(err))); }, []);
  const groups = [['By Status', data?.byStatus], ['By Category', data?.byCategory], ['By Priority', data?.byPriority], ['Over Time', data?.overTime]];
  const max = Math.max(1, ...groups.flatMap(([, rows]) => (rows || []).map((row) => row.count)));
  if (error) return <ErrorState message={error} onRetry={() => window.location.reload()} />;
  return <div className="grid gap-4 lg:grid-cols-2">{groups.map(([heading, rows]) => <section key={heading} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-black text-ink">{heading}</h2><div className="mt-5 space-y-3">{rows?.length ? rows.map((row) => <div key={row._id}><div className="flex justify-between text-sm"><span className="font-bold text-slate-700">{title(row._id)}</span><span className="text-slate-500">{row.count}</span></div><div className="mt-1 h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-civic-600" style={{ width: `${(row.count / max) * 100}%` }} /></div></div>) : <div className="h-44 animate-pulse rounded-lg bg-slate-100" />}</div></section>)}</div>;
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
  const data = useMemo(() => ({ ...dashboardData, userName: user.name }), [dashboardData, user.name]);
  async function loadDashboard() {
    setLoading(true); setError('');
    try { const { data } = await departmentApi.dashboard(); setDashboardData(data); } catch (err) { setError(apiMessage(err)); } finally { setLoading(false); }
  }
  useEffect(() => { loadDashboard(); }, []);
  return <DepartmentShell active={active} setActive={setActive}><div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm font-bold text-civic-700">{isHead ? 'Department-wide command center' : 'Assigned operations workspace'}</p><h2 className="text-2xl font-black text-ink">{active === 'overview' ? 'Operations Overview' : title(active)}</h2></div><span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600">{new Date().toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}</span></div>{active === 'overview' && <Overview data={data} loading={loading} error={error} reload={loadDashboard} setActive={setActive} isHead={isHead} />}{active === 'complaints' && <Complaints isHead={isHead} canManage={canManage} />}{active === 'field' && <FieldOperations />}{active === 'analytics' && <Analytics />}{active === 'notifications' && <Notifications />}</DepartmentShell>;
}
