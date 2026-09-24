import { useMemo, useState } from 'react';
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
import { formatMinutes, formatNumber, formatRelative, labelize, severityTone, statusTone, trendLabel, trendTone } from '../../../utils/format.js';

const healthTone = { operational: 'success', degraded: 'medium', unavailable: 'critical', not_monitored: 'neutral' };
const healthLabel = { operational: 'Operational', degraded: 'Degraded', unavailable: 'Unavailable', not_monitored: 'Not monitored' };
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

  const governance = useAsync(() => adminApi.governance({ range }).then((response) => response.data), [range, refreshKey]);
  const health = useAsync(() => adminApi.systemHealth().then((response) => response.data), [refreshKey]);
  const operations = useAsync(() => adminApi.operationsAnalytics().then((response) => response.data), [refreshKey]);
  const throughput = useAsync(() => adminApi.dashboard({ range }).then((response) => response.data.dashboard), [range, refreshKey]);
  const safety = useAsync(() => emergencyApi.safetyIntelligence({ days: 30 }).then((response) => response.data), [refreshKey]);

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

  const primaryCards = [
    { label: 'Total citizens', value: kpis?.citizens, icon: 'users', tone: 'info', trend: data?.trends?.users, hint: 'registered citizen accounts' },
    { label: 'Active emergencies', value: kpis?.activeEmergencies, icon: 'siren', tone: 'critical', trend: data?.trends?.emergencies, hint: `${formatNumber(kpis?.restrictedEmergencies || 0)} restricted incidents` },
    { label: 'Open complaints', value: kpis?.openComplaints, icon: 'clipboardList', tone: 'high', trend: data?.trends?.complaints, hint: 'pending through under review' },
    { label: 'Active responders', value: kpis?.activeResponders, icon: 'route', tone: 'success', hint: `${formatNumber(kpis?.activeAssignments || 0)} live assignments` }
  ];

  const secondaryCards = [
    { label: 'Departments', value: kpis?.departments, icon: 'building2', hint: 'civic + emergency scopes' },
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
              {new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · {new Date().toLocaleTimeString()}
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

      {governance.loading && <SkeletonKpiGrid count={4} />}
      {!governance.loading && governance.error && <ErrorState message={governance.error} onRetry={governance.reload} />}
      {!governance.loading && !governance.error && (
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

      <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
        <Card>
          <CardHeader
            icon="server"
            title="System health"
            subtitle="Real probes only — services the server cannot verify are labelled “Not monitored”."
            action={<Button size="sm" icon="refresh" onClick={health.reload}>Re-check</Button>}
          />
          <CardBody className="space-y-3">
            {health.loading && <SkeletonList rows={4} />}
            {!health.loading && health.error && <ErrorState message={health.error} onRetry={health.reload} />}
            {!health.loading && !health.error && (health.data?.checks || []).map((check) => (
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
            {governance.loading && <SkeletonChart height={140} />}
            {!governance.loading && !governance.error && (
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
            {governance.loading && <SkeletonList rows={5} />}
            {!governance.loading && !data?.recentActivity?.length && (
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
            {throughput.loading && <SkeletonChart height={160} />}
            {!throughput.loading && throughput.error && <ErrorState message={throughput.error} onRetry={throughput.reload} />}
            {!throughput.loading && !throughput.error && (
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
            {safety.loading && <SkeletonChart height={150} />}
            {!safety.loading && safety.error && <ErrorState message={safety.error} onRetry={safety.reload} />}
            {!safety.loading && !safety.error && safety.data && (
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
            {operations.loading && <SkeletonList rows={4} />}
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
            {governance.loading && <SkeletonList rows={3} />}
            {!governance.loading && !(data?.alerts?.recent || []).length && (
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

