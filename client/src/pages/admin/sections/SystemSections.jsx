import { useEffect, useState } from 'react';
import { adminApi } from '../../../services/adminService.js';
import useAsync from '../../../hooks/useAsync.js';
import { apiMessage } from '../../../services/api.js';
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, ErrorState, SectionHeading, StatCard, Toggle } from '../../../components/ui/primitives.jsx';
import { SkeletonKpiGrid, SkeletonList } from '../../../components/ui/Skeleton.jsx';
import { useToast } from '../../../components/ui/Toaster.jsx';
import { formatDateTime, formatNumber, labelize } from '../../../utils/format.js';

const healthTone = { operational: 'success', degraded: 'medium', unavailable: 'critical', not_monitored: 'neutral', unknown: 'neutral' };
const healthLabel = { operational: 'Operational', degraded: 'Degraded', unavailable: 'Unavailable', not_monitored: 'Not monitored', unknown: 'Unknown' };

export function SystemHealthSection() {
  const request = useAsync(() => adminApi.systemHealth().then((response) => response.data), []);
  const checks = request.data?.checks || [];
  const monitored = checks.filter((check) => check.status !== 'not_monitored' && check.status !== 'unknown');
  const unavailable = monitored.filter((check) => check.status === 'unavailable').length;
  const degraded = monitored.filter((check) => check.status === 'degraded').length;
  const notMonitored = checks.filter((check) => check.status === 'not_monitored' || check.status === 'unknown').length;
  if (request.loading) return <><SkeletonKpiGrid count={4} /><div className="mt-5"><SkeletonList rows={5} /></div></>;
  if (request.error) return <ErrorState message={request.error} onRetry={request.reload} />;
  return (
    <div className="space-y-5">
      <SectionHeading title="System health" subtitle="Only services with an actual runtime probe are marked operational. Unprobed services remain explicitly unmonitored." action={<Button icon="refresh" onClick={request.reload}>Re-check</Button>} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Monitored services" value={formatNumber(monitored.length)} icon="server" tone="info" hint="runtime probes" />
        <StatCard label="Operational" value={formatNumber(monitored.length - unavailable - degraded)} icon="checkCircle" tone="success" />
        <StatCard label="Needs attention" value={formatNumber(unavailable + degraded)} icon="alertTriangle" tone={unavailable || degraded ? 'high' : 'neutral'} />
        <StatCard label="Not monitored" value={formatNumber(notMonitored)} icon="info" tone="neutral" hint="no probe configured" />
      </div>
      <Card>
        <CardHeader icon="server" title="Infrastructure checks" subtitle="Source and detail are supplied by the protected system-health endpoint." />
        <CardBody className="space-y-3">
          {!checks.length ? <EmptyState icon="server" title="No health checks returned" hint="The server did not return a check list. No operational claim has been made." /> : checks.map((check) => (
            <div key={check.key} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border p-3" style={{ borderColor: 'var(--line)' }}>
              <div className="min-w-0"><p className="text-[13px] font-semibold text-fg">{check.label}</p><p className="mt-1 text-[12px] text-fg-muted">{check.detail || 'No detail supplied by the health probe.'}</p><p className="mt-1 text-[11px] text-fg-subtle">Source: {check.source || 'not supplied'}{check.latencyMs != null ? ` · ${check.latencyMs} ms` : ''}</p></div>
              <Badge tone={healthTone[check.status] || 'neutral'}>{healthLabel[check.status] || labelize(check.status || 'unknown')}</Badge>
            </div>
          ))}
        </CardBody>
      </Card>
    </div>
  );
}

export function SecurityCenterSection() {
  const request = useAsync(() => adminApi.logs({ page: 1, limit: 50 }).then((response) => response.data), []);
  const allRows = request.data?.logs || [];
  const securityPattern = /auth|login|role|permission|security|suspend|delete|settings|password/i;
  const rows = allRows.filter((row) => row.result === 'failure' || securityPattern.test(`${row.action} ${row.targetType} ${row.description || ''}`));
  if (request.loading) return <SkeletonList rows={8} />;
  if (request.error) return <ErrorState message={request.error} onRetry={request.reload} />;
  return (
    <div className="space-y-5">
      <SectionHeading title="Security center" subtitle="Security-relevant evidence available in the existing audit trail. This view does not invent failed-login or threat detections." />
      <Card><CardHeader icon="shieldCheck" title="Available evidence" subtitle="The current backend records administrative actions and results; it does not expose a separate authentication-event detector." /><CardBody><div className="grid gap-3 sm:grid-cols-3"><StatCard label="Security-relevant events" value={formatNumber(rows.length)} icon="activity" tone="info" hint="from the latest audit page" /><StatCard label="Failed audit results" value={formatNumber(allRows.filter((row) => row.result === 'failure').length)} icon="alertTriangle" tone="high" /><StatCard label="Auth telemetry" value="Not monitored" icon="lock" tone="neutral" hint="no backend event source" /></div></CardBody></Card>
      <Card><CardHeader icon="scroll" title="Security-relevant audit activity" subtitle="Only real ActivityLog records are shown." /><CardBody className="space-y-2">{!rows.length ? <EmptyState icon="shieldCheck" title="No security-relevant activity found" hint="The current audit dataset contains no matching events for this view." /> : rows.map((row) => <div key={row._id} className="rounded-xl border p-3.5" style={{ borderColor: row.result === 'failure' ? 'color-mix(in oklab, #ef4444 35%, var(--line))' : 'var(--line)' }}><div className="flex flex-wrap items-start justify-between gap-2"><p className="text-[13px] font-semibold text-fg">{labelize(row.action)}</p><Badge tone={row.result === 'failure' ? 'critical' : row.result === 'success' ? 'success' : 'neutral'}>{labelize(row.result || 'info')}</Badge></div><p className="mt-1 text-[12px] text-fg-muted">{row.description || 'No description recorded.'}</p><p className="mt-1 text-[11px] text-fg-subtle">{row.admin?.name || 'Administrator'} · {formatDateTime(row.createdAt)} · {labelize(row.actorRole || 'role not recorded')}</p></div>)}</CardBody></Card>
    </div>
  );
}

const featureCopy = {
  emergency: ['Emergency workflows', 'Governs the existing emergency intake and response surfaces.'],
  womenSafety: ['Women Safety', 'Controls the existing Women Safety surface and configuration.'],
  safetyHeatmap: ['Safety Heatmap', 'Controls the existing aggregated safety heatmap surface.'],
  aiClassification: ['AI advisory classification', 'Enables the existing transparent advisory classifier; it never dispatches automatically.'],
  emergencyBroadcast: ['Emergency broadcast', 'Enables the existing in-app public alert workflow. External SMS/push is not implied.'],
  analytics: ['Analytics', 'Enables the existing system analytics dataset.']
};

export function FeatureFlagsSection() {
  const toast = useToast();
  const request = useAsync(() => adminApi.settings().then((response) => response.data), []);
  const [form, setForm] = useState(null);
  const [baseline, setBaseline] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!request.data?.settings?.features) return;
    setForm(structuredClone(request.data.settings.features));
    setBaseline(structuredClone(request.data.settings.features));
  }, [request.data]);
  async function save() {
    setBusy(true); setError('');
    try {
      const { data } = await adminApi.updateSettings({ features: form });
      const next = data.settings?.features || form;
      setForm(structuredClone(next)); setBaseline(structuredClone(next));
      toast.success('Feature flags saved. The server remains authoritative for supported consumers.');
      request.reload();
    } catch (err) { setError(apiMessage(err)); } finally { setBusy(false); }
  }
  if (request.loading) return <SkeletonList rows={6} />;
  if (request.error) return <ErrorState message={request.error} onRetry={request.reload} />;
  if (!form) return <EmptyState icon="sliders" title="Feature flags unavailable" hint="The settings API did not return a valid feature configuration." />;
  const dirty = JSON.stringify(form) !== JSON.stringify(baseline);
  return (
    <div className="space-y-5">
      <SectionHeading title="Feature flags" subtitle="Backend-stored feature configuration. A flag is shown only when the existing server knows how to persist and consume it." action={<Button variant="primary" icon="check" loading={busy} disabled={!dirty} onClick={save}>Save flags</Button>} />
      {error ? <ErrorState message={error} /> : null}
      <Card><CardHeader icon="sliders" title="Supported flags" subtitle="Consumers apply flags server-side; the UI does not bypass backend authorization or lifecycle rules." /><CardBody className="grid gap-4 md:grid-cols-2">{Object.entries(form).map(([key, value]) => { const [title, hint] = featureCopy[key] || [labelize(key), 'Backend-configured feature flag.']; return <div key={key} className="rounded-xl border p-4" style={{ borderColor: 'var(--line)' }}><Toggle checked={Boolean(value)} onChange={(next) => setForm((current) => ({ ...current, [key]: next }))} label={title} hint={hint} /></div>; })}</CardBody></Card>
      <p className="text-[12px] leading-relaxed text-fg-subtle">Flags without a server consumer are not invented here. External SMS, push delivery, and maintenance-mode controls remain unavailable unless a real backend capability is added.</p>
    </div>
  );
}
