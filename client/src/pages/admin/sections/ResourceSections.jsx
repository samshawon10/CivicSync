import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { adminApi } from '../../../services/adminService.js';
import EmergencyMap from '../../../components/emergency/EmergencyMap.jsx';
import { emergencyApi, facilitiesApi, facilityTypes, responseTeamsApi } from '../../../services/emergencyService.js';
import useAsync from '../../../hooks/useAsync.js';
import { apiMessage } from '../../../services/api.js';
import DataTable from '../../../components/ui/DataTable.jsx';
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, ErrorState, Field, KeyValue, SectionHeading, StatCard, StatusDot, Toggle } from '../../../components/ui/primitives.jsx';
import { SkeletonKpiGrid, SkeletonList } from '../../../components/ui/Skeleton.jsx';
import { ConfirmDialog, Modal } from '../../../components/ui/Overlays.jsx';
import { useToast } from '../../../components/ui/Toaster.jsx';
import { availabilityTone, cx, formatDate, formatMinutes, formatNumber, formatRelative, labelize, statusTone } from '../../../utils/format.js';

const teamTypes = ['medical', 'fire', 'security', 'traffic', 'disaster', 'rescue', 'infrastructure', 'other'];
const emergencyTypes = ['police', 'fire', 'medical', 'accident', 'disaster', 'other'];
const blankFacility = { name: '', type: 'hospital', description: '', address: '', latitude: '', longitude: '', phone: '', emergencyPhone: '', email: '', openingHours: '', emergencyServiceAvailable: true, status: 'operational', available: true, active: true };
const blankCategory = { key: '', label: '', description: '', icon: 'siren', priority: 'medium', color: '#2563eb', subcategories: '', responseTargetMinutes: 30, responseWarningMinutes: 20, responseCriticalMinutes: 30, responseTimeActive: true, active: true };

/* ------------------------------------------------------------- Facilities */

export function FacilitiesSection() {
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [type, setType] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState(blankFacility);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);

  const facilities = useAsync(() => facilitiesApi.list({}).then((response) => response.data.facilities), []);

  const all = facilities.data || [];
  const rows = type ? all.filter((facility) => facility.type === type) : all;
  const activeCount = all.filter((facility) => facility.active).length;

  function openCreate() { setForm(blankFacility); setFormError(''); setEditTarget(null); setCreateOpen(true); }

  function openEdit(facility) {
    setFormError('');
    setForm({
      name: facility.name || '', type: facility.type || 'hospital', description: facility.description || '', address: facility.address || '',
      latitude: facility.latitude ?? '', longitude: facility.longitude ?? '', phone: facility.phone || '', emergencyPhone: facility.emergencyPhone || '',
      email: facility.email || '', openingHours: facility.openingHours || '', emergencyServiceAvailable: facility.emergencyServiceAvailable !== false,
      status: facility.status || 'operational', available: facility.available !== false, active: facility.active !== false
    });
    setEditTarget(facility);
    setCreateOpen(true);
  }

  useEffect(() => {
    const focus = searchParams.get('focus');
    if (!focus || !facilities.data) return;
    const target = facilities.data.find((facility) => String(facility._id) === focus);
    if (target) openEdit(target);
    const next = new URLSearchParams(searchParams);
    next.delete('focus');
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facilities.data, searchParams, setSearchParams]);

  async function saveFacility() {
    setBusy(true); setFormError('');
    try {
      const latitude = Number(form.latitude);
      const longitude = Number(form.longitude);
      if (!form.name.trim()) throw new Error('Facility name is required.');
      if (!form.latitude.trim() || !form.longitude.trim() || !Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) throw new Error('Enter valid latitude and longitude values.');
      const payload = {
        ...form,
        latitude,
        longitude
      };
      if (editTarget) {
        await facilitiesApi.update(editTarget._id, payload);
        toast.success(`Facility “${form.name}” updated.`);
      } else {
        await facilitiesApi.create(payload);
        toast.success(`Facility “${form.name}” added.`);
      }
      setCreateOpen(false);
      setEditTarget(null);
      facilities.reload();
    } catch (error) { setFormError(apiMessage(error)); } finally { setBusy(false); }
  }

  async function removeFacility() {
    setBusy(true);
    try {
      await facilitiesApi.remove(deleteTarget._id);
      toast.success(`Facility “${deleteTarget.name}” deleted.`);
      setDeleteTarget(null);
      facilities.reload();
    } catch (error) { toast.error(apiMessage(error)); } finally { setBusy(false); }
  }

  const columns = [
    {
      key: 'name', label: 'Facility', sortable: true,
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-fg">{row.name}</p>
          <p className="truncate text-[11px] text-fg-muted">{labelize(row.type)} · {row.address || 'No address'}</p>
        </div>
      )
    },
    { key: 'phone', label: 'Phone', render: (row) => <span className="text-[13px] text-fg-muted">{row.phone || '—'}</span> },
    { key: 'emergencyServiceAvailable', label: 'Emergency service', render: (row) => <Badge tone={row.emergencyServiceAvailable ? 'info' : 'muted'}>{row.emergencyServiceAvailable ? 'Yes' : 'No'}</Badge> },
    { key: 'status', label: 'Status', render: (row) => <Badge tone={row.status === 'operational' ? 'success' : row.status === 'degraded' ? 'medium' : 'muted'}>{labelize(row.status)}</Badge> },
    { key: 'active', label: 'State', render: (row) => <Badge tone={row.active ? 'info' : 'critical'}>{row.active ? 'Active' : 'Inactive'}</Badge> },
    {
      key: 'coordinates', label: 'Coordinates',
      render: (row) => <span className="tabular text-[13px] text-fg-muted">{Number(row.latitude).toFixed(4)}, {Number(row.longitude).toFixed(4)}</span>
    },
    {
      key: 'actions', label: '', align: 'right',
      render: (row) => (
        <div className="flex justify-end gap-1.5" onClick={(event) => event.stopPropagation()}>
          <Button size="sm" icon="pencil" onClick={() => openEdit(row)}>Edit</Button>
          <Button size="sm" variant="danger" icon="trash" onClick={() => setDeleteTarget(row)} aria-label={`Delete ${row.name}`} />
        </div>
      )
    }
  ];
  return (
    <div className="space-y-5">
      <SectionHeading
        title="Safety facilities"
        subtitle={`${formatNumber(activeCount)} active of ${formatNumber(all.length)} total. Facilities feed the citizen “Nearby services” screen and incident routing hints.`}
        action={<Button variant="primary" icon="plus" onClick={openCreate}>Add facility</Button>}
      />
      <DataTable
        caption="Safety facilities"
        columns={columns}
        rows={rows}
        loading={facilities.loading}
        error={facilities.error}
        onRetry={facilities.reload}
        onRowClick={(row) => openEdit(row)}
        empty={{ icon: 'hospital', title: 'No facilities', hint: 'Add hospitals, police and fire stations, ambulances, shelters or safe points.' }}
        toolbar={
          <>
            <select value={type} onChange={(event) => setType(event.target.value)} aria-label="Filter by facility type">
              <option value="">All types</option>
              {facilityTypes.map((value) => <option key={value} value={value}>{labelize(value)}</option>)}
            </select>
            {type ? <Button size="sm" icon="close" onClick={() => setType('')}>Clear</Button> : null}
          </>
        }
      />

      <Modal
        open={createOpen}
        onClose={() => { setCreateOpen(false); setEditTarget(null); }}
        title={editTarget ? `Edit ${editTarget.name}` : 'Add safety facility'}
        subtitle="Coordinates are required so citizens and responders can locate the facility."
        footer={
          <>
            <Button onClick={() => { setCreateOpen(false); setEditTarget(null); }} disabled={busy}>Cancel</Button>
            <Button variant="primary" loading={busy} onClick={saveFacility}>{editTarget ? 'Save changes' : 'Add facility'}</Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" required className="sm:col-span-2">
            <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} maxLength={140} />
          </Field>
          <Field label="Type" required>
            <select value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))}>
              {facilityTypes.map((value) => <option key={value} value={value}>{labelize(value)}</option>)}
            </select>
          </Field>
          <Field label="Status">
            <select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}>
              {['operational', 'degraded', 'offline'].map((value) => <option key={value} value={value}>{labelize(value)}</option>)}
            </select>
          </Field>
          <Field label="Description" className="sm:col-span-2">
            <textarea rows={2} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} maxLength={1000} />
          </Field>
          <Field label="Phone"><input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} maxLength={30} /></Field>
          <Field label="Emergency phone"><input value={form.emergencyPhone} onChange={(event) => setForm((current) => ({ ...current, emergencyPhone: event.target.value }))} maxLength={30} /></Field>
          <Field label="Email"><input type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} maxLength={120} /></Field>
          <Field label="Opening hours"><input value={form.openingHours} onChange={(event) => setForm((current) => ({ ...current, openingHours: event.target.value }))} maxLength={160} placeholder="e.g. 24 hours" /></Field>
          <Field label="Address" className="sm:col-span-2">
            <input value={form.address} onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} maxLength={300} />
          </Field>
          <Field label="Latitude" required hint="-90 to 90">
            <input value={form.latitude} onChange={(event) => setForm((current) => ({ ...current, latitude: event.target.value }))} inputMode="decimal" />
          </Field>
          <Field label="Longitude" required hint="-180 to 180">
            <input value={form.longitude} onChange={(event) => setForm((current) => ({ ...current, longitude: event.target.value }))} inputMode="decimal" />
          </Field>
          <Toggle checked={form.emergencyServiceAvailable} onChange={(value) => setForm((current) => ({ ...current, emergencyServiceAvailable: value }))} label="Emergency service available" hint="Shown to citizens when selecting urgent help." />
          <Toggle checked={form.available} onChange={(value) => setForm((current) => ({ ...current, available: value }))} label="Currently available" hint="Receiving patients, callers or visitors right now." />
          <Toggle checked={form.active} onChange={(value) => setForm((current) => ({ ...current, active: value }))} label="Active listing" hint="Shown on citizen nearby-services screens." />
        </div>
        <div className="mt-4 rounded-xl border border-line p-3">
          <p className="mb-2 text-[12px] font-semibold text-fg">Choose on map</p>
          <EmergencyMap showControls={false} cluster={false} autoFit={false} height="h-48" onMapClick={(point) => setForm((current) => ({ ...current, latitude: String(point.latitude), longitude: String(point.longitude) }))} center={form.latitude !== '' && form.longitude !== '' ? [Number(form.latitude), Number(form.longitude)] : undefined} />
          <p className="mt-2 text-[11px] text-fg-subtle">Click the map to replace the coordinates. Manual latitude and longitude remain available above.</p>
        </div>
        {formError ? <div className="mt-4"><ErrorState message={formError} /></div> : null}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title={`Delete ${deleteTarget?.name}?`}
        message="The facility disappears from citizen nearby-services and map views immediately. This cannot be undone."
        confirmLabel="Delete facility"
        danger
        busy={busy}
        onConfirm={removeFacility}
      />
    </div>
  );
}
/* --------------------------------------------------- Emergency categories */

function CategoryManagementSection({ responseTimeOnly = false }) {
  const toast = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState(blankCategory);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);

  const governance = useAsync(() => adminApi.categoryGovernance().then((response) => response.data), []);
  const managed = useAsync(() => emergencyApi.manageTypes().then((response) => response.data.categories), []);

  const managedByKey = Object.fromEntries((managed.data || []).map((category) => [category.key, category]));
  const rows = governance.data?.rows || [];

  function openCreate() { setForm({ ...blankCategory }); setEditTarget(null); setFormError(''); setCreateOpen(true); }

  function openEdit(row) {
    const doc = managedByKey[row.key];
    if (!doc) return;
    setFormError('');
    setForm({ key: doc.key, label: doc.label, description: doc.description || '', icon: doc.icon || 'siren', priority: doc.priority || 'medium', color: doc.color || '#2563eb', subcategories: (doc.subcategories || []).map((item) => `${item.key}:${item.label}`).join('\n'), responseTargetMinutes: doc.responseTargetMinutes ?? 30, responseWarningMinutes: doc.responseWarningMinutes ?? 20, responseCriticalMinutes: doc.responseCriticalMinutes ?? 30, responseTimeActive: doc.responseTimeActive !== false, active: doc.active !== false });
    setEditTarget(doc);
    setCreateOpen(true);
  }

  async function saveCategory() {
    setBusy(true); setFormError('');
    try {
      const subcategories = form.subcategories
        .split('\n')
        .map((line) => {
          const [key, label] = line.split(':');
          return key && key.trim() ? { key: key.trim(), label: (label || key).trim() } : null;
        })
        .filter(Boolean);
      const payload = { key: form.key, label: form.label, description: form.description, icon: form.icon, priority: form.priority, color: form.color, subcategories, responseTargetMinutes: Number(form.responseTargetMinutes), responseWarningMinutes: Number(form.responseWarningMinutes), responseCriticalMinutes: Number(form.responseCriticalMinutes), responseTimeActive: form.responseTimeActive, active: form.active };
      if (editTarget) {
        await emergencyApi.updateType(editTarget._id, payload);
        toast.success(`Category “${form.label}” updated.`);
      } else {
        await emergencyApi.createType(payload);
        toast.success(`Category “${form.label}” created.`);
      }
      setCreateOpen(false);
      setEditTarget(null);
      governance.reload();
      managed.reload();
    } catch (error) { setFormError(apiMessage(error)); } finally { setBusy(false); }
  }

  async function toggleActive(doc) {
    try {
      await emergencyApi.updateType(doc._id, { active: doc.active === false });
      toast.success(`“${doc.label}” ${doc.active === false ? 'activated' : 'deactivated'}.`);
      governance.reload();
      managed.reload();
    } catch (error) { toast.error(apiMessage(error)); }
  }

  async function removeCategory() {
    setBusy(true);
    try {
      await emergencyApi.deleteType(deleteTarget._id);
      toast.success(`Category “${deleteTarget.label}” deleted.`);
      setDeleteTarget(null);
      governance.reload();
      managed.reload();
    } catch (error) { toast.error(apiMessage(error)); } finally { setBusy(false); }
  }
  if (governance.loading || managed.loading) {
    return (
      <div className="space-y-5">
        <SkeletonKpiGrid count={3} />
        <SkeletonList rows={6} />
      </div>
    );
  }
  if (governance.error || managed.error) return <ErrorState message={governance.error || managed.error} onRetry={() => { governance.reload(); managed.reload(); }} />;

  const measuredRows = rows.filter((row) => row.measuredResponseCount > 0);
  const measuredIncidentCount = measuredRows.reduce((sum, row) => sum + row.measuredResponseCount, 0);
  const averageResponseMinutes = measuredIncidentCount
    ? measuredRows.reduce((sum, row) => sum + (row.averageResponseMinutes * row.measuredResponseCount), 0) / measuredIncidentCount
    : null;
  const onTargetPercent = measuredIncidentCount
    ? measuredRows.reduce((sum, row) => sum + ((row.withinTargetPercent ?? 0) * row.measuredResponseCount), 0) / measuredIncidentCount
    : null;

  return (
    <div className="space-y-6">
      <SectionHeading
        title={responseTimeOnly ? 'Response-time policies' : 'Emergency categories'}
        subtitle={responseTimeOnly
          ? 'Per-category response targets are evaluated only against recorded arrival times. No response time is inferred when an incident has not been attended.'
          : `${governance.data?.configuredCount ?? 0} configured in the database over a built-in catalog of ${governance.data?.catalogCount ?? 0}. Usage counts come from the real emergency collection.`}
        action={<Button variant="primary" icon="plus" onClick={openCreate}>{responseTimeOnly ? 'New response policy' : 'New category'}</Button>}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        {responseTimeOnly ? (
          <>
            <StatCard label="Measured responses" value={formatNumber(measuredIncidentCount)} icon="clock" tone="info" hint="incidents with a recorded arrival" />
            <StatCard label="Average response" value={formatMinutes(averageResponseMinutes)} icon="activity" tone="neutral" hint="weighted across recorded arrivals" />
            <StatCard label="Within target" value={onTargetPercent == null ? '—' : `${Math.round(onTargetPercent)}%`} icon="check" tone="success" hint="using each category's active policy" />
          </>
        ) : (
          <>
            <StatCard label="Configured categories" value={formatNumber(governance.data?.configuredCount)} icon="layers" tone="info" hint="stored in the database" />
            <StatCard label="Built-in catalog" value={formatNumber(governance.data?.catalogCount)} icon="box" tone="neutral" hint="compiled into the API" />
            <StatCard label="Reports across categories" value={formatNumber(governance.data?.totalReports)} icon="siren" tone="critical" hint="all recorded incidents" />
          </>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {rows.map((row) => {
          const doc = managedByKey[row.key];
          return (
            <article key={row.key} className="civic-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-fg">{row.label}</p>
                  <p className="truncate text-[11px] text-fg-subtle"><code className="font-mono">{row.key}</code></p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <Badge tone={row.source === 'database' ? 'info' : 'neutral'}>{row.source === 'database' ? 'Database' : 'Catalog'}</Badge>
                  <Badge tone={row.active ? 'success' : 'muted'}>{row.active ? 'Active' : 'Inactive'}</Badge>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-4 text-[12px] text-fg-muted">
                {responseTimeOnly ? (
                  <>
                    <span>Target <span className="tabular font-semibold text-fg">{row.responseTargetMinutes} min</span></span>
                    <span>Warning <span className="tabular font-semibold text-fg">{row.responseWarningMinutes} min</span></span>
                    <span>Critical <span className="tabular font-semibold text-fg">{row.responseCriticalMinutes} min</span></span>
                    <span>{row.responseTimeActive ? 'Policy enabled' : 'Policy paused'}</span>
                    <span>{row.measuredResponseCount ? `${formatNumber(row.measuredResponseCount)} arrivals · ${formatMinutes(row.averageResponseMinutes)} average${row.withinTargetPercent == null ? '' : ` · ${row.withinTargetPercent}% within target`}` : 'No recorded arrivals yet.'}</span>
                  </>
                ) : (
                  <>
                    <span><span className="tabular font-semibold text-fg">{formatNumber(row.usage)}</span> reports</span>
                    <span><span className="tabular font-semibold text-fg">{formatNumber(row.restrictedCount)}</span> restricted</span>
                    <span>Last reported {row.lastReportedAt ? formatRelative(row.lastReportedAt) : 'never'}</span>
                    <span>Response target {row.responseTargetMinutes} min · {row.responseTimeActive ? 'enabled' : 'paused'}</span>
                    <span>Measured response {row.measuredResponseCount ? `${formatNumber(row.measuredResponseCount)} incident(s) · ${formatMinutes(row.averageResponseMinutes)} average` : 'No response-time data available yet.'}</span>
                  </>
                )}
              </div>
              {!responseTimeOnly && (row.subcategories?.length ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {row.subcategories.map((sub) => (
                    <span key={sub.key} className="chip status-muted" title={`${sub.label}: ${sub.usage} report(s)`}>
                      {sub.label} · {formatNumber(sub.usage)}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-[12px] text-fg-subtle">No subcategories configured.</p>
              ))}
              <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
                <Button size="sm" icon="pencil" disabled={!doc || !row.editable} onClick={() => openEdit(row)}>{responseTimeOnly ? 'Configure' : 'Edit'}</Button>
                <Button size="sm" icon={row.active ? 'close' : 'check'} disabled={!doc} onClick={() => toggleActive(doc)}>
                  {row.active ? 'Deactivate' : 'Activate'}
                </Button>
                <Button size="sm" variant="danger" icon="trash" disabled={!doc || row.usage > 0} onClick={() => setDeleteTarget(doc)}>Delete</Button>
                {!row.editable && <span className="self-center text-[11px] text-fg-subtle">Catalog entry — create a database override to customise it.</span>}
              </div>
            </article>
          );
        })}
      </div>
      <Modal
        open={createOpen}
        onClose={() => { setCreateOpen(false); setEditTarget(null); }}
        title={editTarget ? `Edit ${editTarget.label}` : 'New emergency category'}
        subtitle="Keys are lowercase_snake_case. Subcategories are one per line as key:Label."
        footer={
          <>
            <Button onClick={() => { setCreateOpen(false); setEditTarget(null); }} disabled={busy}>Cancel</Button>
            <Button
              variant="primary"
              loading={busy}
              disabled={editTarget ? !form.label.trim() : (!form.key.trim() || !form.label.trim())}
              onClick={saveCategory}
            >
              {editTarget ? 'Save changes' : 'Create category'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {!editTarget && (
            <Field label="Key" required hint="e.g. road_traffic — letters, numbers and underscores only.">
              <input value={form.key} onChange={(event) => setForm((current) => ({ ...current, key: event.target.value }))} maxLength={80} />
            </Field>
          )}
          <Field label="Label" required>
            <input value={form.label} onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))} maxLength={80} />
          </Field>
          <Field label="Description" className="sm:col-span-2">
            <textarea rows={2} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} maxLength={300} />
          </Field>
          <Field label="Icon key"><input value={form.icon} onChange={(event) => setForm((current) => ({ ...current, icon: event.target.value }))} maxLength={60} placeholder="siren" /></Field>
          <Field label="Priority">
            <select value={form.priority} onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value }))}>{['low', 'medium', 'high', 'critical'].map((value) => <option key={value} value={value}>{labelize(value)}</option>)}</select>
          </Field>
          <Field label="Response target (minutes)" required hint="1–1440"><input type="number" min="1" max="1440" value={form.responseTargetMinutes} onChange={(event) => setForm((current) => ({ ...current, responseTargetMinutes: event.target.value }))} /></Field>
          <Field label="Warning threshold" required hint="Must not exceed target"><input type="number" min="1" max="1440" value={form.responseWarningMinutes} onChange={(event) => setForm((current) => ({ ...current, responseWarningMinutes: event.target.value }))} /></Field>
          <Field label="Critical threshold" required hint="Must not exceed target"><input type="number" min="1" max="1440" value={form.responseCriticalMinutes} onChange={(event) => setForm((current) => ({ ...current, responseCriticalMinutes: event.target.value }))} /></Field>
          <Field label="Status color"><input type="color" value={form.color} onChange={(event) => setForm((current) => ({ ...current, color: event.target.value }))} className="h-10 w-20 p-1" /></Field>
          <Toggle checked={form.responseTimeActive} onChange={(value) => setForm((current) => ({ ...current, responseTimeActive: value }))} label="Response-time rules active" hint="This configuration is used for operational SLA reporting." />
          <Toggle checked={form.active} onChange={(value) => setForm((current) => ({ ...current, active: value }))} label="Category active" hint="Inactive categories are hidden from new citizen reports." />
          <Field label="Subcategories" hint="One per line in the format key: Label.">
            <textarea
              rows={4}
              value={form.subcategories}
              onChange={(event) => setForm((current) => ({ ...current, subcategories: event.target.value }))}
              placeholder={'crash: Traffic crash\njam: Traffic jam'}
            />
          </Field>
          {formError ? <ErrorState message={formError} /> : null}
          <p className="text-[12px] text-fg-subtle">
            The key never changes after creation, so historical incidents keep grouping correctly. Renaming only updates the display label.
          </p>
        </div>
      </Modal>
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title={`Delete ${deleteTarget?.label || 'category'}?`}
        message="Deletion is only allowed when no emergency records use this category. Historical incidents are never deleted."
        confirmLabel="Delete category"
        danger
        busy={busy}
        onConfirm={removeCategory}
      />

    </div>
  );
}

export function CategoriesSection() {
  return <CategoryManagementSection />;
}

export function ResponseTimeSection() {
  return <CategoryManagementSection responseTimeOnly />;
}
/* -------------------------------------------------------- Response teams */

const blankTeam = { name: '', type: 'medical', phone: '', baseAddress: '', baseLatitude: '', baseLongitude: '', availability: 'available', active: true };

export function ResponseTeamsSection() {
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState(blankTeam);
  const [memberIds, setMemberIds] = useState([]);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);

  const teams = useAsync(() => responseTeamsApi.list({ all: 'true' }).then((response) => response.data.teams), []);
  const responders = useAsync(() => emergencyApi.assignableResponders().then((response) => response.data.responders), []);

  const rows = teams.data || [];

  function openCreate() { setForm(blankTeam); setMemberIds([]); setFormError(''); setEditTarget(null); setCreateOpen(true); }

  function openEdit(team) {
    setFormError('');
    setForm({
      name: team.name || '', type: team.type || 'medical', phone: team.phone || '',
      baseAddress: team.baseLocation?.address || '',
      baseLatitude: team.baseLocation?.latitude ?? '',
      baseLongitude: team.baseLocation?.longitude ?? '',
      availability: team.availability || 'available',
      active: team.active !== false
    });
    setMemberIds((team.members || []).map((member) => member.user?._id || member.user).filter(Boolean));
    setEditTarget(team);
    setCreateOpen(true);
  }

  useEffect(() => {
    const focus = searchParams.get('focus');
    if (!focus || !teams.data) return;
    const target = teams.data.find((team) => String(team._id) === focus);
    if (target) openEdit(target);
    const next = new URLSearchParams(searchParams);
    next.delete('focus');
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teams.data, searchParams, setSearchParams]);

  async function saveTeam() {
    setBusy(true); setFormError('');
    try {
      const hasCoords = form.baseLatitude !== '' && form.baseLongitude !== '';
      const payload = {
        name: form.name,
        type: form.type,
        phone: form.phone,
        availability: form.availability,
        active: form.active,
        memberIds,
        baseLocation: {
          address: form.baseAddress,
          ...(hasCoords ? { latitude: Number(form.baseLatitude), longitude: Number(form.baseLongitude) } : {})
        }
      };
      if (editTarget) {
        await responseTeamsApi.update(editTarget._id, payload);
        toast.success(`Team “${form.name}” updated.`);
      } else {
        await responseTeamsApi.create(payload);
        toast.success(`Team “${form.name}” created.`);
      }
      setCreateOpen(false);
      setEditTarget(null);
      teams.reload();
    } catch (error) { setFormError(apiMessage(error)); } finally { setBusy(false); }
  }

  async function removeTeam() {
    setBusy(true);
    try {
      await responseTeamsApi.remove(deleteTarget._id);
      toast.success(`Team “${deleteTarget.name}” deleted.`);
      setDeleteTarget(null);
      teams.reload();
    } catch (error) { toast.error(apiMessage(error)); } finally { setBusy(false); }
  }

  const columns = [
    {
      key: 'name', label: 'Team', sortable: true,
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-fg">{row.name}</p>
          <p className="truncate text-[11px] text-fg-muted">{labelize(row.type)} · {row.members?.length || 0} member(s)</p>
        </div>
      )
    },
    { key: 'availability', label: 'Availability', render: (row) => <Badge tone={availabilityTone(row.availability)}>{labelize(row.availability)}</Badge> },
    { key: 'active', label: 'State', render: (row) => <Badge tone={row.active ? 'success' : 'muted'}>{row.active ? 'Active' : 'Inactive'}</Badge> },
    { key: 'phone', label: 'Phone', render: (row) => <span className="text-[13px] text-fg-muted">{row.phone || '—'}</span> },
    { key: 'base', label: 'Base', render: (row) => <span className="text-[13px] text-fg-muted">{row.baseLocation?.address || '—'}</span> },
    {
      key: 'actions', label: '', align: 'right',
      render: (row) => (
        <div className="flex justify-end gap-1.5" onClick={(event) => event.stopPropagation()}>
          <Button size="sm" icon="pencil" onClick={() => openEdit(row)}>Edit</Button>
          <Button size="sm" variant="danger" icon="trash" onClick={() => setDeleteTarget(row)} aria-label={`Delete ${row.name}`} />
        </div>
      )
    }
  ];
  return (
    <div className="space-y-5">
      <SectionHeading
        title="Response teams"
        subtitle={`${rows.length} team(s). Availability and workload drive nearby-team suggestions during dispatch.`}
        action={<Button variant="primary" icon="plus" onClick={openCreate}>New team</Button>}
      />
      <DataTable
        caption="Response teams"
        columns={columns}
        rows={rows}
        loading={teams.loading}
        error={teams.error}
        onRetry={teams.reload}
        onRowClick={(row) => openEdit(row)}
        empty={{ icon: 'route', title: 'No response teams', hint: 'Create teams and assign active emergency responders as members.' }}
      />
      <p className="text-[12px] text-fg-subtle">
        Live workload and utilisation for these teams is shown on the Overview and Operations Analytics screens, computed from real assignment timestamps only.
      </p>
      <Modal
        open={createOpen}
        onClose={() => { setCreateOpen(false); setEditTarget(null); }}
        title={editTarget ? `Edit ${editTarget.name}` : 'New response team'}
        subtitle="Members must be active emergency officers or field workers — the backend enforces this."
        size="lg"
        footer={
          <>
            <Button onClick={() => { setCreateOpen(false); setEditTarget(null); }} disabled={busy}>Cancel</Button>
            <Button variant="primary" loading={busy} disabled={!form.name.trim()} onClick={saveTeam}>{editTarget ? 'Save changes' : 'Create team'}</Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Team name" required>
            <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} maxLength={120} />
          </Field>
          <Field label="Type" required>
            <select value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))}>
              {teamTypes.map((value) => <option key={value} value={value}>{labelize(value)}</option>)}
            </select>
          </Field>
          <Field label="Phone">
            <input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} maxLength={30} />
          </Field>
          <Field label="Availability">
            <select value={form.availability} onChange={(event) => setForm((current) => ({ ...current, availability: event.target.value }))}>
              {['available', 'busy', 'offline'].map((value) => <option key={value} value={value}>{labelize(value)}</option>)}
            </select>
          </Field>
          <Field label="Base address" className="sm:col-span-2">
            <input value={form.baseAddress} onChange={(event) => setForm((current) => ({ ...current, baseAddress: event.target.value }))} maxLength={300} />
          </Field>
          <Field label="Base latitude" hint="Optional. Both coordinates are required together.">
            <input value={form.baseLatitude} onChange={(event) => setForm((current) => ({ ...current, baseLatitude: event.target.value }))} inputMode="decimal" />
          </Field>
          <Field label="Base longitude" hint="Optional. Both coordinates are required together.">
            <input value={form.baseLongitude} onChange={(event) => setForm((current) => ({ ...current, baseLongitude: event.target.value }))} inputMode="decimal" />
          </Field>
          <div className="sm:col-span-2">
            <Toggle checked={form.active} onChange={(value) => setForm((current) => ({ ...current, active: value }))} label="Team active" hint="Inactive teams are excluded from dispatch suggestions." />
          </div>
          <div className="sm:col-span-2">
            <p className="text-[13px] font-semibold text-fg">Members ({memberIds.length} selected)</p>
            {responders.loading && <SkeletonList rows={3} />}
            {!responders.loading && responders.error && <ErrorState message={responders.error} onRetry={responders.reload} />}
            {!responders.loading && !(responders.data || []).length && (
              <EmptyState icon="users" title="No assignable responders" hint="Active emergency officers and field workers must exist before they can join teams." />
            )}
            <div className="mt-2 max-h-56 space-y-1.5 overflow-y-auto">
              {(responders.data || []).map((responder) => (
                <label key={responder._id} className="flex cursor-pointer items-center gap-3 rounded-lg border p-2.5" style={{ borderColor: 'var(--line)' }}>
                  <input
                    type="checkbox"
                    checked={memberIds.includes(responder._id)}
                    onChange={() => setMemberIds((current) => (current.includes(responder._id) ? current.filter((id) => id !== responder._id) : [...current, responder._id]))}
                    style={{ width: 16, height: 16, accentColor: 'var(--color-civic-600)' }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-fg">{responder.name}</span>
                    <span className="block truncate text-[11px] text-fg-muted">{labelize(responder.role)}{responder.departmentName ? ` · ${responder.departmentName}` : ''}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>
        {formError ? <div className="mt-4"><ErrorState message={formError} /></div> : null}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title={`Delete ${deleteTarget?.name}?`}
        message="The team is removed from dispatch suggestions permanently. Past assignment records are preserved. This cannot be undone."
        confirmLabel="Delete team"
        danger
        busy={busy}
        onConfirm={removeTeam}
      />
    </div>
  );
}

/* -------------------------------------------------------- Service config */

export function ServiceConfigSection() {
  const toast = useToast();
  const governance = useAsync(() => adminApi.categoryGovernance().then((response) => response.data), []);
  const departments = useAsync(() => adminApi.departments({ limit: 50 }).then((response) => response.data.departments), []);
  const [routingTarget, setRoutingTarget] = useState(null);
  const [routingTypes, setRoutingTypes] = useState([]);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  const routingDepartments = (departments.data || []).filter((department) => department.scope !== 'civic' || (department.emergencyTypes || []).length);
  const reportCategories = governance.data?.reportCategories || [];
  const reportDepartments = governance.data?.reportDepartments || [];

  function openRouting(department) {
    setFormError('');
    setRoutingTarget(department);
    setRoutingTypes([...(department.emergencyTypes || [])]);
  }

  async function saveRouting() {
    setBusy(true); setFormError('');
    try {
      await adminApi.updateEmergencyRouting(routingTarget._id, { emergencyTypes: routingTypes });
      toast.success(`Emergency routing updated for “${routingTarget.name}”.`);
      setRoutingTarget(null);
      departments.reload();
    } catch (error) { setFormError(apiMessage(error)); } finally { setBusy(false); }
  }

  if (governance.loading || departments.loading) {
    return (
      <div className="space-y-5">
        <SkeletonKpiGrid count={3} />
        <SkeletonList rows={6} />
      </div>
    );
  }
  if (governance.error || departments.error) {
    return <ErrorState message={governance.error || departments.error} onRetry={() => { governance.reload(); departments.reload(); }} />;
  }

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Service configuration"
        subtitle="Emergency routing per department, the complaint categories citizens can choose, and the backend-authoritative feature flags."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            icon="siren"
            title="Emergency routing"
            subtitle="Which department receives which emergency type. Civic-only departments without routing are hidden."
            action={<Badge tone="neutral">{routingDepartments.length} routed</Badge>}
          />
          <CardBody className="space-y-3">
            {!routingDepartments.length && (
              <EmptyState icon="route" title="No departments route emergencies" hint="Give a department an emergency-capable scope from the Departments screen first." />
            )}
            {routingDepartments.map((department) => (
              <div key={department._id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3" style={{ borderColor: 'var(--line)' }}>
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-fg">{department.name}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <Badge tone={department.scope === 'emergency' ? 'high' : department.scope === 'hybrid' ? 'success' : 'info'}>{labelize(department.scope)}</Badge>
                    {(department.emergencyTypes || []).map((type) => <Badge key={type} tone="neutral">{labelize(type)}</Badge>)}
                  </div>
                </div>
                <Button size="sm" icon="pencil" onClick={() => openRouting(department)}>Edit routing</Button>
              </div>
            ))}
          </CardBody>
        </Card>
        <Card>
          <CardHeader
            icon="clipboardList"
            title="Report categories"
            subtitle="The complaint categories compiled into the reporting API, with real usage from the reports collection."
            action={<Badge tone="neutral">{reportCategories.length} categories</Badge>}
          />
          <CardBody className="space-y-4">
            <div className="flex flex-wrap gap-1.5">
              {reportCategories.map((category) => (
                <span key={category.key} className={cx('chip', category.usage ? 'status-info' : 'status-muted')} title={`${category.key} — ${category.usage} report(s)`}>
                  {labelize(category.key)} · {formatNumber(category.usage)}
                </span>
              ))}
            </div>
            <div>
              <p className="mb-2 text-[13px] font-semibold text-fg">Department destinations</p>
              <ul className="grid gap-2 sm:grid-cols-2">
                {reportDepartments.map((department) => (
                  <li key={department.name} className="flex items-center justify-between gap-2 rounded-lg border p-2.5" style={{ borderColor: 'var(--line)' }}>
                    <span className="truncate text-[13px] text-fg-muted">{department.name}</span>
                    <span className="tabular text-[13px] font-semibold text-fg">{formatNumber(department.usage)}</span>
                  </li>
                ))}
              </ul>
            </div>
            <p className="text-[12px] text-fg-subtle">
              Categories and destinations are compiled from <code className="font-mono">config/reportOptions.js</code>; changing them requires a code change, which keeps citizen-facing forms stable.
            </p>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader icon="sliders" title="Backend-authoritative feature flags" subtitle="Served by the governance API — surfaces disable themselves from the server response, never from local storage." />
        <CardBody>
          <div className="flex flex-wrap gap-2">
            {Object.entries(governance.data?.features || {}).map(([feature, enabled]) => (
              <span key={feature} className={cx('chip', enabled ? 'status-success' : 'status-muted')}>
                {labelize(feature)} · {enabled ? 'Enabled' : 'Disabled'}
              </span>
            ))}
          </div>
          <p className="mt-3 text-[12px] text-fg-subtle">Edit feature flags under Governance → System Settings.</p>
        </CardBody>
      </Card>

      <Modal
        open={Boolean(routingTarget)}
        onClose={() => setRoutingTarget(null)}
        title={`Emergency routing · ${routingTarget?.name || ''}`}
        subtitle="At least one type is required. Civic departments are promoted to hybrid when routing is saved."
        footer={
          <>
            <Button onClick={() => setRoutingTarget(null)} disabled={busy}>Cancel</Button>
            <Button variant="primary" loading={busy} disabled={!routingTypes.length} onClick={saveRouting}>Save routing</Button>
          </>
        }
      >
        <div className="flex flex-wrap gap-2">
          {emergencyTypes.map((type) => {
            const active = routingTypes.includes(type);
            return (
              <button
                key={type}
                type="button"
                aria-pressed={active}
                onClick={() => setRoutingTypes((current) => (active ? current.filter((value) => value !== type) : [...current, type]))}
                className={cx('chip cursor-pointer', active ? 'status-info' : 'status-muted')}
              >
                {labelize(type)}
              </button>
            );
          })}
        </div>
        {formError ? <div className="mt-4"><ErrorState message={formError} /></div> : null}
      </Modal>
    </div>
  );
}
