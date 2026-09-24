import { useCallback, useEffect, useMemo, useState } from 'react';
import { Boxes, Plus, RefreshCw, Truck, CheckCircle2, Send, Wrench, Users } from 'lucide-react';
import { departmentApi } from '../../services/departmentService.js';
import { apiMessage } from '../../services/api.js';
import { showSuccess, showError } from '../../utils/sweetAlert.js';
import { Modal } from '../../components/ui/Overlays.jsx';
import {
  Panel,
  Pill,
  StatusPill,
  EmptyPanel,
  OpsError,
  StatTile,
  TextField,
  inputClass,
  primaryButton,
  secondaryButton,
  formatOpsDate
} from './DepartmentOpsUI.jsx';
import useDepartmentSync from './useDepartmentSync.js';

const resourceTypes = [
  { id: 'vehicle', label: 'Vehicle', icon: Truck },
  { id: 'equipment', label: 'Equipment', icon: Wrench },
  { id: 'specialist', label: 'Specialist', icon: Users },
  { id: 'personnel', label: 'Personnel', icon: Users },
  { id: 'emergency_supplies', label: 'Emergency supplies', icon: Boxes }
];

const typeIcon = Object.fromEntries(resourceTypes.map((item) => [item.id, item.icon]));

const emptyResource = { name: '', type: 'vehicle', identifier: '', capacityOrQuantity: 1, notes: '' };

function ResourceForm({ onClose, onSaved }) {
  const [draft, setDraft] = useState(emptyResource);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  function set(key, value) { setDraft((current) => ({ ...current, [key]: value })); }

  async function submit(event) {
    event.preventDefault();
    if (!draft.name.trim()) { setError('Resource name is required.'); return; }
    setBusy(true); setError('');
    try {
      await departmentApi.createResource({ ...draft, name: draft.name.trim(), capacityOrQuantity: Number(draft.capacityOrQuantity) || 1 });
      showSuccess('Resource registered', `${draft.name} is now part of the department resource pool.`);
      onSaved();
    } catch (err) {
      const message = apiMessage(err);
      setError(message); showError('Unable to register resource', message);
    } finally { setBusy(false); }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Register department resource"
      subtitle="Vehicles, equipment and specialists can then be requested against live cases."
      footer={<><button type="button" onClick={onClose} className={secondaryButton}>Cancel</button><button type="submit" form="resource-form" disabled={busy} className={primaryButton}>{busy ? 'Saving…' : 'Register resource'}</button></>}
    >
      <form id="resource-form" onSubmit={submit} className="space-y-4">
        <OpsError message={error} />
        <TextField label="Resource name">
          <input className={inputClass} value={draft.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Tipper Truck 04" required maxLength={120} />
        </TextField>
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label="Type">
            <select className={inputClass} value={draft.type} onChange={(e) => set('type', e.target.value)}>
              {resourceTypes.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </TextField>
          <TextField label="Identifier / plate number">
            <input className={inputClass} value={draft.identifier} onChange={(e) => set('identifier', e.target.value)} placeholder="e.g. DHK-GA-1234" />
          </TextField>
        </div>
        <TextField label="Capacity or quantity">
          <input type="number" min="1" className={inputClass} value={draft.capacityOrQuantity} onChange={(e) => set('capacityOrQuantity', e.target.value)} />
        </TextField>
        <TextField label="Notes">
          <textarea rows={3} className={inputClass} value={draft.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Maintenance schedule, storage location, operator required…" />
        </TextField>
      </form>
    </Modal>
  );
}

function RequestResourceModal({ resource, cases, onClose, onSubmitted }) {
  const [caseId, setCaseId] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    if (!reason.trim()) { setError('Explain why this resource is needed.'); return; }
    setBusy(true); setError('');
    try {
      await departmentApi.requestResource(resource._id, { caseId: caseId || null, reason: reason.trim() });
      showSuccess('Request submitted', 'The Department Head will review this resource request.');
      onSubmitted();
    } catch (err) {
      const message = apiMessage(err);
      setError(message); showError('Unable to submit request', message);
    } finally { setBusy(false); }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Request ${resource.name}`}
      subtitle="Link the request to a case so the approver understands the operational impact."
      footer={<><button type="button" onClick={onClose} className={secondaryButton}>Cancel</button><button type="submit" form="resource-request-form" disabled={busy} className={primaryButton}>{busy ? 'Submitting…' : 'Submit request'}</button></>}
    >
      <form id="resource-request-form" onSubmit={submit} className="space-y-4">
        <OpsError message={error} />
        <TextField label="Link to case" hint="Optional, but strongly recommended for audit history.">
          <select className={inputClass} value={caseId} onChange={(event) => setCaseId(event.target.value)}>
            <option value="">No case (general request)</option>
            {cases.map((item) => <option key={item._id} value={item._id}>{item.title}</option>)}
          </select>
        </TextField>
        <TextField label="Reason">
          <textarea rows={3} className={inputClass} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Why is this resource required, and for how long?" required />
        </TextField>
      </form>
    </Modal>
  );
}

function ReviewRequestModal({ resource, request, onClose, onReviewed }) {
  const [status, setStatus] = useState('approved');
  const [reviewNote, setReviewNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    setBusy(true); setError('');
    try {
      await departmentApi.reviewResource(resource._id, { requestId: request._id, status, reviewNote: reviewNote.trim() });
      showSuccess(`Request ${status}`, `${resource.name} request was ${status}.`);
      onReviewed();
    } catch (err) {
      const message = apiMessage(err);
      setError(message); showError('Unable to review request', message);
    } finally { setBusy(false); }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Review request for ${resource.name}`}
      subtitle="Approving a request marks the resource as in use on the linked case."
      footer={<><button type="button" onClick={onClose} className={secondaryButton}>Cancel</button><button type="submit" form="resource-review-form" disabled={busy} className={primaryButton}>{busy ? 'Saving…' : 'Submit decision'}</button></>}
    >
      <form id="resource-review-form" onSubmit={submit} className="space-y-4">
        <OpsError message={error} />
        <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
          <p className="font-bold">Requester: {request.requesterRole ? request.requesterRole.replaceAll('_', ' ') : 'Department staff'}</p>
          <p className="mt-1">{request.reason || 'No reason provided.'}</p>
          <p className="mt-1 text-xs text-slate-500">Requested {formatOpsDate(request.requestedAt)}</p>
        </div>
        <TextField label="Decision">
          <select className={inputClass} value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="approved">Approve and allocate</option>
            <option value="rejected">Reject request</option>
          </select>
        </TextField>
        <TextField label="Review note">
          <textarea rows={3} className={inputClass} value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} placeholder="Allocation window, operator instructions, rejection rationale…" />
        </TextField>
      </form>
    </Modal>
  );
}


function ResourceCard({ resource, canApprove, onRequest, onReview }) {
  const Icon = typeIcon[resource.type] || Boxes;
  const pending = (resource.requests || []).filter((request) => request.status === 'pending');
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-civic-50 text-civic-700"><Icon size={18} aria-hidden="true" /></span>
          <div className="min-w-0">
            <h4 className="truncate font-black text-ink">{resource.name}</h4>
            <p className="mt-0.5 text-xs text-slate-500">
              {resource.type.replaceAll('_', ' ')}{resource.identifier ? ` · ${resource.identifier}` : ''} · Qty {resource.capacityOrQuantity}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          <StatusPill value={resource.status} kind="resource" />
          {pending.length > 0 && <Pill tone="warning">{pending.length} pending</Pill>}
        </div>
      </div>

      <dl className="mt-3 grid gap-1.5 text-xs text-slate-600">
        <div className="flex gap-1.5">
          <dt className="font-black uppercase tracking-wider text-slate-400">Allocated case</dt>
          <dd className="font-semibold">{resource.assignedCase?.title || 'Not allocated'}</dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="font-black uppercase tracking-wider text-slate-400">Assigned team</dt>
          <dd className="font-semibold">{resource.assignedTeam?.name || 'No team'}</dd>
        </div>
      </dl>

      {resource.notes && <p className="mt-3 rounded-lg bg-slate-50 p-2.5 text-xs text-slate-600">{resource.notes}</p>}

      {pending.length > 0 && (
        <div className="mt-3 space-y-2">
          {pending.map((request) => (
            <div key={request._id} className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900">
              <p className="font-bold">{request.requesterRole ? request.requesterRole.replaceAll('_', ' ') : 'Staff'} requested this resource</p>
              <p className="mt-0.5">{request.reason || 'No reason provided.'}</p>
              <p className="mt-1 text-amber-700">{formatOpsDate(request.requestedAt)}</p>
              {canApprove && (
                <div className="mt-2 flex gap-2">
                  <button type="button" onClick={() => onReview(request)} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 font-bold text-white"><CheckCircle2 size={12} aria-hidden="true" /> Review request</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-4">
        <button type="button" onClick={() => onRequest(resource)} className={secondaryButton}>
          <Send size={13} className="mr-1 inline" /> Request resource
        </button>
      </div>
    </article>
  );
}

export default function ResourceCenter({ role }) {
  const canApprove = role === 'department_head';
  const [resources, setResources] = useState([]);
  const [cases, setCases] = useState([]);
  const [typeFilter, setTypeFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [requestFor, setRequestFor] = useState(null);
  const [review, setReview] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const { data } = await departmentApi.resources();
      setResources(data.resources || []);
    } catch (err) { setError(apiMessage(err)); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  useDepartmentSync(load);

  useEffect(() => {
    let alive = true;
    departmentApi.reports({ limit: 50, sort: 'priority' })
      .then(({ data }) => { if (alive) setCases(data.reports || []); })
      .catch(() => { if (alive) setCases([]); });
    return () => { alive = false; };
  }, []);

  const stats = useMemo(() => ({
    total: resources.length,
    available: resources.filter((item) => item.status === 'available').length,
    inUse: resources.filter((item) => ['in_use', 'assigned'].includes(item.status)).length,
    pending: resources.reduce((sum, item) => sum + (item.requests || []).filter((request) => request.status === 'pending').length, 0)
  }), [resources]);

  const visible = useMemo(() => {
    const list = typeFilter ? resources.filter((item) => item.type === typeFilter) : resources;
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [resources, typeFilter]);

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Registered resources" value={stats.total} icon={Boxes} hint="Vehicles, equipment & specialists" />
        <StatTile label="Available" value={stats.available} tone="success" hint="Ready for allocation" />
        <StatTile label="In use" value={stats.inUse} tone="warning" hint="Allocated to live cases" />
        <StatTile label="Pending requests" value={stats.pending} tone={stats.pending ? 'danger' : 'neutral'} hint={canApprove ? 'Awaiting your decision' : 'Awaiting head approval'} />
      </div>

      <Panel
        title="Resource pool"
        subtitle="Requests are routed to the Department Head for approval before allocation."
        action={
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={load} className={secondaryButton}><RefreshCw size={14} className="mr-1 inline" /> Refresh</button>
            {canApprove && <button type="button" onClick={() => setCreating(true)} className={primaryButton}><Plus size={15} className="mr-1 inline" /> Register resource</button>}
          </div>
        }
      >
        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={() => setTypeFilter('')} className={`rounded-full border px-3 py-1.5 text-xs font-bold ${typeFilter === '' ? 'border-ink bg-ink text-white' : 'border-slate-300 bg-white text-slate-600'}`}>All types</button>
          {resourceTypes.map((item) => (
            <button key={item.id} type="button" onClick={() => setTypeFilter(item.id)} className={`rounded-full border px-3 py-1.5 text-xs font-bold ${typeFilter === item.id ? 'border-ink bg-ink text-white' : 'border-slate-300 bg-white text-slate-600'}`}>
              {item.label}
            </button>
          ))}
        </div>

        <div className="mt-4"><OpsError message={error} onRetry={load} /></div>

        {loading ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2">{[0, 1].map((index) => <div key={index} className="h-36 animate-pulse rounded-xl bg-slate-100" />)}</div>
        ) : visible.length ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {visible.map((resource) => (
              <ResourceCard
                key={resource._id}
                resource={resource}
                canApprove={canApprove}
                onRequest={setRequestFor}
                onReview={(request) => setReview({ resource, request })}
              />
            ))}
          </div>
        ) : (
          <div className="mt-4">
            <EmptyPanel
              title="No resources registered"
              message={canApprove ? 'Register vehicles, equipment or specialists to make them requestable.' : 'Your department head has not registered any resources yet.'}
            />
          </div>
        )}
      </Panel>

      {creating && <ResourceForm onClose={() => setCreating(false)} onSaved={() => { setCreating(false); load(); }} />}
      {requestFor && <RequestResourceModal resource={requestFor} cases={cases} onClose={() => setRequestFor(null)} onSubmitted={() => { setRequestFor(null); load(); }} />}
      {review && <ReviewRequestModal resource={review.resource} request={review.request} onClose={() => setReview(null)} onReviewed={() => { setReview(null); load(); }} />}
    </div>
  );
}

