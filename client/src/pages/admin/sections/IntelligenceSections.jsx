import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { CircleMarker, MapContainer, Popup, TileLayer, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { adminApi } from '../../../services/adminService.js';
import { emergencyApi, facilitiesApi, facilityGroups, facilityTypeLabels } from '../../../services/emergencyService.js';
import EmergencyMap from '../../../components/emergency/EmergencyMap.jsx';
import { useAdminRealtime } from '../../../context/AdminRealtimeContext.jsx';
import useAsync from '../../../hooks/useAsync.js';
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, ErrorState, Progress, SectionHeading, Segmented, StatCard } from '../../../components/ui/primitives.jsx';
import { SkeletonKpiGrid, SkeletonMap } from '../../../components/ui/Skeleton.jsx';
import { ColumnChart, DonutChart, HBarChart, LineChart, toChartRows } from '../../../components/ui/Charts.jsx';
import { cx, formatMinutes, formatNumber, formatRelative, labelize, severityTone, statusTone } from '../../../utils/format.js';

const severityColor = { critical: '#dc2626', high: '#f97316', medium: '#f59e0b', low: '#64748b' };
const rangeOptions = [{ value: '24h', label: '24h' }, { value: '7d', label: '7 days' }, { value: '30d', label: '30 days' }, { value: '3m', label: '3 months' }];
const domainOptions = [
  { value: 'emergency', label: 'All incidents' },
  { value: 'women', label: 'Women safety' },
  { value: 'road', label: 'Road & traffic' },
  { value: 'security', label: 'Security & crime' }
];

/**
 * One component serves four analytics routes; `pathname` selects the dataset.
 * Only the active dataset is requested — the others never leave the browser.
 */
export function AnalyticsSection() {
  const { pathname } = useLocation();
  const [range, setRange] = useState('30d');
  const mode = pathname.includes('emergency-analytics') ? 'emergency'
    : pathname.includes('department-analytics') ? 'operations'
      : pathname.includes('safety-analytics') ? 'safety'
        : 'system';

  const system = useAsync(() => adminApi.analytics({ range }).then((response) => response.data.analytics), [range], { immediate: mode === 'system', keepPreviousData: true });
  const governance = useAsync(() => adminApi.governance({ range }).then((response) => response.data), [range], { immediate: mode === 'system', keepPreviousData: true });
  const emergency = useAsync(() => emergencyApi.analytics().then((response) => response.data.analytics), [], { immediate: mode === 'emergency' });
  const operations = useAsync(() => adminApi.operationsAnalytics().then((response) => response.data), [], { immediate: mode === 'operations' });
  const [safetyDomain, setSafetyDomain] = useState('emergency');
  const safety = useAsync(() => emergencyApi.safetyIntelligence({ domain: safetyDomain, days: 30 }).then((response) => response.data), [safetyDomain], { immediate: mode === 'safety' });

  const kpis = governance.data?.kpis;
  const analytics = system.data;
  const em = emergency.data;
  const ops = operations.data;
  const intel = safety.data;
  if (mode === 'system') {
    if (system.loading) return <SkeletonKpiGrid count={4} />;
    if (system.error) return <ErrorState message={system.error} onRetry={system.reload} />;
    return (
      <div className="space-y-6">
        <SectionHeading
          title="System analytics"
          subtitle="Platform growth, complaint throughput and department workload for the selected window."
          action={<Segmented ariaLabel="Reporting range" options={rangeOptions} value={range} onChange={setRange} />}
        />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Citizens" value={formatNumber(kpis?.citizens)} icon="users" tone="info" hint="registered accounts" />
          <StatCard label="Open complaints" value={formatNumber(kpis?.openComplaints)} icon="clipboardList" tone="high" hint="pending → under review" />
          <StatCard label="Active emergencies" value={formatNumber(kpis?.activeEmergencies)} icon="siren" tone="critical" hint="non-terminal incidents" />
          <StatCard label="Avg emergency response" value={formatMinutes(analytics?.averageEmergencyResponseMinutes)} icon="timer" tone="success" hint="only incidents with real timestamps" />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader icon="chartPie" title="Complaint status distribution" subtitle="Every complaint in the current window." />
            <CardBody>
              {toChartRows(analytics?.statusDistribution || []).length
                ? <DonutChart data={toChartRows(analytics?.statusDistribution || [])} centerLabel="complaints" />
                : <EmptyState icon="clipboardList" title="No complaints in this window" hint="Widen the reporting range to see data." />}
            </CardBody>
          </Card>
          <Card>
            <CardHeader icon="chartBar" title="Complaints by category" subtitle="Top categories citizens reported." />
            <CardBody>
              <HBarChart data={toChartRows(analytics?.byCategory || [])} valueLabel="Complaints" />
            </CardBody>
          </Card>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <LineChart data={toChartRows(analytics?.complaintTrend || [], (key) => key)} height={150} valueLabel="Complaints" />
          <LineChart data={toChartRows(analytics?.emergencyTrend || [], (key) => key)} height={150} valueLabel="Emergencies" />
          <LineChart data={toChartRows(analytics?.userGrowth || [], (key) => key)} height={150} valueLabel="New users" />
        </div>
        <Card>
          <CardHeader icon="building2" title="Department workload" subtitle="Complaints per department with resolution ratio, computed server-side." />
          <CardBody className="space-y-3">
            {!(analytics?.departmentPerformance || []).length && <EmptyState icon="building2" title="No department workload recorded" hint="Complaints appear here once they are routed to departments." />}
            {(analytics?.departmentPerformance || []).map((row) => {
              const rate = row.total ? Math.round((row.resolved / row.total) * 100) : 0;
              return (
                <div key={row.department || 'unassigned'} className="rounded-xl border p-3" style={{ borderColor: 'var(--line)' }}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[13px] font-semibold text-fg">{row.department || 'Unassigned'}</p>
                    <span className="tabular text-[12px] text-fg-muted">{formatNumber(row.resolved)} / {formatNumber(row.total)} resolved</span>
                  </div>
                  <Progress className="mt-2" label="Resolution" value={rate} tone={rate >= 70 ? 'success' : rate >= 40 ? 'medium' : 'high'} />
                </div>
              );
            })}
          </CardBody>
        </Card>
      </div>
    );
  }
  if (mode === 'emergency') {
    if (emergency.loading) return <SkeletonKpiGrid count={4} />;
    if (emergency.error) return <ErrorState message={emergency.error} onRetry={emergency.reload} />;
    return (
      <div className="space-y-6">
        <SectionHeading
          title="Emergency analytics"
          subtitle="Incident volume, severity mix, hourly pattern and real milestone timings from the emergency collection."
        />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total incidents" value={formatNumber(em?.total)} icon="siren" tone="info" hint="all recorded incidents" />
          <StatCard label="Active" value={formatNumber(em?.active)} icon="activity" tone="critical" hint="non-terminal statuses" />
          <StatCard label="Resolved" value={formatNumber(em?.resolved)} icon="checkCircle" tone="success" hint="awaiting closure" />
          <StatCard label="Closed" value={formatNumber(em?.closed)} icon="shieldCheck" tone="neutral" hint="terminal state" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard label="Avg dispatch" value={formatMinutes(em?.averageDispatchMinutes)} icon="send" tone="info" />
          <StatCard label="Avg acknowledge" value={formatMinutes(em?.averageAcknowledgeMinutes)} icon="bell" tone="info" />
          <StatCard label="Avg arrival" value={formatMinutes(em?.averageArrivalMinutes)} icon="mapPin" tone="medium" />
          <StatCard label="Avg response" value={formatMinutes(em?.averageResponseMinutes)} icon="timer" tone="high" />
          <StatCard label="Avg resolution" value={formatMinutes(em?.averageResolutionMinutes)} icon="checkCircle" tone="success" />
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader icon="chartPie" title="Severity mix" />
            <CardBody>
              {toChartRows(em?.bySeverity || []).length
                ? <DonutChart data={toChartRows(em?.bySeverity || []).map((row) => ({ ...row, tone: severityTone(row.key) }))} centerLabel="incidents" />
                : <EmptyState icon="siren" title="No incidents recorded" hint="Raise a test incident to populate this chart." />}
            </CardBody>
          </Card>
          <Card>
            <CardHeader icon="chartBar" title="Category volume" />
            <CardBody>
              <HBarChart data={toChartRows(em?.byCategory || [])} valueLabel="Incidents" />
            </CardBody>
          </Card>
          <Card>
            <CardHeader icon="gauge" title="Status breakdown" />
            <CardBody className="space-y-2">
              {toChartRows(em?.byStatus || []).map((row) => (
                <div key={row.key} className="flex items-center justify-between gap-3 rounded-lg border p-2.5" style={{ borderColor: 'var(--line)' }}>
                  <Badge tone={statusTone(row.key)}>{row.label}</Badge>
                  <span className="tabular text-[13px] font-semibold text-fg">{formatNumber(row.count)}</span>
                </div>
              ))}
            </CardBody>
          </Card>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader icon="chartLine" title="Daily incident trend" subtitle="Last 60 days with recorded incidents." />
            <CardBody>
              <LineChart data={toChartRows(em?.trend || [], (key) => key)} height={170} valueLabel="Incidents" />
            </CardBody>
          </Card>
          <Card>
            <CardHeader icon="clock" title="Hourly pattern" subtitle="Incidents by hour of day, all recorded history." />
            <CardBody>
              <ColumnChart data={(em?.hourly || []).map((row) => ({ key: String(row.hour), label: `${String(row.hour).padStart(2, '0')}:00`, count: row.count }))} height={170} valueLabel="Incidents" />
            </CardBody>
          </Card>
        </div>
        <p className="text-[12px] text-fg-subtle">Milestone averages ignore missing timestamps — a null dispatch time is never counted as zero.</p>
      </div>
    );
  }
  if (mode === 'operations') {
    if (operations.loading) return <SkeletonKpiGrid count={4} />;
    if (operations.error) return <ErrorState message={operations.error} onRetry={operations.reload} />;
    return (
      <div className="space-y-6">
        <SectionHeading
          title="Operations analytics"
          subtitle="Response-team utilisation, responder workload and department incident load from real assignment timestamps."
        />
        {ops?.available === false && (
          <EmptyState icon="info" title="Operations dataset unavailable" hint={Array.isArray(ops?.features) ? undefined : 'The server reported this dataset as unavailable.'} />
        )}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard label="Response teams" value={formatNumber(ops?.totals?.teams)} icon="route" tone="info" />
          <StatCard label="Active assignments" value={formatNumber(ops?.totals?.activeAssignments)} icon="activity" tone="critical" />
          <StatCard label="Tracked officers" value={formatNumber(ops?.totals?.trackedOfficers)} icon="userCheck" tone="success" />
          <StatCard label="Tracked field workers" value={formatNumber(ops?.totals?.trackedFieldWorkers)} icon="users" tone="medium" />
          <StatCard label="Unassigned work" value={formatNumber(ops?.totals?.unassignedAssignments)} icon="alertTriangle" tone="high" hint="active assignments with no officer" />
        </div>
        <Card>
          <CardHeader icon="route" title="Team utilisation" subtitle="Active assignments per member — computed only from assignments that exist." />
          <CardBody className="space-y-3">
            {!(ops?.teams || []).length && <EmptyState icon="route" title="No response teams" hint="Create teams under People → Response Teams." />}
            {(ops?.teams || []).map((team) => (
              <div key={team.id} className="rounded-xl border p-3" style={{ borderColor: 'var(--line)' }}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[13px] font-semibold text-fg">{team.name}</p>
                  <div className="flex gap-1.5">
                    <Badge tone={statusTone(team.availability)}>{labelize(team.availability)}</Badge>
                    {!team.active && <Badge tone="muted">Inactive</Badge>}
                  </div>
                </div>
                <p className="mt-1 text-[11px] text-fg-subtle">
                  {team.memberCount} member(s) · {team.activeAssignments} active · {team.completedAssignments} completed
                  {team.averageMinutes != null ? ` · avg ${formatMinutes(team.averageMinutes)}` : ' · no completed timings yet'}
                </p>
                <Progress className="mt-2" label="Utilisation" value={team.utilizationPercent ?? 0} tone={(team.utilizationPercent ?? 0) >= 80 ? 'high' : 'info'} />
              </div>
            ))}
          </CardBody>
        </Card>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader icon="userCheck" title="Officer workload" subtitle="Per-officer assignment totals and averages." />
            <CardBody className="space-y-2">
              {!(ops?.officers || []).length && <EmptyState icon="userCheck" title="No officer assignments recorded" hint="Assign an officer to an incident to populate this panel." />}
              {(ops?.officers || []).slice(0, 12).map((person) => (
                <div key={person.id} className="flex items-center justify-between gap-3 rounded-lg border p-2.5" style={{ borderColor: 'var(--line)' }}>
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-fg">{person.name}</p>
                    <p className="truncate text-[11px] text-fg-subtle">{formatNumber(person.total)} total · {formatNumber(person.active)} active{person.averageMinutes != null ? ` · avg ${formatMinutes(person.averageMinutes)}` : ''}</p>
                  </div>
                  <Badge tone={statusTone(person.status)}>{labelize(person.status)}</Badge>
                </div>
              ))}
            </CardBody>
          </Card>
          <Card>
            <CardHeader icon="building2" title="Department incident load" subtitle="Emergencies per emergency-capable department." />
            <CardBody className="space-y-2">
              {!(ops?.departments || []).length && <EmptyState icon="building2" title="No routed incidents yet" hint="Emergencies appear here once departments receive routing." />}
              {(ops?.departments || []).map((department) => (
                <div key={department.id} className="rounded-lg border p-2.5" style={{ borderColor: 'var(--line)' }}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[13px] font-semibold text-fg">{department.name}</p>
                    <span className="tabular text-[12px] text-fg-muted">{formatNumber(department.activeEmergencies)} active</span>
                  </div>
                  <p className="mt-1 text-[11px] text-fg-subtle">{formatNumber(department.totalEmergencies)} total · {formatNumber(department.resolvedEmergencies)} resolved · {formatNumber(department.staffCount)} staff</p>
                </div>
              ))}
            </CardBody>
          </Card>
        </div>
      </div>
    );
  }
  if (mode === 'safety') {
    if (safety.loading) return <SkeletonKpiGrid count={4} />;
    if (safety.error) return <ErrorState message={safety.error} onRetry={safety.reload} />;
    return (
      <div className="space-y-6">
        <SectionHeading
          title="Safety analytics"
          subtitle="Aggregated intelligence derived from citizen incident reports over the last 30 days."
          action={<Segmented ariaLabel="Safety domain" options={domainOptions} value={safetyDomain} onChange={setSafetyDomain} />}
        />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Reported incidents" value={formatNumber(intel?.total)} icon="shield" tone="info" hint="citizen reports in window" />
          <StatCard label="Restricted" value={formatNumber(intel?.restrictedCount)} icon="lock" tone="critical" hint="withheld from public views" />
          <StatCard label="Avg response" value={formatMinutes(intel?.averageResponseMinutes)} icon="timer" tone="medium" />
          <StatCard label="Avg resolution" value={formatMinutes(intel?.averageResolutionMinutes)} icon="checkCircle" tone="success" />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader icon="chartBar" title="Category breakdown" />
            <CardBody>
              <HBarChart data={toChartRows(intel?.byCategory || [])} valueLabel="Reports" />
            </CardBody>
          </Card>
          <Card>
            <CardHeader icon="chartLine" title="Daily report trend" />
            <CardBody>
              <LineChart data={toChartRows(intel?.trend || [], (key) => key)} height={180} valueLabel="Reports" />
            </CardBody>
          </Card>
        </div>
        <Card>
          <CardHeader icon="layers" title="Subcategories" subtitle="Most-reported subcategories in this domain." />
          <CardBody>
            <HBarChart data={toChartRows(intel?.bySubcategory || [])} valueLabel="Reports" emptyText="No subcategory data for this domain." />
          </CardBody>
        </Card>
        <p className="text-[12px] text-fg-subtle">{intel?.note}</p>
      </div>
    );
  }
  return <ErrorState title="Unknown analytics view" message={`No analytics dataset is mapped for ${pathname}.`} onRetry={undefined} />;
}
/* ---------------------------------------------------------- Emergency map */

export function EmergencyMapSection() {
  const { live, refreshKey } = useAdminRealtime();
  const [days, setDays] = useState('30');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [serviceType, setServiceType] = useState('');
  const from = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() - Number(days));
    return date.toISOString();
  }, [days]);
  const categories = useAsync(() => adminApi.categoryGovernance().then((response) => response.data.rows), []);
  const incidents = useAsync(
    () => emergencyApi.map({ from, ...(category ? { category } : {}), ...(status ? { status } : {}) }).then((response) => response.data.emergencies),
    [from, category, status, refreshKey],
    { keepPreviousData: true }
  );
  const responders = useAsync(() => emergencyApi.responderLocations().then((response) => response.data.positions), [refreshKey], { keepPreviousData: true });
  const facilities = useAsync(() => facilitiesApi.list({ limit: 500 }).then((response) => response.data.facilities), [refreshKey], { keepPreviousData: true });
  const hotspots = useAsync(
    () => emergencyApi.hotspots({ days: Number(days), minCount: 2, ...(category ? { category } : {}) }).then((response) => response.data),
    [days, category, refreshKey],
    { keepPreviousData: true }
  );

  const active = (incidents.data || []).filter((item) => item.location?.latitude != null && item.location?.longitude != null);
  const facilityRows = (facilities.data || []).filter((item) => item.active !== false && (!serviceType || item.type === serviceType));
  const responderRows = responders.data || [];
  const areas = (hotspots.data?.areas || []).map((area) => ({ ...area, _id: { latitude: area._id.latitude, longitude: area._id.longitude, category: area._id.category } }));
  const statuses = ['', 'all', 'reported', 'received', 'assessing', 'verified', 'dispatched', 'en_route', 'on_scene', 'responding', 'escalated', 'requires_backup', 'resolved', 'closed', 'cancelled', 'false_report'];

  if (incidents.loading) return <SkeletonMap height={460} />;
  if (incidents.error) return <ErrorState message={incidents.error} onRetry={incidents.reload} />;

  return (
    <div className="space-y-5">
      <SectionHeading
        title="Emergency map"
        subtitle={`${active.length} incident(s) with exact command coordinates · ${facilityRows.length} mapped service(s) · ${responderRows.length} live responder position(s).`}
        action={<Badge tone={live ? 'success' : 'medium'}>{live ? 'Live updates connected' : 'Reconnecting live updates'}</Badge>}
      />
      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <label className="text-xs font-semibold text-fg-muted">Date range<select value={days} onChange={(event) => setDays(event.target.value)}><option value="1">Last 24 hours</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option></select></label>
          <label className="text-xs font-semibold text-fg-muted">Incident status<select value={status} onChange={(event) => setStatus(event.target.value)}>{statuses.map((value) => <option key={value} value={value}>{value === '' ? 'Active incidents' : value === 'all' ? 'All statuses' : labelize(value)}</option>)}</select></label>
          <label className="text-xs font-semibold text-fg-muted">Incident category<select value={category} onChange={(event) => setCategory(event.target.value)}><option value="">All categories</option>{(categories.data || []).map((row) => <option key={row.key} value={row.key}>{row.label}</option>)}</select></label>
          <label className="text-xs font-semibold text-fg-muted">Service layer<select value={serviceType} onChange={(event) => setServiceType(event.target.value)}><option value="">All registered services</option>{facilityGroups.flatMap((group) => group.types).map((type) => <option key={type} value={type}>{facilityTypeLabels[type]}</option>)}</select></label>
          <div className="flex items-end"><Button onClick={() => { incidents.reload(); responders.reload(); facilities.reload(); hotspots.reload(); }}>Refresh map</Button></div>
        </div>
      </Card>
      <EmergencyMap
        height="h-[34rem] min-h-[30rem]"
        emergencies={active}
        hotspots={areas}
        facilities={facilityRows}
        responders={responderRows}
        showControls={false}
        autoFit
        emergencyDetailsHref={(item) => `/admin/emergencies?focus=${item._id}`}
      />
      <p className="text-[12px] text-fg-subtle">Exact incident coordinates are available only to authenticated Emergency Command through the protected map API. Restricted incidents remain excluded from every citizen-facing aggregate. Socket events refresh this operational view automatically.</p>
      {responders.error && <ErrorState message={`Responder positions: ${responders.error}`} onRetry={responders.reload} />}
      {facilities.error && <ErrorState message={`Facilities: ${facilities.error}`} onRetry={facilities.reload} />}
      {hotspots.error && <ErrorState message={`Hotspots: ${hotspots.error}`} onRetry={hotspots.reload} />}
      {!active.length && !facilityRows.length && !responderRows.length && <EmptyState icon="map" title="Nothing to plot yet" hint="Incidents with coordinates, registered services and responder pings will appear here." />}
    </div>
  );
}
/* --------------------------------------------------------- Safety heatmap */

export function SafetyHeatmapSection() {
  const [days, setDays] = useState('30');
  const [category, setCategory] = useState('');
  const [tileError, setTileError] = useState(false);
  const [tileAttempt, setTileAttempt] = useState(0);
  const categories = useAsync(() => adminApi.categoryGovernance().then((response) => response.data.rows), []);
  const hotspots = useAsync(
    () => emergencyApi.hotspots({ days: Number(days), ...(category ? { category } : {}) }).then((response) => response.data),
    [days, category]
  );

  const areas = (hotspots.data?.areas || []).map((row) => ({
    key: `${row._id.latitude}:${row._id.longitude}:${row._id.category || ''}`,
    latitude: row._id.latitude,
    longitude: row._id.longitude,
    category: row._id.category,
    count: row.count,
    latestAt: row.latestAt
  }));
  const maxCount = Math.max(1, ...areas.map((area) => area.count));
  const center = areas.length ? [areas[0].latitude, areas[0].longitude] : [23.8103, 90.4125];

  return (
    <div className="space-y-5">
      <SectionHeading
        title="Safety heatmap"
        subtitle="Reported incident density by period and category. Coordinates are rounded to 2 decimals — areas, never exact addresses."
        action={
          <div className="flex flex-wrap gap-2">
            <Segmented
              ariaLabel="Heatmap period"
              options={[{ value: '7', label: '7 days' }, { value: '30', label: '30 days' }, { value: '90', label: '90 days' }]}
              value={days}
              onChange={setDays}
            />
            <select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Filter by category">
              <option value="">All categories</option>
              {(categories.data || []).filter((row) => row.usage > 0).map((row) => <option key={row.key} value={row.key}>{row.label}</option>)}
            </select>
          </div>
        }
      />

      {hotspots.loading && <SkeletonMap height={420} />}
      {!hotspots.loading && hotspots.error && <ErrorState message={hotspots.error} onRetry={hotspots.reload} />}
      {!hotspots.loading && !hotspots.error && hotspots.data?.insufficientData && (
        <EmptyState icon="activity" title="Not enough reported data" hint={hotspots.data.message || 'No areas met the minimum report threshold for this period.'} />
      )}
      {!hotspots.loading && !hotspots.error && areas.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
          <Card className="overflow-hidden">
            {tileError ? <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900" role="alert"><span>Map tiles are currently unavailable.</span><button type="button" onClick={() => { setTileError(false); setTileAttempt((value) => value + 1); }} className="font-bold underline">Retry map</button></div> : null}
            <MapContainer center={center} zoom={12} style={{ height: 420, width: '100%' }} scrollWheelZoom>
              <TileLayer
                key={`admin-safety-map-${tileAttempt}`}
                attribution={(import.meta.env.VITE_MAP_TILE_PROVIDER || 'OpenStreetMap') === 'OpenStreetMap' ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' : `&copy; ${import.meta.env.VITE_MAP_TILE_PROVIDER}`}
                url={import.meta.env.VITE_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'}
                eventHandlers={{ tileerror: () => setTileError(true), load: () => setTileError(false) }}
              />
              {areas.map((area) => (
                <CircleMarker
                  key={area.key}
                  center={[area.latitude, area.longitude]}
                  radius={8 + Math.round((area.count / maxCount) * 18)}
                  pathOptions={{ color: '#f97316', fillColor: '#f97316', fillOpacity: 0.45, weight: 1 }}
                >
                  <Tooltip direction="top">
                    {area.count} report(s) · {labelize(area.category || 'mixed')}
                  </Tooltip>
                  <Popup>
                    <p className="text-[13px] font-semibold">{area.count} report(s) near {area.latitude.toFixed(2)}, {area.longitude.toFixed(2)}</p>
                    <p className="text-[12px]">{labelize(area.category || 'mixed categories')} · latest {formatRelative(area.latestAt)}</p>
                  </Popup>
                </CircleMarker>
              ))}
            </MapContainer>
          </Card>
          <Card>
            <CardHeader icon="filter" title="Densest areas" subtitle={`Top ${Math.min(areas.length, 10)} of ${areas.length} qualifying area(s).`} />
            <CardBody className="space-y-2">
              {areas.slice(0, 10).map((area) => (
                <div key={area.key} className="flex items-center justify-between gap-3 rounded-lg border p-2.5" style={{ borderColor: 'var(--line)' }}>
                  <div className="min-w-0">
                    <p className="tabular truncate text-[13px] font-medium text-fg">{area.latitude.toFixed(2)}, {area.longitude.toFixed(2)}</p>
                    <p className="truncate text-[11px] text-fg-subtle">{labelize(area.category || 'mixed')} · latest {formatRelative(area.latestAt)}</p>
                  </div>
                  <span className="tabular shrink-0 text-[13px] font-bold text-fg">{formatNumber(area.count)}</span>
                </div>
              ))}
            </CardBody>
          </Card>
        </div>
      )}
      <p className="text-[12px] text-fg-subtle">{hotspots.data?.note} Restricted incidents are excluded from public views and never plotted here for citizens.</p>
    </div>
  );
}
/* --------------------------------------------------- Safety intelligence */

export function SafetyIntelligenceSection() {
  const [domain, setDomain] = useState('emergency');
  const [days, setDays] = useState(30);
  const safety = useAsync(() => emergencyApi.safetyIntelligence({ domain, days }).then((response) => response.data), [domain, days]);

  if (safety.loading) return <SkeletonKpiGrid count={4} />;
  if (safety.error) return <ErrorState message={safety.error} onRetry={safety.reload} />;

  const intel = safety.data;
  const density = (intel?.densityAreas || []).slice(0, 20);

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Safety intelligence"
        subtitle="Aggregated, anonymised intelligence from real citizen reports — never a statement of objective risk."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Segmented ariaLabel="Safety domain" options={domainOptions} value={domain} onChange={setDomain} />
            <select value={days} onChange={(event) => setDays(Number(event.target.value))} aria-label="Lookback window">
              {[7, 14, 30, 90, 180].map((value) => <option key={value} value={value}>Last {value} days</option>)}
            </select>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Reported incidents" value={formatNumber(intel?.total)} icon="shield" tone="info" hint={`${intel?.dateRangeDays || days}-day window`} />
        <StatCard label="Restricted" value={formatNumber(intel?.restrictedCount)} icon="lock" tone="critical" hint="withheld from every public view" />
        <StatCard label="Avg response" value={formatMinutes(intel?.averageResponseMinutes)} icon="timer" tone="medium" hint="incidents with real response timestamps" />
        <StatCard label="Avg resolution" value={formatMinutes(intel?.averageResolutionMinutes)} icon="checkCircle" tone="success" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader icon="chartBar" title="Category distribution" subtitle="Within the selected domain only." />
          <CardBody>
            <HBarChart data={toChartRows(intel?.byCategory || [])} valueLabel="Reports" emptyText="No reports in this domain for the selected window." />
          </CardBody>
        </Card>
        <Card>
          <CardHeader icon="chartLine" title="Report trend" subtitle="Daily report volume across the window." />
          <CardBody>
            <LineChart data={toChartRows(intel?.trend || [], (key) => key)} height={190} valueLabel="Reports" />
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader icon="layers" title="Subcategory detail" subtitle="Most-reported subcategories, top 12." />
          <CardBody>
            <HBarChart data={toChartRows(intel?.bySubcategory || [])} valueLabel="Reports" emptyText="No subcategory data recorded." />
          </CardBody>
        </Card>
        <Card>
          <CardHeader icon="mapPin" title="Density areas" subtitle="Rounded coordinates with at least 2 reports — never exact addresses." />
          <CardBody className="space-y-2">
            {!density.length && <EmptyState icon="mapPin" title="No density areas yet" hint="Areas appear once at least two reports share the same rounded location." />}
            {density.map((area) => (
              <div key={`${area._id.latitude}:${area._id.longitude}`} className="flex items-center justify-between gap-3 rounded-lg border p-2.5" style={{ borderColor: 'var(--line)' }}>
                <span className="tabular truncate text-[13px] text-fg">{area._id.latitude.toFixed(2)}, {area._id.longitude.toFixed(2)}</span>
                <span className="tabular shrink-0 text-[13px] font-bold text-fg">{formatNumber(area.count)}</span>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>

      <p className="text-[12px] leading-relaxed text-fg-subtle">{intel?.label ? `${intel.label}. ` : ''}{intel?.note}</p>
    </div>
  );
}

