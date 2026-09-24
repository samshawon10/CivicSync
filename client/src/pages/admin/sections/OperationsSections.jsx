import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { adminApi } from '../../../services/adminService.js';
import { emergencyApi } from '../../../services/emergencyService.js';
import useAsync from '../../../hooks/useAsync.js';
import { apiMessage } from '../../../services/api.js';
import DataTable from '../../../components/ui/DataTable.jsx';
import { Badge, Button, EmptyState, ErrorState, Field, KeyValue, SectionHeading, StatCard } from '../../../components/ui/primitives.jsx';
import { SkeletonKpiGrid, SkeletonList } from '../../../components/ui/Skeleton.jsx';
import { ConfirmDialog, Drawer, Modal } from '../../../components/ui/Overlays.jsx';
import { useToast } from '../../../components/ui/Toaster.jsx';
import { cx, formatDate, formatDateTime, formatMinutes, formatNumber, formatRelative, labelize, severityTone, statusTone } from '../../../utils/format.js';

const emergencyStatuses = ['reported', 'received', 'assessing', 'verified', 'dispatched', 'en_route', 'on_scene', 'responding', 'resolved', 'closed', 'cancelled', 'false_report', 'reassigned', 'escalated', 'requires_backup'];
const complaintStatuses = ['pending', 'verified', 'assigned', 'in_progress', 'under_review', 'completed', 'closed'];
const complaintPriorities = ['low', 'medium', 'high', 'urgent'];
const complaintTransitions = { pending: ['verified'], verified: ['assigned'], assigned: ['in_progress'], in_progress: ['under_review'], under_review: ['completed'], completed: ['closed'], closed: [] };
const priorityTone = (priority) => ({ low: 'neutral', medium: 'medium', high: 'high', urgent: 'critical' }[priority] || 'neutral');

/* ----------------------------------------------------------- Emergencies */

export function EmergenciesSection({ searchParams }) {
  const toast = useToast();
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState({ open: false, id: null, loading: false, error: '', data: null });
  const [form, setForm] = useState({ status: '', notes: '' });
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => { const timer = setTimeout(() => { setQuery(search.trim()); setPage(1); }, 250); return () => clearTimeout(timer); }, [search]);

  const emergencies = useAsync(
    () => adminApi.emergencies({ status, search: query, page, limit: 15 }).then((response) => response.data),
    [status, query, page]
  );

  const rows = emergencies.data?.emergencies || [];
  const pagination = emergencies.data?.pagination;

  function openDetail(id) {
    if (!id) return;
    setDetail({ open: true, id, loading: true, error: '', data: null });
    adminApi.emergency(id)
      .then(({ data }) => {
        setForm({ status: data.emergency.status, notes: '' });
        setDetail({ open: true, id, loading: false, error: '', data });
      })
      .catch((error) => setDetail({ open: true, id, loading: false, error: apiMessage(error), data: null }));
  }

  useEffect(() => {
    const focus = searchParams?.get('focus');
    if (focus) openDetail(focus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveUpdate() {
    setBusy(true); setFormError('');
    try {
      await adminApi.updateEmergency(detail.id, { status: form.status, notes: form.notes });
      toast.success('Emergency updated. The change was written to the audit trail.');
      setDetail({ open: false, id: null, loading: false, error: '', data: null });
      emergencies.reload();
    } catch (error) { setFormError(apiMessage(error)); } finally { setBusy(false); }
  }

  const columns = [
    {
      key: 'emergencyId', label: 'Incident',
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-fg">{row.emergencyId || 'Unnumbered'} · {row.title}</p>
          <p className="truncate text-[11px] text-fg-muted">{labelize(row.category)} · raised by {row.citizen?.name || row.citizenName || 'Unknown'}</p>
        </div>
      )
    },
    { key: 'severity', label: 'Severity', render: (row) => <Badge tone={severityTone(row.severity)}>{labelize(row.severity)}</Badge> },
    { key: 'status', label: 'Status', render: (row) => <Badge tone={statusTone(row.status)}>{labelize(row.status)}</Badge> },
    { key: 'visibility', label: 'Visibility', render: (row) => (row.visibility === 'restricted' ? <Badge tone="critical">Restricted</Badge> : <Badge tone="neutral">Standard</Badge>) },
    { key: 'assignedDepartment', label: 'Department', render: (row) => <span className="text-[13px] text-fg-muted">{row.assignedDepartment?.name || '—'}</span> },
    { key: 'createdAt', label: 'Raised', sortable: true, render: (row) => <span className="text-[13px] text-fg-muted">{formatRelative(row.createdAt)}</span> },
    {
      key: 'actions', label: '', align: 'right',
      render: (row) => (
        <div onClick={(event) => event.stopPropagation()}>
          <Button size="sm" icon="eye" onClick={() => openDetail(row._id)}>Govern</Button>
        </div>
      )
    }
  ];
  return (
    <div className="space-y-5">
      <SectionHeading
        title="Emergency incidents"
        subtitle={`${formatNumber(pagination?.total ?? 0)} incident(s). Dispatch stays on the operational command centre — this is the governance view for status corrections and audit.`}
        action={<Button icon="download" onClick={() => window.open(adminApi.exportUrl('emergencies'), '_blank')}>Export CSV</Button>}
      />
      <DataTable
        caption="Emergency incidents"
        columns={columns}
        rows={rows}
        loading={emergencies.loading}
        error={emergencies.error}
        onRetry={emergencies.reload}
        onRowClick={(row) => openDetail(row._id)}
        empty={{ icon: 'siren', title: 'No incidents match', hint: 'Clear the filters or raise a test incident from the citizen portal.' }}
        toolbar={
          <>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search title, reporter or address…" aria-label="Search incidents" className="w-60" />
            <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} aria-label="Filter by status">
              <option value="">All statuses</option>
              {emergencyStatuses.map((value) => <option key={value} value={value}>{labelize(value)}</option>)}
            </select>
            {search || status ? <Button size="sm" icon="close" onClick={() => { setSearch(''); setStatus(''); setPage(1); }}>Clear</Button> : null}
          </>
        }
        pagination={pagination ? { page: pagination.page, pages: pagination.pages, total: pagination.total, limit: pagination.limit } : undefined}
        onPage={setPage}
      />

      <Drawer
        open={detail.open}
        onClose={() => setDetail({ open: false, id: null, loading: false, error: '', data: null })}
        title={detail.data ? `${detail.data.emergency.emergencyId || 'Incident'} · ${detail.data.emergency.title}` : 'Incident'}
        subtitle={detail.data ? `${labelize(detail.data.emergency.category)} · ${labelize(detail.data.emergency.severity)} severity` : (detail.loading ? 'Loading…' : '')}
        width="sm:max-w-2xl"
      >
        {detail.loading && <SkeletonList rows={5} />}
        {!detail.loading && detail.error ? <ErrorState message={detail.error} onRetry={() => openDetail(detail.id)} /> : null}
        {detail.data && (() => {
          const emergency = detail.data.emergency;
          return (
            <div className="space-y-5">
              <KeyValue
                items={[
                  { label: 'Reporter', value: emergency.citizen?.name || emergency.citizenName || '—' },
                  { label: 'Contact', value: emergency.citizen?.phone || emergency.citizenPhone || '—' },
                  { label: 'Status', value: <Badge tone={statusTone(emergency.status)}>{labelize(emergency.status)}</Badge> },
                  { label: 'Severity', value: <Badge tone={severityTone(emergency.severity)}>{labelize(emergency.severity)}</Badge> },
                  { label: 'Visibility', value: emergency.visibility === 'restricted' ? 'Restricted (sensitive)' : 'Standard' },
                  { label: 'Source', value: labelize(emergency.source || 'report') },
                  { label: 'Department', value: emergency.assignedDepartment?.name || '—' },
                  { label: 'Officer', value: emergency.assignedOfficer?.name || '—' },
                  { label: 'Raised', value: formatDateTime(emergency.createdAt) },
                  { label: 'Response time', value: formatMinutes(emergency.responseTimeMinutes) },
                  { label: 'Address', value: emergency.location?.address || '—' },
                  { label: 'Description', value: emergency.description || '—' }
                ]}
              />
              {emergency.visibility === 'restricted' && (
                <p className="rounded-xl border p-3 text-[12px] text-fg-muted" style={{ borderColor: 'var(--line)', backgroundColor: 'color-mix(in oklab, #ef4444 8%, var(--surface))' }}>
                  Restricted incident: victim-identifying details and coordinates are excluded from public aggregates, community verification and heatmaps.
                </p>
              )}
              <div className="rounded-xl border p-4" style={{ borderColor: 'var(--line)' }}>
                <p className="text-[13px] font-semibold text-fg">Governance override</p>
                <p className="mt-1 text-[11px] text-fg-subtle">Corrections are audited with your actor role. The command centre performs dispatch, escalation and lifecycle transitions.</p>
                <div className="mt-3 space-y-3">
                  <Field label="Status">
                    <select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}>
                      {emergencyStatuses.map((value) => <option key={value} value={value}>{labelize(value)}</option>)}
                    </select>
                  </Field>
                  <Field label="Audit note" hint="Stored on the incident activity trail (max 500 characters).">
                    <textarea rows={2} value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} maxLength={500} placeholder="Why is this change being made?" />
                  </Field>
                  {formError ? <ErrorState message={formError} /> : null}
                  <Button variant="primary" icon="check" loading={busy} onClick={saveUpdate}>Save correction</Button>
                </div>
              </div>
            </div>
          );
        })()}
      </Drawer>
    </div>
  );
}
/* ------------------------------------------------------------ Complaints */

export function ComplaintsSection() {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState({ open: false, id: null, loading: false, error: '', data: null });
  const [form, setForm] = useState({ status: '', priority: '', departmentName: '', note: '' });
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => { const timer = setTimeout(() => { setQuery(search.trim()); setPage(1); }, 250); return () => clearTimeout(timer); }, [search]);

  const complaints = useAsync(
    () => adminApi.complaints({ search: query, status, priority, page, limit: 15 }).then((response) => response.data),
    [query, status, priority, page]
  );
  const departments = useAsync(() => adminApi.departments({ status: 'active', limit: 50 }).then((response) => response.data.departments), []);

  const rows = complaints.data?.complaints || [];
  const pagination = complaints.data?.pagination;

  function openDetail(id) {
    if (!id) return;
    setDetail({ open: true, id, loading: true, error: '', data: null });
    adminApi.complaint(id)
      .then(({ data }) => {
        const complaint = data.complaint;
        setForm({ status: complaint.status, priority: complaint.priority || 'medium', departmentName: complaint.departmentName || '', note: '' });
        setDetail({ open: true, id, loading: false, error: '', data });
      })
      .catch((error) => setDetail({ open: true, id, loading: false, error: apiMessage(error), data: null }));
  }

  async function saveUpdate() {
    setBusy(true); setFormError('');
    try {
      const complaint = detail.data.complaint;
      const payload = { note: form.note };
      if (form.status !== complaint.status) payload.status = form.status;
      if (form.priority !== complaint.priority) payload.priority = form.priority;
      if (form.departmentName !== complaint.departmentName) payload.departmentName = form.departmentName;
      await adminApi.updateComplaint(detail.id, payload);
      toast.success('Complaint updated.');
      setDetail({ open: false, id: null, loading: false, error: '', data: null });
      complaints.reload();
    } catch (error) { setFormError(apiMessage(error)); } finally { setBusy(false); }
  }

  async function removeComplaint() {
    setBusy(true);
    try {
      await adminApi.deleteComplaint(deleteTarget._id);
      toast.success(`“${deleteTarget.title}” deleted.`);
      setDeleteTarget(null);
      setDetail({ open: false, id: null, loading: false, error: '', data: null });
      complaints.reload();
    } catch (error) { toast.error(apiMessage(error)); } finally { setBusy(false); }
  }

  const columns = [
    {
      key: 'title', label: 'Complaint', sortable: true,
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-fg">{row.title}</p>
          <p className="truncate text-[11px] text-fg-muted">{labelize(row.category)} · {row.createdBy?.name || 'Unknown citizen'}</p>
        </div>
      )
    },
    { key: 'departmentName', label: 'Department', sortable: true, render: (row) => <span className="text-[13px] text-fg-muted">{row.departmentName}</span> },
    { key: 'priority', label: 'Priority', render: (row) => <Badge tone={priorityTone(row.priority)}>{labelize(row.priority)}</Badge> },
    { key: 'status', label: 'Status', sortable: true, render: (row) => <Badge tone={statusTone(row.status)}>{labelize(row.status)}</Badge> },
    { key: 'createdAt', label: 'Filed', sortable: true, render: (row) => <span className="text-[13px] text-fg-muted">{formatRelative(row.createdAt)}</span> },
    {
      key: 'actions', label: '', align: 'right',
      render: (row) => (
        <div className="flex justify-end gap-1.5" onClick={(event) => event.stopPropagation()}>
          <Button size="sm" icon="eye" onClick={() => openDetail(row._id)}>Manage</Button>
          <Button size="sm" variant="danger" icon="trash" onClick={() => setDeleteTarget(row)} aria-label={`Delete ${row.title}`} />
        </div>
      )
    }
  ];
  return (
    <div className="space-y-5">
      <SectionHeading
        title="Civic complaints"
        subtitle={`${formatNumber(pagination?.total ?? 0)} complaint(s). Status follows the audited lifecycle: pending → verified → assigned → in progress → under review → completed → closed.`}
        action={<Button icon="download" onClick={() => window.open(adminApi.exportUrl('complaints'), '_blank')}>Export CSV</Button>}
      />
      <DataTable
        caption="Civic complaints"
        columns={columns}
        rows={rows}
        loading={complaints.loading}
        error={complaints.error}
        onRetry={complaints.reload}
        onRowClick={(row) => openDetail(row._id)}
        empty={{ icon: 'clipboardList', title: 'No complaints match', hint: 'Clear the filters to see the full queue.' }}
        toolbar={
          <>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search title, description or department…" aria-label="Search complaints" className="w-60" />
            <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} aria-label="Filter by status">
              <option value="">All statuses</option>
              {complaintStatuses.map((value) => <option key={value} value={value}>{labelize(value)}</option>)}
            </select>
            <select value={priority} onChange={(event) => { setPriority(event.target.value); setPage(1); }} aria-label="Filter by priority">
              <option value="">All priorities</option>
              {complaintPriorities.map((value) => <option key={value} value={value}>{labelize(value)}</option>)}
            </select>
            {search || status || priority ? <Button size="sm" icon="close" onClick={() => { setSearch(''); setStatus(''); setPriority(''); setPage(1); }}>Clear</Button> : null}
          </>
        }
        pagination={pagination ? { page: pagination.page, pages: pagination.pages, total: pagination.total, limit: pagination.limit } : undefined}
        onPage={setPage}
      />
      <Drawer
        open={detail.open}
        onClose={() => setDetail({ open: false, id: null, loading: false, error: '', data: null })}
        title={detail.data?.complaint?.title || 'Complaint'}
        subtitle={detail.data ? `${labelize(detail.data.complaint.category)} · ${detail.data.complaint.departmentName}` : (detail.loading ? 'Loading…' : '')}
        width="sm:max-w-2xl"
      >
        {detail.loading && <SkeletonList rows={5} />}
        {!detail.loading && detail.error ? <ErrorState message={detail.error} onRetry={() => openDetail(detail.id)} /> : null}
        {detail.data && (() => {
          const complaint = detail.data.complaint;
          const allowedStatuses = [complaint.status, ...(complaintTransitions[complaint.status] || [])];
          return (
            <div className="space-y-5">
              <KeyValue
                items={[
                  { label: 'Status', value: <Badge tone={statusTone(complaint.status)}>{labelize(complaint.status)}</Badge> },
                  { label: 'Priority', value: <Badge tone={priorityTone(complaint.priority)}>{labelize(complaint.priority)}</Badge> },
                  { label: 'Citizen', value: complaint.createdBy?.name || '—' },
                  { label: 'Contact', value: complaint.createdBy?.phone || complaint.createdBy?.email || '—' },
                  { label: 'Filed', value: formatDateTime(complaint.createdAt) },
                  { label: 'Last update', value: formatDateTime(complaint.updatedAt) },
                  { label: 'Area', value: complaint.location?.area || '—' },
                  { label: 'Address', value: complaint.location?.address || '—' },
                  { label: 'Assigned officer', value: complaint.assignedOfficer?.name || '—' },
                  { label: 'Field worker', value: complaint.assignedFieldWorker?.name || '—' }
                ]}
              />
              <p className="text-[13px] leading-relaxed text-fg-muted">{complaint.description}</p>
              {complaint.attachments?.length ? (
                <div>
                  <p className="mb-2 text-[13px] font-semibold text-fg">Evidence ({complaint.attachments.length})</p>
                  <div className="flex flex-wrap gap-2">
                    {complaint.attachments.map((file) => (
                      <a key={file.url} href={file.url} target="_blank" rel="noreferrer" className="chip status-info hover:underline">
                        {file.mediaType === 'image' ? 'Image' : 'Video'} · {file.originalName}
                      </a>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="rounded-xl border p-4" style={{ borderColor: 'var(--line)' }}>
                <p className="text-[13px] font-semibold text-fg">Manage complaint</p>
                <p className="mt-1 text-[11px] text-fg-subtle">Only the next lifecycle step is accepted by the backend — this keeps the audit trail honest.</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Field label="Status">
                    <select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}>
                      {allowedStatuses.map((value) => <option key={value} value={value}>{labelize(value)}{value === complaint.status ? ' (current)' : ''}</option>)}
                    </select>
                  </Field>
                  <Field label="Priority">
                    <select value={form.priority} onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value }))}>
                      {complaintPriorities.map((value) => <option key={value} value={value}>{labelize(value)}</option>)}
                    </select>
                  </Field>
                  <Field label="Department" className="sm:col-span-2" hint="Must be an active civic or hybrid department.">
                    <select value={form.departmentName} onChange={(event) => setForm((current) => ({ ...current, departmentName: event.target.value }))}>
                      {(departments.data || []).map((department) => <option key={department._id} value={department.name}>{department.name}</option>)}
                      {form.departmentName && !(departments.data || []).some((department) => department.name === form.departmentName) && <option value={form.departmentName}>{form.departmentName}</option>}
                    </select>
                  </Field>
                  <Field label="Audit note" className="sm:col-span-2" hint="Stored on the complaint activity trail (max 500 characters).">
                    <textarea rows={2} value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} maxLength={500} />
                  </Field>
                </div>
                {formError ? <ErrorState message={formError} className="mt-3" /> : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="primary" icon="check" loading={busy} onClick={saveUpdate}>Save changes</Button>
                  <Button variant="danger" icon="trash" onClick={() => setDeleteTarget(complaint)}>Delete complaint</Button>
                </div>
              </div>
              <div>
                <p className="mb-2 text-[13px] font-semibold text-fg">Activity trail</p>
                {!complaint.activity?.length ? <EmptyState icon="activity" title="No activity yet" hint="Lifecycle changes are recorded here." /> : null}
                <ul className="space-y-2">
                  {(complaint.activity || []).map((entry, index) => (
                    <li key={`${entry.timestamp}-${index}`} className="rounded-xl border p-3" style={{ borderColor: 'var(--line)' }}>
                      <p className="text-[13px] font-semibold text-fg">{entry.action}</p>
                      {entry.note ? <p className="text-[12px] text-fg-muted">{entry.note}</p> : null}
                      <p className="mt-0.5 text-[11px] text-fg-subtle">{labelize(entry.actorRole)} · {formatRelative(entry.timestamp)}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          );
        })()}
      </Drawer>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title={`Delete “${deleteTarget?.title}”?`}
        message="The complaint and its attachments are permanently removed. This cannot be undone."
        confirmLabel="Delete complaint"
        danger
        busy={busy}
        onConfirm={removeComplaint}
      />
    </div>
  );
}
/* ---------------------------------------------------------------- Alerts */

export function AlertsSection() {
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState({ title: '', message: '', category: 'public_safety', severity: 'medium', status: 'active', address: '', affectedArea: '', radiusKm: '', startAt: '', endAt: '', latitude: '', longitude: '' });
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [toggleTarget, setToggleTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const alerts = useAsync(() => emergencyApi.alerts({ all: 'true' }).then((response) => response.data.alerts), []);
  const rows = alerts.data || [];
  const activeCount = rows.filter((alert) => alert.active).length;

  useEffect(() => {
    const focus = searchParams.get('focus');
    if (!focus || !alerts.data) return;
    const target = alerts.data.find((alert) => String(alert._id) === focus);
    if (target) setToggleTarget(target);
    const next = new URLSearchParams(searchParams);
    next.delete('focus');
    setSearchParams(next, { replace: true });
  }, [alerts.data, searchParams, setSearchParams]);

  async function createAlert() {
    setBusy(true); setFormError('');
    try {
      const hasLatitude = form.latitude !== '';
      const hasLongitude = form.longitude !== '';
      if (hasLatitude !== hasLongitude) throw new Error('Enter both latitude and longitude, or leave both blank.');
      const latitude = Number(form.latitude);
      const longitude = Number(form.longitude);
      if (hasLatitude && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180)) throw new Error('Enter valid latitude and longitude values.');
      const payload = {
        title: form.title, message: form.message, category: form.category, severity: form.severity, status: form.status,
        affectedArea: form.affectedArea, radiusKm: form.radiusKm === '' ? undefined : Number(form.radiusKm),
        startAt: form.startAt || undefined, endAt: form.endAt || undefined,
        location: { address: form.address, ...(hasLatitude ? { latitude, longitude } : {}) }
      };
      const result = editTarget ? await emergencyApi.updateAlert(editTarget._id, payload) : await emergencyApi.createAlert(payload);
      const { data } = result;
      toast.success(data.delivery === 'in_app' ? (editTarget ? 'Broadcast updated. Active citizens receive the new version in their notification feed.' : 'Broadcast published. Active citizens receive it in their notification feed.') : 'Broadcast saved. It is scheduled and is not yet active.');
      setCreateOpen(false);
      setEditTarget(null);
      setForm({ title: '', message: '', category: 'public_safety', severity: 'medium', status: 'active', address: '', affectedArea: '', radiusKm: '', startAt: '', endAt: '', latitude: '', longitude: '' });
      alerts.reload();
    } catch (error) { setFormError(apiMessage(error)); } finally { setBusy(false); }
  }

  async function removeAlert() {
    setBusy(true);
    try {
      await emergencyApi.deleteAlert(deleteTarget._id);
      toast.success(`Broadcast “${deleteTarget.title}” deleted.`);
      setDeleteTarget(null);
      alerts.reload();
    } catch (error) { toast.error(apiMessage(error)); } finally { setBusy(false); }
  }

  async function toggleAlert() {
    setBusy(true);
    try {
      await emergencyApi.updateAlert(toggleTarget._id, { active: !toggleTarget.active });
      toast.success(toggleTarget.active ? 'Broadcast closed and hidden from citizen feeds.' : 'Broadcast reopened.');
      setToggleTarget(null);
      alerts.reload();
    } catch (error) { toast.error(apiMessage(error)); } finally { setBusy(false); }
  }

  const columns = [
    {
      key: 'title', label: 'Broadcast',
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-fg">{row.title}</p>
          <p className="truncate text-[11px] text-fg-muted">{row.message}</p>
        </div>
      )
    },
    { key: 'severity', label: 'Severity', render: (row) => <Badge tone={severityTone(row.severity)}>{labelize(row.severity)}</Badge> },
    { key: 'category', label: 'Category', render: (row) => <span className="text-[13px] text-fg-muted">{labelize(row.category || 'public_safety')}</span> },
    { key: 'location', label: 'Area', render: (row) => <span className="text-[13px] text-fg-muted">{row.affectedArea || row.location?.address || 'Whole platform'}{row.radiusKm ? ` · ${row.radiusKm} km radius` : ''}</span> },
    { key: 'status', label: 'State', render: (row) => <Badge tone={row.status === 'active' ? 'success' : row.status === 'scheduled' ? 'info' : 'muted'}>{labelize(row.status)}</Badge> },
    { key: 'createdAt', label: 'Published', sortable: true, render: (row) => <span className="text-[13px] text-fg-muted">{formatRelative(row.createdAt)}</span> },
    {
      key: 'actions', label: '', align: 'right',
      render: (row) => (
        <div onClick={(event) => event.stopPropagation()} className="flex justify-end gap-1.5">
          <Button size="sm" icon="pencil" onClick={() => { setForm({ title: row.title, message: row.message, category: row.category || 'public_safety', severity: row.severity || 'medium', status: row.status || 'active', address: row.location?.address || '', affectedArea: row.affectedArea || '', radiusKm: row.radiusKm ?? '', startAt: row.startAt ? row.startAt.slice(0, 16) : '', endAt: row.endAt ? row.endAt.slice(0, 16) : '', latitude: row.location?.latitude ?? '', longitude: row.location?.longitude ?? '' }); setEditTarget(row); setCreateOpen(true); }}>Edit</Button>
          <Button size="sm" icon={row.active ? 'close' : 'check'} onClick={() => setToggleTarget(row)}>{row.active ? 'Close' : 'Publish'}</Button>
          <Button size="sm" variant="danger" icon="trash" onClick={() => setDeleteTarget(row)} aria-label={`Delete ${row.title}`} />
        </div>
      )
    }
  ];

  return (
    <div className="space-y-5">
      <SectionHeading
        title="Public safety broadcasts"
        subtitle={`${activeCount} active · ${rows.length} listed. Publishing notifies every active citizen in-app. Message content is immutable after publish — close and re-publish to amend.`}
        action={<Button variant="primary" icon="plus" onClick={() => { setFormError(''); setEditTarget(null); setCreateOpen(true); }}>New broadcast</Button>}
      />
      <DataTable
        caption="Public safety broadcasts"
        columns={columns}
        rows={rows}
        loading={alerts.loading}
        error={alerts.error}
        onRetry={alerts.reload}
        empty={{ icon: 'megaphone', title: 'No broadcasts yet', hint: 'Create the first public safety broadcast — it will appear on citizen safety feeds immediately.' }}
      />
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title={editTarget ? `Edit “${editTarget.title}”` : 'New public safety broadcast'}
        subtitle={editTarget ? 'Updates are persisted and active citizens are notified in-app when the alert is active.' : 'In-app delivery only. Scheduled alerts remain inactive until their start time.'}
        footer={
          <>
            <Button onClick={() => setCreateOpen(false)} disabled={busy}>Cancel</Button>
            <Button variant="primary" loading={busy} disabled={!form.title.trim() || !form.message.trim()} onClick={createAlert}>Publish broadcast</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Title" required>
            <input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} maxLength={160} placeholder="e.g. Water supply interruption — Dhanmondi" />
          </Field>
          <Field label="Message" required hint="Plain text, max 1000 characters.">
            <textarea rows={4} value={form.message} onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))} maxLength={1000} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Category">
              <select value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}>{['emergency', 'public_safety', 'road', 'flood', 'fire', 'weather', 'infrastructure', 'announcement'].map((value) => <option key={value} value={value}>{labelize(value)}</option>)}</select>
            </Field>
            <Field label="Severity"><select value={form.severity} onChange={(event) => setForm((current) => ({ ...current, severity: event.target.value }))}>{['low', 'medium', 'high', 'critical'].map((value) => <option key={value} value={value}>{labelize(value)}</option>)}</select></Field>
            <Field label="Status"><select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}>{['draft', 'scheduled', 'active', 'expired', 'cancelled'].map((value) => <option key={value} value={value}>{labelize(value)}</option>)}</select></Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Affected area"><input value={form.affectedArea} onChange={(event) => setForm((current) => ({ ...current, affectedArea: event.target.value }))} maxLength={160} placeholder="Citywide, district or route" /></Field>
            <Field label="Address / area description"><input value={form.address} onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} maxLength={300} /></Field>
            <Field label="Start time"><input type="datetime-local" value={form.startAt} onChange={(event) => setForm((current) => ({ ...current, startAt: event.target.value }))} /></Field>
            <Field label="End time"><input type="datetime-local" value={form.endAt} onChange={(event) => setForm((current) => ({ ...current, endAt: event.target.value }))} /></Field>
            <Field label="Radius (km)" hint="0.1–100"><input type="number" min="0.1" max="100" step="0.1" value={form.radiusKm} onChange={(event) => setForm((current) => ({ ...current, radiusKm: event.target.value }))} /></Field>
            <Field label="Center latitude" hint="Optional"><input type="number" min="-90" max="90" value={form.latitude} onChange={(event) => setForm((current) => ({ ...current, latitude: event.target.value }))} /></Field>
            <Field label="Center longitude" hint="Optional"><input type="number" min="-180" max="180" value={form.longitude} onChange={(event) => setForm((current) => ({ ...current, longitude: event.target.value }))} /></Field>
          </div>
          {formError ? <ErrorState message={formError} /> : null}
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(toggleTarget)}
        onClose={() => setToggleTarget(null)}
        title={toggleTarget?.active ? `Close “${toggleTarget?.title}”?` : `Publish “${toggleTarget?.title}”?`}
        message={toggleTarget?.active
          ? 'The broadcast is removed from citizen notification feeds. Existing notifications already delivered remain in user histories.'
          : 'The broadcast becomes active and is delivered in-app to active citizens.'}
        confirmLabel={toggleTarget?.active ? 'Close broadcast' : 'Publish broadcast'}
        danger={Boolean(toggleTarget?.active)}
        busy={busy}
        onConfirm={toggleAlert}
      />
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title={`Delete “${deleteTarget?.title || 'broadcast'}”?`}
        message="This permanently removes the broadcast record. Existing citizen notifications remain in their history, but the alert is no longer managed or published."
        confirmLabel="Delete broadcast"
        danger
        busy={busy}
        onConfirm={removeAlert}
      />
    </div>
  );
}
