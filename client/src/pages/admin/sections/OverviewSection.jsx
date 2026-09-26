import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '../../../services/adminService.js';
import { emergencyApi } from '../../../services/emergencyService.js';
import useAsync from '../../../hooks/useAsync.js';
import { useAuth } from '../../../context/AuthContext.jsx';
import { useAdminRealtime } from '../../../context/AdminRealtimeContext.jsx';
import Icon from '../../../components/ui/Icon.jsx';
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, ErrorState, Progress, Segmented, StatCard, StatusDot } from '../../../components/ui/primitives.jsx';
import { SkeletonChart, SkeletonKpiGrid, SkeletonList } from '../../../components/ui/Skeleton.jsx';
import { DonutChart, HBarChart, LineChart, toChartRows } from '../../../components/ui/Charts.jsx';
import { cx, formatMinutes, formatNumber, formatRelative, labelize, severityTone, statusTone, trendLabel, trendTone } from '../../../utils/format.js';

const healthTone = { operational: 'success', healthy: 'success', degraded: 'medium', unavailable: 'critical', unhealthy: 'critical', not_monitored: 'neutral' };
const healthLabel = { operational: 'Operational', healthy: 'Healthy', degraded: 'Degraded', unavailable: 'Unavailable', unhealthy: 'Unhealthy', not_monitored: 'Not monitored' };
const scopeTone = { civic: 'info', emergency: 'critical', hybrid: 'high' };
const scopeOptions = ['civic', 'emergency', 'hybrid'];
const toTrendText = (trend) => (trend ? trendLabel(trend) : 'Trend unavailable');

const ranges = [
  { value: '24h', label: '24h' },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '3m', label: '3 months' }
];

export const quickActions = [
  { label: 'Manage users', icon: 'users', to: '/admin/users' },
  { label: 'Create department', icon: 'building2', to: '/admin/departments' },
  { label: 'Manage response team', icon: 'route', to: '/admin/response-teams' },
  { label: 'Emergency categories', icon: 'layers', to: '/admin/categories' },
  { label: 'Add facility', icon: 'hospital', to: '/admin/facilities' },
  { label: 'Create alert', icon: 'megaphone', to: '/admin/alerts' },
  { label: 'View audit logs', icon: 'scroll', to: '/admin/audit-logs' },
  { label: 'System settings', icon: 'settings', to: '/admin/settings' },
  { label: 'Security center', icon: 'shieldAlert', to: '/admin/security-center' }
];

const greeting = () => {
  const hour = new Date().getHours();
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
};

export default function OverviewSection() {
  const { user } = useAuth();
  const { live, refreshKey } = useAdminRealtime();
  const navigate = useNavigate();
  const [range, setRange] = useState('30d');
  const [departmentQuery, setDepartmentQuery] = useState('');
  const [departmentScope, setDepartmentScope] = useState('');
  const [departmentStatus, setDepartmentStatus] = useState('');
  const [departmentGrouping, setDepartmentGrouping] = useState('scope');
  const [departmentSort, setDepartmentSort] = useState('name');
  const [now, setNow] = useState(() => new Date());
  const safetyDays = { '24h': 1, '7d': 7, '30d': 30, '3m': 90 }[range] || 30;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  const governance = useAsync(() => adminApi.governance({ range }).then((response) => response.data), [range, refreshKey], { keepPreviousData: true });
  const health = useAsync(() => adminApi.systemHealth().then((response) => response.data), [refreshKey], { keepPreviousData: true });
  const operations = useAsync(() => adminApi.operationsAnalytics().then((response) => response.data), [refreshKey], { keepPreviousData: true });
  const throughput = useAsync(() => adminApi.dashboard({ range }).then((response) => response.data.dashboard), [range, refreshKey], { keepPreviousData: true });
  const safety = useAsync(() => emergencyApi.safetyIntelligence({ days: safetyDays }).then((response) => response.data), [safetyDays, refreshKey], { keepPreviousData: true });

  const data = governance.data;
  const kpis = data?.kpis;

  const severityRows = useMemo(() => (data?.emergency?.bySeverity || [])
    .map((row) => ({ key: row.key, label: labelize(row.key), count: row.count, tone: severityTone(row.key) }))
    .filter((row) => row.count > 0), [data]);

  // Time series for the analytics snapshot, straight from the real dashboard
  // trend aggregates (`emergencyTrend`, `complaintTrend`, `userGrowth`).
  const trendRows = useMemo(() => ({
    emergency: toChartRows(throughput.data?.emergencyTrend || [], (key) => key),
    complaints: toChartRows(throughput.data?.complaintTrend || [], (key) => key),
    users: toChartRows(throughput.data?.userGrowth || [], (key) => key)
  }), [throughput.data]);

  // Every department registered on the platform, filtered and sorted
  // client-side for the dashboard register. The API list is never truncated, so
  // all departments are always available to search, sort and group.
  const departmentSummary = data?.resources?.departments;
  const allDepartments = departmentSummary?.list || [];

  const departments = useMemo(() => {
    const needle = departmentQuery.trim().toLowerCase();
    const filtered = allDepartments.filter((department) => {
      if (departmentScope && department.scope !== departmentScope) return false;
      if (departmentStatus === 'active' && department.status !== 'active') return false;
      if (departmentStatus === 'inactive' && department.status === 'active') return false;
      if (departmentStatus === 'missing_head' && !(department.missingHead || department.missingEmergencyHead)) return false;
      if (departmentStatus === 'unroutable' && department.acceptsComplaints) return false;
      if (!needle) return true;
      return [department.name, department.type, department.description, department.head?.name, department.emergencyHead?.name, department.address]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(needle));
    });
    const collator = new Intl.Collator(undefined, { sensitivity: 'base' });
    return [...filtered].sort((a, b) => {
      if (departmentSort === 'complaints') return (b.complaints?.open || 0) - (a.complaints?.open || 0) || (b.complaints?.total || 0) - (a.complaints?.total || 0) || collator.compare(a.name, b.name);
      if (departmentSort === 'members') return (b.members || 0) - (a.members || 0) || collator.compare(a.name, b.name);
      if (departmentSort === 'status') return a.status.localeCompare(b.status) || collator.compare(a.name, b.name);
      return collator.compare(a.name, b.name);
    });
  }, [allDepartments, departmentQuery, departmentScope, departmentStatus, departmentSort]);

  // Grouped view — every filtered department is rendered under exactly one
  // heading, so grouping never hides a department from the register.
  const departmentGroups = useMemo(() => {
    if (departmentGrouping === 'none') return [{ key: 'all', label: null, items: departments }];
    const keyOf = departmentGrouping === 'status'
      ? (department) => department.status
      : (department) => department.scope;
    const labels = departmentGrouping === 'status'
      ? { active: 'Active', inactive: 'Inactive' }
      : { civic: 'Civic', emergency: 'Emergency', hybrid: 'Hybrid' };
    const order = departmentGrouping === 'status' ? ['active', 'inactive'] : ['emergency', 'hybrid', 'civic'];
    const buckets = new Map();
    for (const department of departments) {
      const key = keyOf(department) || 'civic';
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(department);
    }
    return [...buckets.entries()]
      .sort((a, b) => {
        const ai = order.indexOf(a[0]);
        const bi = order.indexOf(b[0]);
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      })
      .map(([key, items]) => ({ key, label: labels[key] || labelize(key), items }));
  }, [departments, departmentGrouping]);

  // Every department name the citizen report form offers, in name order.
  const citizenNames = useMemo(() => departmentSummary?.citizenDepartmentNames || [], [departmentSummary]);

  const departmentTotals = useMemo(() => departments.reduce((totals, department) => ({
    members: totals.members + (department.members || 0),
    open: totals.open + (department.complaints?.open || 0),
    complaints: totals.complaints + (department.complaints?.total || 0)
  }), { members: 0, open: 0, complaints: 0 }), [departments]);

  const primaryCards = [
    { label: 'Total citizens', value: kpis?.citizens, icon: 'users', tone: 'info', trend: data?.trends?.users, hint: 'registered citizen accounts' },
    { label: 'Active emergencies', value: kpis?.activeEmergencies, icon: 'siren', tone: 'critical', trend: data?.trends?.emergencies, hint: `${formatNumber(kpis?.restrictedEmergencies || 0)} restricted incidents` },
    { label: 'Open complaints', value: kpis?.openComplaints, icon: 'clipboardList', tone: 'high', trend: data?.trends?.complaints, hint: 'pending through under review' },
    { label: 'Active responders', value: kpis?.activeResponders, icon: 'route', tone: 'success', hint: `${formatNumber(kpis?.activeAssignments || 0)} live assignments` }
  ];

  const secondaryCards = [
    { label: 'Departments', value: kpis?.departments, icon: 'building2', hint: `${formatNumber(departmentSummary?.active || 0)} active · ${formatNumber(departmentSummary?.unassignedHeads || 0)} without a head` },
    { label: 'Response teams', value: kpis?.responseTeams, icon: 'layers', hint: `${formatNumber(operations.data?.totals?.teams || 0)} with workload data` },
    { label: 'Facilities', value: kpis?.facilities, icon: 'hospital', hint: 'active safety facilities' },
    { label: 'System alerts', value: kpis?.activeAlerts, icon: 'megaphone', hint: 'published and not expired' }
  ];

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 text-[13px] font-semibold text-fg-muted">
              {greeting()}, {String(user?.name || 'Super Admin').split(' ')[0]}
              <StatusDot tone={live ? 'success' : 'muted'} label={live ? 'Live updates on' : 'Reconnecting'} />
            </p>
            <h2 className="mt-1 text-xl font-bold text-fg sm:text-2xl">CivicSync Command Center</h2>
            <p className="mt-1 text-[13px] text-fg-muted">
              {now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · {now.toLocaleTimeString()}
              {data?.range ? ` · last ${data.range.days} day(s)` : ''}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Segmented ariaLabel="Reporting range" options={ranges} value={range} onChange={setRange} />
            <Button icon="refresh" onClick={() => { governance.reload(); health.reload(); operations.reload(); throughput.reload(); safety.reload(); }}>Refresh</Button>
            <Button variant="primary" icon="siren" onClick={() => navigate('/admin/emergencies')}>Emergency Command</Button>
          </div>
        </div>
      </Card>

      {governance.loading && !data && <SkeletonKpiGrid count={4} />}
      {!governance.loading && governance.error && <ErrorState message={governance.error} onRetry={governance.reload} />}
      {data && !governance.error && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {primaryCards.map((card) => (
              <StatCard
                key={card.label}
                label={card.label}
                value={formatNumber(card.value || 0)}
                icon={card.icon}
                tone={card.tone}
                hint={card.hint}
                trend={card.trend ? { text: trendLabel(card.trend), tone: trendTone(card.trend) } : null}
              />
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {secondaryCards.map((card) => (
              <StatCard key={card.label} label={card.label} value={formatNumber(card.value || 0)} icon={card.icon} tone="neutral" hint={card.hint} />
            ))}
          </div>
        </div>
      )}

      {/* Department register — every department that exists, straight from the
          governance payload, with heads, membership and complaint load. */}
      <Card>
        <CardHeader
          icon="building2"
          title="Departments"
          subtitle={`${formatNumber(departmentSummary?.total ?? 0)} registered · ${formatNumber(departmentSummary?.active || 0)} active · ${formatNumber(departmentSummary?.inactive || 0)} inactive · ${formatNumber(departmentSummary?.unassignedHeads || 0)} missing a required head`}
          action={
            <>
              <Button size="sm" icon="plus" onClick={() => navigate('/admin/departments?create=1')}>New department</Button>
              <Button size="sm" iconRight="arrowUpRight" onClick={() => navigate('/admin/departments')}>Manage</Button>
            </>
          }
        />

        {Boolean(departmentSummary?.unroutedComplaints) && (
          <div className="flex flex-wrap items-center gap-2 border-b border-line bg-amber-50/60 px-5 py-2.5 text-[12px] text-amber-900 dark:bg-amber-950/25 dark:text-amber-200">
            <Icon name="alertTriangle" size={15} className="shrink-0" />
            <span>
              {formatNumber(departmentSummary.unroutedComplaints)} complaint(s) point at a destination with no matching department
              {departmentSummary.unroutedOpenComplaints ? ` (${formatNumber(departmentSummary.unroutedOpenComplaints)} still open)` : ''}.
              Complaints are routed by exact name match, so only the {formatNumber(departmentSummary.complaintDestinations?.length || 0)} configured destinations can receive them.
            </span>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-3">
          <input
            value={departmentQuery}
            onChange={(event) => setDepartmentQuery(event.target.value)}
            placeholder="Search name, type, head or address…"
            aria-label="Search departments"
            className="w-60"
          />
          <select value={departmentScope} onChange={(event) => setDepartmentScope(event.target.value)} aria-label="Filter departments by scope">
            <option value="">All scopes</option>
            {scopeOptions.map((value) => <option key={value} value={value}>{labelize(value)}</option>)}
          </select>
          <select value={departmentStatus} onChange={(event) => setDepartmentStatus(event.target.value)} aria-label="Filter departments by status">
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="missing_head">Missing a head</option>
            <option value="unroutable">Not complaint-routable</option>
          </select>
          <select value={departmentSort} onChange={(event) => setDepartmentSort(event.target.value)} aria-label="Sort departments">
            <option value="name">Sort: Name</option>
            <option value="complaints">Sort: Open complaints</option>
            <option value="members">Sort: Members</option>
            <option value="status">Sort: Status</option>
          </select>
          <select value={departmentGrouping} onChange={(event) => setDepartmentGrouping(event.target.value)} aria-label="Group departments">
            <option value="scope">Group: Scope</option>
            <option value="status">Group: Status</option>
            <option value="none">Group: None</option>
          </select>
          {(departmentQuery || departmentScope || departmentStatus) && (
            <Button size="sm" icon="close" onClick={() => { setDepartmentQuery(''); setDepartmentScope(''); setDepartmentStatus(''); }}>Clear</Button>
          )}
          <span className="ml-auto text-[12px] text-fg-subtle">
            Showing {formatNumber(departments.length)} of {formatNumber(departmentSummary?.total ?? 0)} · {formatNumber(departmentTotals.members)} member(s) · {formatNumber(departmentTotals.open)} open complaint(s)
          </span>
        </div>
        <CardBody>
          {governance.loading && !data && <SkeletonList rows={4} />}
          {!governance.loading && data && !departments.length && (
            <EmptyState
              icon="building2"
              title={allDepartments.length ? 'No departments match' : 'No departments registered'}
              hint={allDepartments.length ? 'Clear the search or filters to see all departments.' : 'Departments created under People → Departments appear here with their heads and workload.'}
            />
          )}
          {Boolean(departments.length) && (
            <div className="space-y-5">
              {departmentGroups.map((group) => (
                <section key={group.key}>
                  {group.label && (
                    <div className="mb-2.5 flex items-center gap-2">
                      <h4 className="text-[12px] font-bold uppercase tracking-wide text-fg-subtle">{group.label}</h4>
                      <Badge tone="neutral">{group.items.length}</Badge>
                    </div>
                  )}
                  <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {group.items.map((department) => (
                      <li key={department.id} className="flex flex-col rounded-xl border p-3.5" style={{ borderColor: 'var(--line)' }}>
                        <div className="mt-1.5 flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-semibold text-fg" title={department.name}>{department.name}</p>
                            {department.type && <p className="mt-0.5 truncate text-[11px] text-fg-subtle">{department.type}</p>}
                          </div>
                          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
                            <Badge tone={scopeTone[department.scope] || 'neutral'}>{labelize(department.scope)}</Badge>
                            <Badge tone={statusTone(department.status)}>{labelize(department.status)}</Badge>
                          </div>
                        </div>

                        {department.description && (
                          <p className="mt-1.5 line-clamp-2 text-[12px] leading-relaxed text-fg-muted">{department.description}</p>
                        )}

                        <dl className="mt-2 space-y-1 text-[12px]">
                          {department.needsHead && (
                            <div className="flex items-start justify-between gap-2">
                              <dt className="shrink-0 text-fg-subtle">Head</dt>
                              <dd className={cx('min-w-0 truncate text-right font-medium', department.head ? 'text-fg' : 'text-amber-600 dark:text-amber-400')}>
                                {department.head?.name || 'Unassigned'}
                              </dd>
                            </div>
                          )}
                          {department.needsEmergencyHead && (
                            <div className="flex items-start justify-between gap-2">
                              <dt className="shrink-0 text-fg-subtle">Emergency head</dt>
                              <dd className={cx('min-w-0 truncate text-right font-medium', department.emergencyHead ? 'text-fg' : 'text-amber-600 dark:text-amber-400')}>
                                {department.emergencyHead?.name || 'Unassigned'}
                              </dd>
                            </div>
                          )}
                        </dl>

                        <div className="mt-2.5 grid grid-cols-3 gap-2">
                          <div className="rounded-lg border p-2" style={{ borderColor: 'var(--line)' }}>
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-fg-subtle">Members</p>
                            <p className="tabular mt-0.5 text-[15px] font-bold text-fg">{formatNumber(department.members || 0)}</p>
                          </div>
                          <div className="rounded-lg border p-2" style={{ borderColor: 'var(--line)' }}>
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-fg-subtle">Open</p>
                            <p className="tabular mt-0.5 text-[15px] font-bold text-fg">{formatNumber(department.complaints?.open || 0)}</p>
                          </div>
                          <div className="rounded-lg border p-2" style={{ borderColor: 'var(--line)' }}>
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-fg-subtle">Total</p>
                            <p className="tabular mt-0.5 text-[15px] font-bold text-fg">{formatNumber(department.complaints?.total || 0)}</p>
                          </div>
                        </div>

                        {!department.acceptsComplaints && (
                          <p className="mt-2 text-[11px] leading-relaxed text-amber-700 dark:text-amber-400">
                            Name is not a configured complaint destination, so citizens cannot file complaints to it.
                          </p>
                        )}

                        {Boolean(department.emergencyTypes?.length) && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {department.emergencyTypes.map((type) => <Badge key={type} tone="neutral" icon="siren">{labelize(type)}</Badge>)}
                          </div>
                        )}

                        <div className="mt-auto flex items-center justify-between gap-2 pt-2.5">
                          <span className="min-w-0 truncate text-[11px] text-fg-subtle" title={department.address || department.email || ''}>
                            {department.address || department.email || department.contactNumber || 'No contact details recorded'}
                          </span>
                          <Button size="sm" icon="eye" onClick={() => navigate(`/admin/departments?focus=${department.id}`)}>View</Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Every department name a citizen can actually pick in the report form,
          with the API-acceptance flag that decides whether filing succeeds. */}
      <Card>
        <CardHeader
          icon="clipboardList"
          title="Citizen-visible department names"
          subtitle={`Every name offered in the citizen report form, and whether the report API will accept it. ${formatNumber(citizenNames.length)} name(s) visible to citizens.`}
          action={<Button size="sm" iconRight="arrowUpRight" onClick={() => navigate('/admin/service-config')}>Complaint destinations</Button>}
        />
        <CardBody>
          {governance.loading && !data && <SkeletonList rows={3} />}
          {!governance.loading && data && !citizenNames.length && (
            <EmptyState icon="clipboardList" title="No department names available" hint="Register an active department or configure complaint destinations." />
          )}
          {Boolean(citizenNames.length) && (
            <>
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {citizenNames.map((entry) => (
                  <li
                    key={entry.name}
                    className={cx('flex items-center justify-between gap-2 rounded-lg border px-3 py-2', !entry.acceptedByReportApi && 'border-amber-300 bg-amber-50/60 dark:border-amber-800 dark:bg-amber-950/25')}
                    style={entry.acceptedByReportApi ? { borderColor: 'var(--line)' } : undefined}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold text-fg" title={entry.name}>{entry.name}</p>
                      <p className="text-[11px] text-fg-subtle">
                        {entry.isActiveDepartment ? 'Active department record' : 'No active department record'}
                      </p>
                    </div>
                    <Badge tone={entry.acceptedByReportApi ? 'success' : 'high'} icon={entry.acceptedByReportApi ? 'checkCircle' : 'alertTriangle'}>
                      {entry.acceptedByReportApi ? 'Can receive' : 'Rejected on submit'}
                    </Badge>
                  </li>
                ))}
              </ul>
              {Boolean(departmentSummary?.complaintDestinationGaps?.length) && (
                <p className="mt-3 text-[12px] leading-relaxed text-fg-subtle">
                  Configured destinations with no active department behind them:{' '}
                  <span className="font-semibold text-fg">{departmentSummary.complaintDestinationGaps.join(', ')}</span>.
                  These are offered to citizens but no department record owns them.
                </p>
              )}
            </>
          )}
        </CardBody>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
        <Card>
          <CardHeader
            icon="server"
            title="System health"
            subtitle="Real probes only — services the server cannot verify are labelled “Not monitored”."
            action={<Button size="sm" icon="refresh" onClick={health.reload}>Re-check</Button>}
          />
          <CardBody className="space-y-3">
            {health.loading && !health.data && <SkeletonList rows={4} />}
            {!health.loading && health.error && <ErrorState message={health.error} onRetry={health.reload} />}
            {!health.error && (health.data?.checks || []).map((check) => (
              <div key={check.key} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border p-3" style={{ borderColor: 'var(--line)' }}>
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-[13px] font-semibold text-fg">
                    <StatusDot tone={healthTone[check.status] || 'neutral'} />
                    {check.label}
                  </p>
                  <p className="mt-1 text-[12px] text-fg-muted">{check.detail}</p>
                  <p className="mt-1 text-[11px] text-fg-subtle">Source: {check.source}{check.latencyMs != null ? ` · ${check.latencyMs} ms` : ''}</p>
                </div>
                <Badge tone={healthTone[check.status] || 'neutral'}>{healthLabel[check.status] || check.status}</Badge>
              </div>
            ))}
            {!health.loading && !health.error && !health.data?.checks?.length && (
              <EmptyState icon="server" title="Health data unavailable" hint="The system health endpoint did not return any checks." />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            icon="siren"
            title="Live emergency summary"
            subtitle={data ? `Severity and category mix for all ${formatNumber(kpis?.totalEmergencies || 0)} recorded incidents.` : 'Loading incident mix…'}
            action={<Button size="sm" variant="primary" iconRight="arrowUpRight" onClick={() => navigate('/admin/command-center')}>Command center</Button>}
          />
          <CardBody className="space-y-5">
            {governance.loading && !data && <SkeletonChart height={140} />}
            {data && !governance.error && (
              <>
                <div className="grid gap-3 sm:grid-cols-3">
                  {['critical', 'high', 'medium'].map((severity) => (
                    <div key={severity} className="rounded-xl border p-3" style={{ borderColor: 'var(--line)' }}>
                      <Badge tone={severityTone(severity)}>{labelize(severity)}</Badge>
                      <p className="tabular mt-2 text-xl font-bold text-fg">{formatNumber(severityRows.find((row) => row.key === severity)?.count || 0)}</p>
                    </div>
                  ))}
                </div>
                {severityRows.length ? <DonutChart data={severityRows} centerLabel="incidents" /> : (
                  <EmptyState icon="siren" title="No incidents recorded yet" hint="Severity distribution appears as soon as emergencies exist in the database." />
                )}
                <div>
                  <p className="mb-2 text-[13px] font-semibold text-fg">Category distribution</p>
                  <HBarChart
                    data={(data?.emergency?.byCategory || []).slice(0, 8).map((row) => ({ key: row.key, label: labelize(row.key), count: row.count }))}
                    valueLabel="Incidents"
                    emptyText="No category data recorded yet."
                  />
                </div>
              </>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            icon="activity"
            title="System activity"
            subtitle="Latest administrative events from the audit trail."
            action={<Button size="sm" iconRight="arrowUpRight" onClick={() => navigate('/admin/activity-logs')}>All activity</Button>}
          />
          <CardBody>
            {governance.loading && !data && <SkeletonList rows={5} />}
            {!governance.loading && data && !data.recentActivity?.length && (
              <EmptyState icon="activity" title="No administrative activity yet" hint="Actions such as role changes, department updates or settings edits will appear here." />
            )}
            <ol className="space-y-3">
              {(data?.recentActivity || []).map((entry) => (
                <li key={entry._id} className="flex gap-3">
                  <span className="mt-1 grid h-6 w-6 shrink-0 place-items-center rounded-full" style={{ backgroundColor: 'var(--surface-2)', color: 'var(--fg-subtle)' }}>
                    <Icon name="dot" size={14} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-fg">{labelize(entry.action)}</p>
                    <p className="text-[12px] text-fg-muted">{entry.description || entry.targetName || entry.targetType}</p>
                    <p className="mt-0.5 text-[11px] text-fg-subtle">
                      {entry.admin?.name || 'Administrator'} · {labelize(entry.actorRole || 'role not recorded')} · {formatRelative(entry.createdAt)}
                    </p>
                  </div>
                  <span className="ml-auto shrink-0">
                    <Badge tone={statusTone(entry.result) === 'success' ? 'success' : entry.result === 'failure' ? 'critical' : 'neutral'}>{labelize(entry.result || 'info')}</Badge>
                  </span>
                </li>
              ))}
            </ol>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            icon="chartLine"
            title="Analytics snapshot"
            subtitle={`Real period-over-period counts for the last ${data?.range?.days || 30} day(s).`}
            action={<Button size="sm" iconRight="arrowUpRight" onClick={() => navigate('/admin/analytics')}>Open analytics</Button>}
          />
          <CardBody className="space-y-5">
            {throughput.loading && !throughput.data && <SkeletonChart height={160} />}
            {!throughput.loading && throughput.error && <ErrorState message={throughput.error} onRetry={throughput.reload} />}
            {throughput.data && !throughput.error && (
              <>
                {[
                  ['Emergencies', trendRows.emergency, 'info', toTrendText(data?.trends?.emergencies)],
                  ['Complaints', trendRows.complaints, 'high', toTrendText(data?.trends?.complaints)],
                  ['New users', trendRows.users, 'success', toTrendText(data?.trends?.users)]
                ].map(([title, rows, tone, note]) => (
                  <div key={title}>
                    <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[13px] font-semibold text-fg">{title}</p>
                      <p className="text-[11px] text-fg-subtle">{note}</p>
                    </div>
                    <LineChart data={rows} height={130} valueLabel={title} tone={tone} />
                  </div>
                ))}
              </>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Safety intelligence snapshot — real aggregated citizen reports only. */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader
            icon="gauge"
            title="Safety intelligence"
            subtitle={`Aggregated citizen reports over the last ${safety.data?.dateRangeDays || 30} days.`}
            action={<Button size="sm" iconRight="arrowUpRight" onClick={() => navigate('/admin/safety-intelligence')}>Explore</Button>}
          />
          <CardBody className="space-y-4">
            {safety.loading && !safety.data && <SkeletonChart height={150} />}
            {!safety.loading && safety.error && <ErrorState message={safety.error} onRetry={safety.reload} />}
            {safety.data && !safety.error && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    ['Reported incidents', formatNumber(safety.data.total)],
                    ['Restricted (withheld)', formatNumber(safety.data.restrictedCount)],
                    ['Avg response', formatMinutes(safety.data.averageResponseMinutes)],
                    ['Avg resolution', formatMinutes(safety.data.averageResolutionMinutes)]
                  ].map(([caption, value]) => (
                    <div key={caption} className="rounded-xl border p-3" style={{ borderColor: 'var(--line)' }}>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">{caption}</p>
                      <p className="tabular mt-1 text-lg font-bold text-fg">{value}</p>
                    </div>
                  ))}
                </div>
                <HBarChart data={toChartRows(safety.data.byCategory || []).slice(0, 6)} valueLabel="Reports" emptyText="No reports in this period." />
                <p className="text-[11px] leading-relaxed text-fg-subtle">{safety.data.note}</p>
              </>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            icon="route"
            title="Response teams"
            subtitle="Live workload and utilisation from the operations feed."
            action={<Button size="sm" iconRight="arrowUpRight" onClick={() => navigate('/admin/response-teams')}>Manage</Button>}
          />
          <CardBody className="space-y-3">
            {operations.loading && !operations.data && <SkeletonList rows={4} />}
            {!operations.loading && operations.error && <ErrorState message={operations.error} onRetry={operations.reload} />}
            {!operations.loading && !operations.error && !(operations.data?.teams || []).length && (
              <EmptyState icon="route" title="No response teams yet" hint="Response teams registered under People → Response Teams appear here with live workload." />
            )}
            {(operations.data?.teams || []).slice(0, 5).map((team) => (
              <div key={team.id} className="rounded-xl border p-3" style={{ borderColor: 'var(--line)' }}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="min-w-0 truncate text-[13px] font-semibold text-fg">{team.name}</p>
                  <Badge tone={statusTone(team.availability)}>{labelize(team.availability || 'unknown')}</Badge>
                </div>
                <p className="mt-1 text-[11px] text-fg-subtle">
                  {labelize(team.type)} · {team.memberCount} member{team.memberCount === 1 ? '' : 's'} · {team.activeAssignments} active assignment{team.activeAssignments === 1 ? '' : 's'}
                </p>
                <Progress
                  className="mt-2"
                  label="Utilisation"
                  value={team.utilizationPercent ?? 0}
                  tone={(team.utilizationPercent ?? 0) >= 80 ? 'high' : 'info'}
                />
              </div>
            ))}
          </CardBody>
        </Card>
        <Card>
          <CardHeader
            icon="megaphone"
            title="Recent alerts"
            subtitle={`${formatNumber(data?.alerts?.active || 0)} active public safety broadcast(s).`}
            action={<Button size="sm" iconRight="arrowUpRight" onClick={() => navigate('/admin/alerts')}>Broadcast</Button>}
          />
          <CardBody>
            {governance.loading && !data && <SkeletonList rows={3} />}
            {!governance.loading && data && !(data.alerts?.recent || []).length && (
              <EmptyState icon="megaphone" title="No alerts published" hint="Broadcasts created under Operations → Alerts & Broadcast appear here." />
            )}
            <ul className="space-y-3">
              {(data?.alerts?.recent || []).map((alert) => (
                <li key={alert._id} className="rounded-xl border p-3" style={{ borderColor: 'var(--line)' }}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 text-[13px] font-semibold text-fg">{alert.title}</p>
                    <Badge tone={severityTone(alert.severity)}>{labelize(alert.severity)}</Badge>
                  </div>
                  <p className="mt-1 line-clamp-2 text-[12px] text-fg-muted">{alert.message}</p>
                  <p className="mt-1 text-[11px] text-fg-subtle">
                    {labelize(alert.category || 'public_safety')}{alert.location?.address ? ` · ${alert.location.address}` : ''} · {formatRelative(alert.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>

      {/* Quick actions grid */}
      <Card>
        <CardHeader icon="command" title="Quick actions" subtitle="Frequent administration workflows, one click away." />
        <CardBody>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {quickActions.map((action) => (
              <button
                key={action.label}
                type="button"
                onClick={() => navigate(action.to)}
                className="civic-card interactive flex items-center gap-3 p-3.5 text-left hover:-translate-y-0.5"
              >
                <span
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-lg"
                  style={{ backgroundColor: 'color-mix(in oklab, var(--color-civic-500) 14%, var(--surface))', color: 'var(--color-civic-600)' }}
                >
                  <Icon name={action.icon} size={17} />
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-fg">{action.label}</span>
                <Icon name="arrowUpRight" size={15} className="text-fg-subtle" />
              </button>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

