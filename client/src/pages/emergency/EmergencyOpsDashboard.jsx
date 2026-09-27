import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, Clock3, MapPin, RefreshCw, ShieldAlert, Users, X } from 'lucide-react';
import Emergency from '../../components/emergency/EmergencyMap.jsx';
import EvidenceUploader from '../../components/emergency/EvidenceUploader.jsx';
import EmergencyLayout from '../../components/emergency/EmergencyLayout.jsx';
import { useToast } from '../../components/ui/Toaster.jsx';
import useEmergencyEvents from '../../hooks/useEmergencyEvents.js';
import { apiMessage } from '../../services/api.js';
import { emergencyApi, emergencyOpsApi, label } from '../../services/emergencyService.js';

const roleViews = {
  head: { title: 'Emergency command center', endpoint: 'head', role: 'emergency_department_head' },
  edo: { title: 'Department coordination', endpoint: 'department-officer', role: 'emergency_department_officer' },
  officer: { title: 'Emergency response operations', endpoint: 'officer', role: 'emergency_officer' },
  field: { title: 'My field assignment', endpoint: 'field-worker', role: 'emergency_field_worker' }
};
const priorityStyles = {
  CRITICAL: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200',
  HIGH: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200',
  MEDIUM: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
  LOW: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
};
const types = ['MEDICAL', 'FIRE', 'SECURITY', 'ACCIDENT', 'NATURAL_DISASTER', 'OTHER'];
const responseTypes = ['MEDICAL_RESPONSE', 'FIRE_RESPONSE', 'SECURITY_RESPONSE', 'RESCUE_RESPONSE', 'MULTI_AGENCY_RESPONSE'];
const formatDate = (value) => value ? new Date(value).toLocaleString() : '—';
const durationLabel = (emergency) => {
  const started = new Date(emergency?.timestamps?.responseStartedAt || emergency?.createdAt).getTime();
  if (!Number.isFinite(started)) return '—';
  const ended = new Date(emergency?.timestamps?.workCompletedAt || Date.now()).getTime();
  const minutes = Math.max(0, Math.floor((ended - started) / 60000));
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
};
const statDefinitions = {
  head: [['total', 'Total emergencies'], ['active', 'Active'], ['critical', 'Critical'], ['high', 'High'], ['medium', 'Medium'], ['low', 'Low'], ['escalated', 'Escalated'], ['inProgress', 'In progress'], ['blocked', 'Blocked'], ['completed', 'Completed']],
  edo: [['myEmergencies', 'My emergencies'], ['pendingReview', 'Pending review'], ['waitingForEmergencyOfficer', 'Waiting for officer'], ['active', 'Active'], ['critical', 'Critical'], ['highPriority', 'High'], ['escalated', 'Escalated'], ['blocked', 'Blocked'], ['completed', 'Completed']],
  officer: [['myEmergencies', 'My emergencies'], ['pendingAcceptance', 'Pending acceptance'], ['activeResponses', 'Active responses'], ['critical', 'Critical'], ['highPriority', 'High'], ['blocked', 'Blocked'], ['escalated', 'Escalated'], ['completed', 'Completed']]
};

function Badge({ children, tone = 'neutral' }) {
  const tones = { neutral: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200', danger: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200', good: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200' };
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${tones[tone] || priorityStyles[tone] || tones.neutral}`}>{children}</span>;
}

function Panel({ title, icon: Icon = Activity, children, action }) {
  return <section className="civic-card min-w-0 p-4 sm:p-5">
    <div className="mb-4 flex items-center justify-between gap-3"><h2 className="flex items-center gap-2 font-bold text-fg"><Icon size={18} className="text-civic-600" />{title}</h2>{action}</div>
    {children}
  </section>;
}

function LoadingDashboard() {
  return <div className="space-y-5" aria-label="Loading emergency dashboard" aria-busy="true">
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{Array.from({ length: 10 }, (_, index) => <div key={index} className="h-24 animate-pulse rounded-xl border border-line bg-surface" />)}</div>
    <div className="h-64 animate-pulse rounded-xl border border-line bg-surface" />
  </div>;
}

function EmergencyRows({ items, role, onOpen, onAction }) {
  if (!items.length) return <div className="rounded-xl border border-dashed border-line-strong px-5 py-12 text-center text-sm text-fg-muted">No emergencies found.</div>;
  return <div className="space-y-3 lg:hidden">{items.map((item) => <article key={item._id} className="rounded-xl border border-line bg-surface p-4">
    <div className="flex flex-wrap items-center gap-2"><span className="font-black text-civic-700 dark:text-civic-300">{item.reference}</span><Badge tone={item.priority}>{label(item.priority)}</Badge><Badge>{label(item.workflowStatus)}</Badge></div>
    <p className="mt-2 font-bold text-fg">{label(item.emergencyType)}</p><p className="mt-1 flex items-center gap-1 text-sm text-fg-muted"><MapPin size={14} />{item.location?.address || 'Location not shared'}</p>
    <p className="mt-1 text-xs text-fg-subtle">Updated {formatDate(item.updatedAt)}</p>
    <div className="mt-3 flex gap-2"><button className="btn btn-secondary min-h-11 flex-1" onClick={() => onOpen(item._id)}>Details</button>{role !== 'field' && <button className="btn btn-primary min-h-11 flex-1" onClick={() => onAction(item._id)}>Actions</button>}</div>
  </article>)}</div>;
}

export default function EmergencyOpsDashboard({ view }) {
  const config = roleViews[view];
  const toast = useToast();
  const [dashboard, setDashboard] = useState(null);
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [filters, setFilters] = useState({ search: '', status: '', priority: '', emergencyType: '', dateFrom: '', dateTo: '', sort: 'newest' });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [staff, setStaff] = useState([]);
  const [rosters, setRosters] = useState([]);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [form, setForm] = useState({ notes: '', emergencyType: '', priority: '', staffId: '', teamId: '', title: '', responseType: 'MEDICAL_RESPONSE', percentage: '25', blockerType: 'OTHER', severity: 'MEDIUM', requiredResource: '', description: '' });

  const load = useCallback(async ({ quiet = false } = {}) => {
    if (quiet) setRefreshing(true); else setLoading(true);
    try {
      const [summary, list] = await Promise.all([
        emergencyOpsApi.dashboard(config.endpoint),
        emergencyOpsApi.list({ ...filters, page, limit: 12 })
      ]);
      setDashboard(summary.data);
      setItems(list.data.items || []);
      setTotal(list.data.total || 0);
      setTotalPages(list.data.totalPages || 1);
      setError('');
    } catch (err) {
      setError(apiMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [config.endpoint, filters, page]);

  const refreshKey = useEmergencyEvents(() => { load({ quiet: true }); });
  useEffect(() => { load(); }, [load, refreshKey.refreshKey]);
  useEffect(() => {
    const timeout = window.setTimeout(() => { setPage(1); setFilters((current) => ({ ...current, search: searchInput.trim() })); }, 300);
    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  const open = useCallback(async (id) => {
    try {
      const result = await emergencyOpsApi.get(id);
      setSelected(result.data.emergency);
      setActionError('');
      setForm({ notes: '', emergencyType: result.data.emergency.emergencyType, priority: result.data.emergency.priority, staffId: '', teamId: '', title: '', responseType: result.data.emergency.responseTypes?.[0] || 'MEDICAL_RESPONSE', percentage: '25', blockerType: 'OTHER', severity: 'MEDIUM', requiredResource: '', description: '' });
    } catch (err) { toast.error(apiMessage(err)); }
  }, [toast]);

  const loadStaff = useCallback(async (role) => {
    try {
      const { data } = await emergencyOpsApi.staff(role);
      setStaff(data.staff || []);
    } catch (err) { setActionError(apiMessage(err)); }
  }, []);

  const act = async (callback, successText) => {
    setBusy(true); setActionError('');
    try {
      await callback();
      toast.success(successText);
      if (selected?._id) await open(selected._id);
      await load({ quiet: true });
    } catch (err) {
      const message = apiMessage(err);
      setActionError(message);
      toast.error(message);
    } finally { setBusy(false); }
  };

  const detailTeams = selected?.teams || [];
  const mapItems = useMemo(() => (dashboard?.liveMap || []).map((item) => ({
    ...item,
    emergencyId: item.emergencyId || item.reference,
    severity: String(item.priority || '').toLowerCase(),
    status: item.workflowStatus,
    category: String(item.emergencyType || '').toLowerCase()
  })), [dashboard?.liveMap]);
  const heading = config.title;

  if (loading && !dashboard) return <EmergencyLayout title={heading}><LoadingDashboard /></EmergencyLayout>;
  if (error && !dashboard) return <EmergencyLayout title={heading}><div className="mx-auto max-w-4xl rounded-xl border border-red-200 bg-red-50 p-6 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100" role="alert"><h2 className="font-bold">Dashboard could not be loaded</h2><p className="mt-1 text-sm">{error}</p><button className="btn btn-secondary mt-4 min-h-11" onClick={() => load()}>Retry</button></div></EmergencyLayout>;

  const options = selected ? <>
    {view === 'head' && <>
      <form className="grid gap-3 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); act(() => emergencyOpsApi.classify(selected._id, { emergencyType: form.emergencyType, priority: form.priority, notes: form.notes }), 'Classification saved.'); }}>
        <label className="text-xs font-semibold text-fg-muted">Emergency type<select value={form.emergencyType} onChange={(event) => setForm({ ...form, emergencyType: event.target.value })}>{types.map((type) => <option key={type}>{type}</option>)}</select></label>
        <label className="text-xs font-semibold text-fg-muted">Priority<select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}>{['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((priority) => <option key={priority}>{priority}</option>)}</select></label>
        <button disabled={busy} className="btn btn-secondary min-h-11 sm:col-span-2">Save classification</button>
      </form>
      <div className="mt-3"><p className="mb-2 text-sm font-semibold text-fg">Assign Department Officer</p><div className="flex flex-col gap-2 sm:flex-row"><select value={form.staffId} onFocus={() => loadStaff('emergency_department_officer')} onChange={(event) => setForm({ ...form, staffId: event.target.value })}><option value="">Select an Emergency Department Officer</option>{staff.map((person) => <option key={person._id} value={person._id}>{person.name} · {label(person.availability)} · {person.currentIncident ? 'Busy' : 'No active incident'}</option>)}</select><button disabled={!form.staffId || busy} className="btn btn-primary min-h-11" onClick={() => act(() => emergencyOpsApi.assignEDO(selected._id, form.staffId), 'Emergency Department Officer assigned.')}>Assign</button></div></div>
      <div className="mt-3 flex flex-wrap gap-2"><button className="btn btn-secondary min-h-11" disabled={busy} onClick={() => act(() => emergencyOpsApi.review(selected._id, form.notes), 'Emergency reviewed.')}>Review case</button><button className="btn btn-secondary min-h-11" disabled={busy} onClick={() => act(() => emergencyOpsApi.directive(selected._id, window.prompt('Update request or directive') || ''), 'Update request sent.')}>Request update</button>{selected.workflowStatus === 'RESOLVED_PENDING_CONFIRMATION' && <button className="btn btn-danger min-h-11" disabled={busy} onClick={() => { if (window.confirm('Close this emergency after review?')) act(() => emergencyOpsApi.close(selected._id, window.prompt('Closure notes') || ''), 'Emergency closed.'); }}>Review and close</button>}{!['CLOSED_BY_EMERGENCY_HEAD', 'CANCELLED_WITH_REASON', 'MARKED_FALSE_REPORT'].includes(selected.workflowStatus) && <button className="btn btn-danger min-h-11" disabled={busy} onClick={() => { if (window.confirm('Cancel this emergency and release assigned resources?')) act(() => emergencyOpsApi.cancel(selected._id, window.prompt('Cancellation reason') || ''), 'Emergency cancelled.'); }}>Cancel emergency</button>}</div>
    </>}
    {view === 'edo' && <>
      <div className="flex flex-col gap-2 sm:flex-row"><select value={form.staffId} onFocus={() => loadStaff('emergency_officer')} onChange={(event) => setForm({ ...form, staffId: event.target.value })}><option value="">Select an Emergency Officer</option>{staff.map((person) => <option key={person._id} value={person._id}>{person.name} · {label(person.availability)} · workload {person.activeEmergencies ?? 0}</option>)}</select><button className="btn btn-primary min-h-11" disabled={!form.staffId || busy} onClick={() => act(() => emergencyOpsApi.assignEO(selected._id, form.staffId), 'Emergency Officer assigned.')}>Assign officer</button></div>
      <div className="mt-3 flex flex-wrap gap-2"><button className="btn btn-secondary min-h-11" disabled={busy} onClick={() => act(() => emergencyOpsApi.reviewEDO(selected._id, form.notes), 'Emergency reviewed.')}>Review emergency</button>{selected.workflowStatus === 'FIELD_WORK_COMPLETED' && <button className="btn btn-primary min-h-11" disabled={busy} onClick={() => act(() => emergencyOpsApi.reviewCompletion(selected._id, form.notes), 'Response reviewed.')}>Approve response review</button>}<button className="btn btn-secondary min-h-11" onClick={() => act(() => emergencyOpsApi.directive(selected._id, window.prompt('Update request') || ''), 'Update request sent.')}>Request update</button><button className="btn btn-secondary min-h-11" onClick={() => act(() => emergencyOpsApi.escalate(selected._id, window.prompt('Reason for escalation') || ''), 'Escalation sent to Head.')}>Escalate to Head</button></div>
    </>}
    {view === 'officer' && <>
      <div className="flex flex-wrap gap-2">{selected.workflowStatus === 'ASSIGNED_TO_EMERGENCY_OFFICER' && <button className="btn btn-primary min-h-11" disabled={busy} onClick={() => act(() => emergencyOpsApi.accept(selected._id), 'Emergency accepted.')}>Accept emergency</button>}
        <button className="btn btn-secondary min-h-11" disabled={busy} onClick={() => act(() => emergencyOpsApi.startResponse(selected._id), 'Response started.')}>Start response</button>
        <button className="btn btn-secondary min-h-11" disabled={busy} onClick={() => act(() => emergencyOpsApi.completeResponse(selected._id, form.notes), 'Response completion submitted for EDO review.')}>Complete response</button>
        <button className="btn btn-secondary min-h-11" onClick={() => act(() => emergencyOpsApi.escalate(selected._id, window.prompt('Reason for escalation') || ''), 'Emergency escalated.')}>Escalate</button>
      </div>
      <div className="mt-4 rounded-xl border border-line p-3"><h3 className="font-semibold text-fg">Create response team</h3><div className="mt-2 grid gap-2 sm:grid-cols-3"><input aria-label="Team name" placeholder="Team name" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })}/><select aria-label="Team type" value={form.responseType} onChange={(event) => setForm({ ...form, responseType: event.target.value })}>{responseTypes.map((type) => <option key={type}>{type}</option>)}</select><button className="btn btn-primary min-h-11" disabled={busy} onClick={() => act(() => emergencyOpsApi.createTeam(selected._id, { title: form.title, responseType: form.responseType }), 'Response team created.')}>Create team</button></div>
        <div className="mt-3 flex gap-2"><select value={form.teamId} onFocus={async () => { const { data } = await emergencyOpsApi.rosters(); setRosters(data.rosters || []); }} onChange={(event) => setForm({ ...form, teamId: event.target.value })}><option value="">Select your roster team</option>{rosters.map((team) => <option key={team._id} value={team._id}>{team.title} · {team.members?.length || 0} roster members</option>)}</select><button className="btn btn-secondary min-h-11" disabled={!form.teamId || busy} onClick={() => act(() => emergencyOpsApi.attachRoster(selected._id, form.teamId), 'Roster team deployed.')}>Deploy roster</button></div>
      </div>
      {detailTeams.filter((team) => team.kind !== 'ROSTER').map((team) => <div key={team._id} className="mt-3 rounded-xl border border-line p-3"><p className="font-semibold text-fg">{team.title} · {label(team.responseType)}</p><p className="mt-1 text-xs text-fg-muted">{team.members?.filter((member) => member.status !== 'RELEASED').map((member) => member.name).join(', ') || 'No field workers assigned'}</p><div className="mt-2 flex gap-2"><select aria-label={`Select worker for ${team.title}`} value={form.staffId} onFocus={() => loadStaff('emergency_field_worker')} onChange={(event) => setForm({ ...form, staffId: event.target.value })}><option value="">Select available field worker</option>{staff.filter((person) => person.availability === 'available').map((person) => <option key={person._id} value={person._id}>{person.name} · {label(person.availability)}</option>)}</select><button className="btn btn-secondary min-h-11" disabled={!form.staffId || busy} onClick={() => act(() => emergencyOpsApi.addWorker(selected._id, team._id, form.staffId), 'Field worker assigned.')}>Assign worker</button></div></div>)}
      <form className="mt-4 flex flex-col gap-2 sm:flex-row" onSubmit={(event) => { event.preventDefault(); act(() => emergencyOpsApi.progress(selected._id, Number(form.percentage), form.notes), 'Progress updated.'); }}><select aria-label="Progress" value={form.percentage} onChange={(event) => setForm({ ...form, percentage: event.target.value })}>{[25, 50, 75, 100].map((value) => <option key={value} value={value}>{value}%</option>)}</select><input aria-label="Progress note" placeholder="Progress note" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })}/><button className="btn btn-secondary min-h-11">Update progress</button></form>
      <form className="mt-3 grid gap-2 sm:grid-cols-3" onSubmit={(event) => { event.preventDefault(); act(() => emergencyOpsApi.blocker(selected._id, { kind: form.blockerType, severity: form.severity, requiredResource: form.requiredResource, description: form.description }), 'Blocker reported.'); }}><select value={form.blockerType} onChange={(event) => setForm({ ...form, blockerType: event.target.value })}><option>OTHER</option><option>RESOURCE</option><option>ACCESS</option><option>SAFETY</option><option>COMMUNICATION</option></select><select value={form.severity} onChange={(event) => setForm({ ...form, severity: event.target.value })}>{['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((value) => <option key={value}>{value}</option>)}</select><input placeholder="Required resource (optional)" value={form.requiredResource} onChange={(event) => setForm({ ...form, requiredResource: event.target.value })}/><input className="sm:col-span-2" placeholder="Describe blocker" required value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })}/><button className="btn btn-secondary min-h-11">Report blocker</button></form>
    </>}
    {view === 'field' && selected.activeTeam && <>
      {!selected.activeTeam.acceptedAt && selected.activeTeam.memberStatus === 'ACTIVE' && <button className="btn btn-primary min-h-11" disabled={busy} onClick={() => act(() => emergencyOpsApi.acceptFieldWork(selected._id), 'Assignment accepted.')}>Accept assignment</button>}
      {selected.activeTeam.acceptedAt && !selected.activeTeam.fieldWorkStartedAt && selected.activeTeam.memberStatus === 'ACTIVE' && <button className="btn btn-primary min-h-11" disabled={busy} onClick={() => act(() => emergencyOpsApi.startFieldWork(selected._id), 'Field work started.')}>Start field work</button>}
      {selected.activeTeam.fieldWorkStartedAt && selected.activeTeam.memberStatus === 'ACTIVE' && <>
        <div className="flex flex-wrap gap-2"><button className="btn btn-secondary min-h-11" onClick={() => act(() => emergencyOpsApi.escalate(selected._id, window.prompt('Describe the issue') || ''), 'Issue escalated to your officer.')}>Report escalation</button></div>
        <form className="mt-4 flex flex-col gap-2 sm:flex-row" onSubmit={(event) => { event.preventDefault(); act(() => emergencyOpsApi.progress(selected._id, Number(form.percentage), form.notes), 'Field progress updated.'); }}><select aria-label="Field progress" value={form.percentage} onChange={(event) => setForm({ ...form, percentage: event.target.value })}>{[25, 50, 75, 100].map((value) => <option key={value} value={value}>{value}%</option>)}</select><input aria-label="Progress note" placeholder="Progress note" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })}/><button className="btn btn-secondary min-h-11">Update progress</button></form>
        <form className="mt-3 grid gap-2 sm:grid-cols-3" onSubmit={(event) => { event.preventDefault(); act(() => emergencyOpsApi.blocker(selected._id, { kind: form.blockerType, severity: form.severity, requiredResource: form.requiredResource, description: form.description }), 'Problem reported to your officer.'); }}><select value={form.blockerType} onChange={(event) => setForm({ ...form, blockerType: event.target.value })}><option>OTHER</option><option>RESOURCE</option><option>ACCESS</option><option>SAFETY</option><option>COMMUNICATION</option></select><select value={form.severity} onChange={(event) => setForm({ ...form, severity: event.target.value })}>{['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((value) => <option key={value}>{value}</option>)}</select><input placeholder="Required resource (optional)" value={form.requiredResource} onChange={(event) => setForm({ ...form, requiredResource: event.target.value })}/><input className="sm:col-span-2" placeholder="Describe problem" required value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })}/><button className="btn btn-secondary min-h-11">Report problem</button></form>
        <button className="btn btn-primary mt-3 min-h-11" disabled={busy} onClick={() => act(() => emergencyOpsApi.completeFieldWork(selected._id, form.notes), 'Field work marked complete.')}>Complete field work</button>
      </>}
      {selected.activeTeam.memberStatus === 'FIELD_WORK_COMPLETED' && <p className="rounded-lg bg-emerald-50 p-3 text-sm font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">Field work completed. This assignment is read-only.</p>}
    </>}
    {actionError && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-100" role="alert">{actionError}</p>}
  </> : null;

  const stats = statDefinitions[view]?.map(([key, title]) => ({ key, title, value: dashboard?.stats?.[key] ?? 0 })) || [];
  return <EmergencyLayout title={heading}>
    <div className={`mx-auto max-w-[1500px] space-y-5 ${view === 'field' ? 'pb-24' : ''}`}>
      {error && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100" role="alert"><span>{error}</span><button className="btn btn-secondary min-h-11" onClick={() => load()}>Retry</button></div>}
      {view === 'field' ? <FieldHome dashboard={dashboard} onOpen={open} /> : <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{stats.map(({ key, title, value }) => <article key={key} className="civic-card p-4"><p className="text-xs font-bold uppercase tracking-wide text-fg-muted">{title}</p><p className="mt-2 text-3xl font-black tabular text-fg">{value}</p></article>)}</div>}

      {view === 'head' && <HeadOverview dashboard={dashboard} />}
      {view === 'edo' && <EDOOverview dashboard={dashboard} />}
      {view === 'officer' && <OfficerOverview dashboard={dashboard} />}

      {view === 'head' && <Panel title="Live emergency map" icon={MapPin}>{mapItems.length ? <Emergency emergencies={mapItems} height="h-[360px]" showControls={false} autoFit cluster onSelect={(item) => open(item._id)} /> : <p className="py-8 text-center text-sm text-fg-muted">No located active emergencies.</p>}</Panel>}

      {view === 'head' && <div className="grid gap-5 xl:grid-cols-2"><IncidentPanel title="Critical emergency center" icon={ShieldAlert} rows={dashboard?.criticalIncidents || []} onOpen={open} /><EscalationPanel rows={dashboard?.escalatedIncidents || []} onOpen={open} /></div>}
      {view === 'head' && <Panel title="Recent emergency activity"><Timeline rows={dashboard?.recentActivity || []} /></Panel>}

      {view === 'field' && dashboard?.activeEmergency && <FieldAssignment emergency={dashboard.activeEmergency} team={dashboard.activeTeam} onOpen={open} />}
      {view === 'field' && !dashboard?.activeEmergency && <div className="civic-card py-12 text-center"><CheckCircle2 className="mx-auto text-emerald-600" size={36}/><h2 className="mt-3 text-lg font-bold text-fg">No active emergency assignment</h2><p className="mt-1 text-sm text-fg-muted">New assignments will appear here.</p></div>}

      {view !== 'field' && <Panel title="Emergency management" icon={Users} action={<button className="btn btn-secondary min-h-11" onClick={() => load({ quiet: true })} disabled={refreshing}><RefreshCw size={16} className={refreshing ? 'animate-spin' : ''}/>Refresh</button>}>
        <div className="mb-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          <input aria-label="Search emergencies" placeholder="Search ID, type, location…" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} />
          <select aria-label="Filter status" value={filters.status} onChange={(event) => { setPage(1); setFilters({ ...filters, status: event.target.value }); }}><option value="">All statuses</option>{['SUBMITTED', 'EMERGENCY_HEAD_REVIEW', 'ASSIGNED_TO_EMERGENCY_DEPARTMENT_OFFICER', 'EMERGENCY_DEPARTMENT_OFFICER_REVIEW', 'ASSIGNED_TO_EMERGENCY_OFFICER', 'ACCEPTED_BY_EMERGENCY_OFFICER', 'RESOURCE_TEAM_FORMED', 'EN_ROUTE_TO_SCENE', 'ON_SCENE', 'ACTIVE_RESPONSE_IN_PROGRESS', 'ESCALATED_WITHIN_HIERARCHY', 'FIELD_WORK_COMPLETED', 'RESOLVED_PENDING_CONFIRMATION', 'CLOSED_BY_EMERGENCY_HEAD'].map((status) => <option key={status} value={status}>{label(status)}</option>)}</select>
          <select aria-label="Filter priority" value={filters.priority} onChange={(event) => { setPage(1); setFilters({ ...filters, priority: event.target.value }); }}><option value="">All priorities</option>{['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((priority) => <option key={priority}>{priority}</option>)}</select>
          <select aria-label="Filter emergency type" value={filters.emergencyType} onChange={(event) => { setPage(1); setFilters({ ...filters, emergencyType: event.target.value }); }}><option value="">All types</option>{types.map((type) => <option key={type}>{type}</option>)}</select>
          {view === 'head' && <><label className="text-xs font-semibold text-fg-muted">From<input aria-label="Filter from date" type="date" value={filters.dateFrom} onChange={(event) => { setPage(1); setFilters({ ...filters, dateFrom: event.target.value }); }}/></label><label className="text-xs font-semibold text-fg-muted">To<input aria-label="Filter to date" type="date" value={filters.dateTo} onChange={(event) => { setPage(1); setFilters({ ...filters, dateTo: event.target.value }); }}/></label></>}
          <select aria-label="Sort emergencies" value={filters.sort} onChange={(event) => setFilters({ ...filters, sort: event.target.value })}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="priority">Priority</option></select>
        </div>
        <div className="hidden overflow-x-auto lg:block"><table className="w-full min-w-[1000px] text-left text-sm"><thead className="border-b border-line text-xs uppercase text-fg-muted"><tr>{['Emergency ID', 'Type', 'Priority', 'Location', 'Status', view === 'head' ? 'Assigned EDO' : 'Emergency Officer', 'Teams', 'Created', 'Last updated', 'Actions'].map((header) => <th className="px-3 py-3" key={header}>{header}</th>)}</tr></thead><tbody className="divide-y divide-line">{items.map((item) => <tr key={item._id} className="hover:bg-surface-2"><td className="px-3 py-3 font-bold text-civic-700 dark:text-civic-300">{item.reference}</td><td className="px-3 py-3">{label(item.emergencyType)}</td><td className="px-3 py-3"><Badge tone={item.priority}>{label(item.priority)}</Badge></td><td className="max-w-48 truncate px-3 py-3">{item.location?.address || '—'}</td><td className="px-3 py-3"><Badge>{label(item.workflowStatus)}</Badge></td><td className="px-3 py-3">{view === 'head' ? item.departmentOfficer?.name || 'Unassigned' : item.emergencyOfficer?.name || 'Unassigned'}</td><td className="px-3 py-3">{item.teams?.length || 0}</td><td className="px-3 py-3">{formatDate(item.createdAt)}</td><td className="px-3 py-3">{formatDate(item.updatedAt)}</td><td className="px-3 py-3"><button className="btn btn-secondary btn-sm min-h-10" onClick={() => open(item._id)}>Open</button></td></tr>)}</tbody></table></div>
        <EmergencyRows items={items} role={view} onOpen={open} onAction={open} />
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-fg-muted"><span>{total} emergency record(s) · page {page} of {totalPages}</span><div className="flex gap-2"><button className="btn btn-secondary min-h-11" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</button><button className="btn btn-secondary min-h-11" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)}>Next</button></div></div>
      </Panel>}
    </div>

    {selected && <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/50" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}><section role="dialog" aria-modal="true" aria-labelledby="emergency-detail-title" className="h-full w-full max-w-2xl overflow-y-auto bg-app p-4 shadow-2xl sm:p-6">
      <div className="sticky top-0 z-10 -mx-4 -mt-4 mb-4 flex items-center justify-between border-b border-line bg-surface p-4 sm:-mx-6 sm:-mt-6 sm:px-6"><div><p className="text-xs font-bold uppercase tracking-wider text-civic-600">{selected.reference}</p><h2 id="emergency-detail-title" className="text-lg font-black text-fg">Emergency details</h2></div><button className="btn btn-secondary btn-icon min-h-11 min-w-11" aria-label="Close details" onClick={() => setSelected(null)}><X size={18}/></button></div>
      <div className="space-y-5"><div className="civic-card p-4"><div className="flex flex-wrap gap-2"><Badge tone={selected.priority}>{label(selected.priority)}</Badge><Badge>{label(selected.workflowStatus)}</Badge></div><h3 className="mt-3 text-xl font-black text-fg">{label(selected.emergencyType)}</h3><p className="mt-1 text-sm text-fg-muted">{selected.location?.address || 'Location not shared'}{selected.location?.landmark ? ` · ${selected.location.landmark}` : ''}</p><p className="mt-3 whitespace-pre-wrap text-sm text-fg">{selected.description || 'No additional description.'}</p><dl className="mt-3 grid grid-cols-2 gap-3 text-xs"><div><dt className="text-fg-subtle">Created</dt><dd className="mt-1 text-fg">{formatDate(selected.createdAt)}</dd></div><div><dt className="text-fg-subtle">Last update</dt><dd className="mt-1 text-fg">{formatDate(selected.updatedAt)}</dd></div><div><dt className="text-fg-subtle">EDO</dt><dd className="mt-1 text-fg">{selected.departmentOfficer?.name || 'Unassigned'}</dd></div><div><dt className="text-fg-subtle">Emergency Officer</dt><dd className="mt-1 text-fg">{selected.emergencyOfficer?.name || 'Unassigned'}</dd></div></dl></div>
        {selected.location?.latitude != null && selected.location?.longitude != null && <Panel title="Location map" icon={MapPin}><Emergency emergencies={[{ ...selected, severity: String(selected.priority || '').toLowerCase(), status: selected.workflowStatus, category: String(selected.emergencyType || '').toLowerCase() }]} height="h-64" showControls={false} autoFit cluster={false}/></Panel>}
        {options}
        <Panel title="Response teams" icon={Users}>{detailTeams.length ? <div className="space-y-3">{detailTeams.map((team) => <article key={team._id} className="rounded-lg border border-line p-3"><p className="font-bold text-fg">{team.title} <Badge>{label(team.kind)}</Badge></p><p className="mt-1 text-xs text-fg-muted">{label(team.responseType)} · {team.members?.length || 0} member(s)</p><ul className="mt-2 space-y-1 text-sm text-fg-muted">{team.members?.map((member) => <li key={member._id}>{member.name} · {label(member.status)}</li>)}</ul></article>)}</div> : <p className="text-sm text-fg-muted">No response teams assigned.</p>}</Panel>
        <Panel title="Response" icon={Clock3}><div className="grid grid-cols-2 gap-3 text-sm"><div><p className="text-xs text-fg-subtle">Response type</p><p className="mt-1 font-semibold text-fg">{selected.responseTypes?.map(label).join(', ') || detailTeams.map((team) => label(team.responseType)).join(', ') || 'Not assigned'}</p></div><div><p className="text-xs text-fg-subtle">Response started</p><p className="mt-1 font-semibold text-fg">{formatDate(selected.timestamps?.responseStartedAt)}</p></div><div><p className="text-xs text-fg-subtle">Current progress</p><p className="mt-1 font-semibold text-fg">{selected.completionPercent ?? 0}%</p></div><div><p className="text-xs text-fg-subtle">Response duration</p><p className="mt-1 font-semibold text-fg">{durationLabel(selected)}</p></div></div></Panel>
        <Panel title="Progress history" icon={Clock3}><Timeline rows={selected.progress || []} /></Panel>
        <Panel title="Open blockers" icon={AlertTriangle}>{selected.blockers?.filter((blocker) => !blocker.resolvedAt).length ? <Timeline rows={selected.blockers.filter((blocker) => !blocker.resolvedAt)} /> : <p className="text-sm text-fg-muted">No open blockers.</p>}</Panel>
        <Panel title="Evidence"><EvidenceUploader emergencyId={selected._id} evidence={selected.evidence || []} canUpload={view === 'field' && selected.activeTeam?.memberStatus === 'ACTIVE' && Boolean(selected.activeTeam?.fieldWorkStartedAt)} onChanged={() => open(selected._id)} /></Panel>
        <Panel title="Escalation history" icon={AlertTriangle}>{selected.escalations?.length ? <Timeline rows={selected.escalations} /> : <p className="text-sm text-fg-muted">No escalation records.</p>}</Panel>
        <Panel title="Audit timeline" icon={Activity}><Timeline rows={selected.auditTrail || []} /></Panel>
      </div>
    </section></div>}
  </EmergencyLayout>;
}

function FieldHome({ dashboard, onOpen }) {
  if (!dashboard?.activeEmergency) return null;
  const emergency = dashboard.activeEmergency;
  return <section className="rounded-2xl border border-red-200 bg-gradient-to-br from-red-50 to-white p-5 shadow-sm dark:border-red-950 dark:from-red-950/30 dark:to-surface sm:p-7"><div className="flex items-center gap-2 text-xs font-black uppercase tracking-[.15em] text-red-700 dark:text-red-300"><ShieldAlert size={16}/>Current emergency</div><p className="mt-3 text-2xl font-black text-fg">{label(emergency.emergencyType)}</p><div className="mt-2 flex flex-wrap gap-2"><Badge tone={emergency.priority}>{label(emergency.priority)}</Badge><Badge>{label(emergency.workflowStatus)}</Badge></div><p className="mt-4 flex items-center gap-2 text-sm font-semibold text-fg"><MapPin size={16}/>{emergency.location?.address || 'Location details unavailable'}</p><p className="mt-2 text-sm text-fg-muted">Officer: {dashboard.activeTeam?.officer?.name || 'Not assigned'} · Team: {dashboard.activeTeam?.title || dashboard.activeTeam?.teamCode || 'Response team'}</p><p className="mt-3 line-clamp-3 text-sm text-fg-muted">{emergency.instructions?.[0]?.text || emergency.description || 'Follow the directions provided by your Emergency Officer.'}</p><button className="btn btn-primary mt-5 min-h-12 w-full sm:w-auto" onClick={() => onOpen(emergency._id)}>Open assignment</button></section>;
}

function FieldAssignment({ emergency, team, onOpen }) {
  return <div className="grid gap-5 lg:grid-cols-2"><Panel title="Assignment details" icon={MapPin}><p className="text-lg font-bold text-fg">{team?.title || team?.teamCode || 'Response team'}</p><p className="mt-1 text-sm text-fg-muted">Assigned officer: {team?.officer?.name || '—'}</p><p className="mt-3 text-sm text-fg">{emergency.description}</p><button className="btn btn-secondary mt-4 min-h-11 w-full" onClick={() => onOpen(emergency._id)}>View instructions and details</button></Panel><Panel title="Location map" icon={MapPin}>{emergency.location?.latitude != null && emergency.location?.longitude != null ? <Emergency emergencies={[{ ...emergency, severity: String(emergency.priority || '').toLowerCase(), status: emergency.workflowStatus, category: String(emergency.emergencyType || '').toLowerCase() }]} height="h-64" showControls={false} autoFit cluster={false}/> : <p className="py-8 text-center text-sm text-fg-muted">No map location is available for this assignment.</p>}</Panel></div>;
}

function HeadOverview({ dashboard }) {
  const resources = dashboard?.resources || {};
  return <Panel title="Resource overview" icon={Users}><div className="grid gap-4 md:grid-cols-3">{[['Department officers', resources.departmentOfficers], ['Emergency officers', resources.emergencyOfficers], ['Field workers', resources.fieldWorkers]].map(([title, counts]) => <article key={title} className="rounded-xl border border-line p-4"><h3 className="font-bold text-fg">{title}</h3><div className="mt-3 grid grid-cols-2 gap-2 text-xs text-fg-muted">{['available', 'busy', 'off_duty', 'on_leave', 'unavailable'].map((status) => <p key={status} className="flex justify-between gap-1">{label(status)}<strong className="text-fg">{counts?.[status] ?? 0}</strong></p>)}</div></article>)}</div><div className="mt-4 flex flex-wrap gap-3"><Badge>{resources.activeTeams ?? 0} active teams</Badge><Badge>{resources.activeTasks ?? 0} active tasks</Badge></div></Panel>;
}

function EDOOverview({ dashboard }) {
  const officers = dashboard?.resourceMonitoring?.workload || [];
  return <Panel title="Emergency officer monitoring" icon={Users}>{officers.length ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{officers.map((officer) => <article key={officer._id} className="rounded-xl border border-line p-4"><div className="flex items-start justify-between gap-2"><p className="font-bold text-fg">{officer.name}</p><Badge tone={officer.availability === 'available' ? 'good' : 'neutral'}>{label(officer.availability)}</Badge></div><p className="mt-2 text-sm text-fg-muted">{officer.activeEmergencies} active emergency(s)</p><p className="mt-1 text-xs text-fg-subtle">Last update: {formatDate(officer.lastUpdate)}</p></article>)}</div> : <p className="text-sm text-fg-muted">No Emergency Officers found.</p>}</Panel>;
}

function OfficerOverview({ dashboard }) {
  const resources = dashboard?.resources || {};
  return <Panel title="Field resource availability" icon={Users}><div className="flex flex-wrap gap-3"><Badge tone="good">{resources.availableFieldWorkers ?? 0} available field workers</Badge><Badge>{resources.busyFieldWorkers ?? 0} busy field workers</Badge><Badge>{resources.activeTeams ?? 0} active teams</Badge></div></Panel>;
}

function IncidentPanel({ title, icon, rows, onOpen }) {
  return <Panel title={title} icon={icon}>{rows.length ? <div className="space-y-2">{rows.map((item) => <button key={item._id} className="w-full rounded-lg border border-line p-3 text-left hover:bg-surface-2" onClick={() => onOpen(item._id)}><span className="text-xs font-black text-civic-700 dark:text-civic-300">{item.reference}</span><p className="mt-1 font-bold text-fg">{label(item.emergencyType)} · {item.location?.address || 'Location unavailable'}</p><p className="mt-1 text-xs text-fg-muted">{label(item.workflowStatus)} · {formatDate(item.createdAt)}</p></button>)}</div> : <p className="text-sm text-fg-muted">No emergencies found.</p>}</Panel>;
}

function EscalationPanel({ rows, onOpen }) {
  return <Panel title="Escalation center" icon={AlertTriangle}>{rows.length ? <div className="space-y-2">{rows.map((item) => <button key={item._id} className="w-full rounded-lg border border-line p-3 text-left hover:bg-surface-2" onClick={() => onOpen(item._id)}><p className="font-bold text-fg">{item.reference} · Level {item.activeEscalation?.level || '—'}</p><p className="mt-1 text-sm text-fg-muted">{item.activeEscalation?.reason || 'Escalation requires review'}</p><p className="mt-1 text-xs text-fg-subtle">{formatDate(item.updatedAt)} · {item.emergencyOfficer?.name || item.departmentOfficer?.name || 'Unassigned'}</p></button>)}</div> : <p className="text-sm text-fg-muted">No escalations found.</p>}</Panel>;
}

function Timeline({ rows }) {
  if (!rows?.length) return <p className="text-sm text-fg-muted">No activity recorded.</p>;
  return <ol className="space-y-3">{rows.slice(0, 12).map((row, index) => <li key={row._id || `${row.action || row.text}-${index}`} className="flex gap-3 border-l-2 border-line pl-3"><span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-civic-500"/><div className="min-w-0"><p className="text-sm font-semibold text-fg">{row.percent != null ? `${row.percent}% · ` : ''}{row.description || row.text || row.reason || label(row.action || row.level || 'Update')}</p><p className="mt-1 text-xs text-fg-subtle">{row.actor?.name || row.by?.name || row.actorName || label(row.byRole || row.actorRole || '')} · {formatDate(row.createdAt || row.at || row.raisedAt || row.updatedAt)}</p></div></li>)}</ol>;
}
