import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ArrowRightLeft, CheckCircle2, RefreshCw, ShieldAlert } from 'lucide-react';
import { departmentApi } from '../../services/departmentService.js';
import { apiMessage } from '../../services/api.js';
import { showSuccess, showError } from '../../utils/sweetAlert.js';
import { Drawer, Modal } from '../../components/ui/Overlays.jsx';
import {
  Panel,
  Pill,
  PriorityPill,
  StatusPill,
  SlaPill,
  SlaBreakdown,
  NextActionCard,
  EmptyPanel,
  OpsError,
  TextField,
  inputClass,
  primaryButton,
  secondaryButton,
  formatOpsDate
} from './DepartmentOpsUI.jsx';
import CaseAssignmentPanel from './CaseAssignmentPanel.jsx';
import CaseConversation, { CaseTimeline } from './CaseConversation.jsx';
import ResolveEscalationModal from './ResolveEscalationModal.jsx';
import useDepartmentSync from './useDepartmentSync.js';

const reportStatuses = ['pending', 'verified', 'assigned', 'in_progress', 'under_review', 'completed', 'closed'];
const priorities = ['low', 'medium', 'high', 'urgent'];

function EscalateModal({ report, onClose, onDone }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    if (!reason.trim()) { setError('An escalation reason is required.'); return; }
    setBusy(true); setError('');
    try {
      await departmentApi.escalate(report._id, reason.trim());
      showSuccess('Case escalated', 'Department Heads have been notified and the case is now urgent.');
      onDone();
    } catch (err) {
      const message = apiMessage(err);
      setError(message); showError('Unable to escalate case', message);
    } finally { setBusy(false); }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Escalate case to Department Head"
      subtitle="Escalation sets the case to urgent priority and notifies every head in the department."
      footer={<><button type="button" onClick={onClose} className={secondaryButton}>Cancel</button><button type="submit" form="escalate-form" disabled={busy} className={primaryButton}>{busy ? 'Escalating…' : 'Escalate case'}</button></>}
    >
      <form id="escalate-form" onSubmit={submit} className="space-y-4">
        <OpsError message={error} />
        <TextField label="Escalation reason" hint="Be specific — this appears at the top of the head's escalation queue.">
          <textarea rows={4} className={inputClass} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Target breached and the assigned team is blocked without a crane truck…" required />
        </TextField>
      </form>
    </Modal>
  );
}

function HandoverModal({ report, staff, onClose, onDone }) {
  const [newOfficerId, setNewOfficerId] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const currentOfficerId = report.assignedOfficer?._id || report.assignedOfficer;
  const officers = staff.filter((person) => ['department_officer', 'officer'].includes(person.role) && person.id !== String(currentOfficerId));

  async function submit(event) {
    event.preventDefault();
    if (!newOfficerId) { setError('Select the officer who will take over this case.'); return; }
    setBusy(true); setError('');
    try {
      await departmentApi.handover(report._id, { newOfficerId, reason: reason.trim(), notes: notes.trim() });
      showSuccess('Case handed over', 'The receiving officer has been notified.');
      onDone();
    } catch (err) {
      const message = apiMessage(err);
      setError(message); showError('Unable to hand over case', message);
    } finally { setBusy(false); }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Hand over case"
      subtitle="The previous owner is recorded in the case handover history for audit."
      footer={<><button type="button" onClick={onClose} className={secondaryButton}>Cancel</button><button type="submit" form="handover-form" disabled={busy} className={primaryButton}>{busy ? 'Transferring…' : 'Transfer case'}</button></>}
    >
      <form id="handover-form" onSubmit={submit} className="space-y-4">
        <OpsError message={error} />
        <TextField label="Receiving officer">
          <select className={inputClass} value={newOfficerId} onChange={(event) => setNewOfficerId(event.target.value)}>
            <option value="">Select an officer…</option>
            {officers.map((person) => <option key={person.id} value={person.id}>{person.name} · {person.workload ?? 0} active cases</option>)}
          </select>
        </TextField>
        <TextField label="Reason">
          <input className={inputClass} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Shift end / leave / specialist coverage" />
        </TextField>
        <TextField label="Handover notes">
          <textarea rows={3} className={inputClass} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Site access details, pending vendor call, resident contact…" />
        </TextField>
      </form>
    </Modal>
  );
}

function ReviewCompletionModal({ report, onClose, onDone }) {
  const [verificationStatus, setVerificationStatus] = useState('approved');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const completion = report.completionReport || {};

  async function submit(event) {
    event.preventDefault();
    setBusy(true); setError('');
    try {
      await departmentApi.reviewCompletion(report._id, { verificationStatus, note: note.trim() });
      showSuccess(verificationStatus === 'approved' ? 'Case closed' : 'Completion rejected', verificationStatus === 'approved' ? 'The case has been closed and the citizen notified.' : 'The case returned to in progress for rework.');
      onDone();
    } catch (err) {
      const message = apiMessage(err);
      setError(message); showError('Unable to review completion', message);
    } finally { setBusy(false); }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Review completion report"
      subtitle="Approving closes the case. Rejecting returns it to in progress."
      footer={<><button type="button" onClick={onClose} className={secondaryButton}>Cancel</button><button type="submit" form="review-form" disabled={busy} className={primaryButton}>{busy ? 'Saving…' : 'Submit review'}</button></>}
    >
      <form id="review-form" onSubmit={submit} className="space-y-4">
        <OpsError message={error} />
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          <p className="font-black uppercase tracking-wider text-slate-500">Submitted summary</p>
          <p className="mt-1">{completion.summary || 'No summary submitted.'}</p>
          {completion.materials && <p className="mt-1 text-xs">Materials: {completion.materials}</p>}
          {completion.notes && <p className="mt-1 text-xs">Notes: {completion.notes}</p>}
          <p className="mt-1 text-xs text-slate-500">Submitted {formatOpsDate(completion.submittedAt)}</p>
        </div>
        <TextField label="Decision">
          <select className={inputClass} value={verificationStatus} onChange={(event) => setVerificationStatus(event.target.value)}>
            <option value="approved">Approve and close case</option>
            <option value="rejected">Reject and re-open case</option>
          </select>
        </TextField>
        <TextField label="Review note">
          <textarea rows={3} className={inputClass} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Quality check remarks, rework instructions…" />
        </TextField>
      </form>
    </Modal>
  );
}

const workspaceTabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'dispatch', label: 'Dispatch & teams' },
  { id: 'messages', label: 'Messages' },
  { id: 'activity', label: 'Activity' }
];

/**
 * Unified case workspace: one place for the head, officer and field worker to see
 * SLA position, dispatch people/teams, escalate, hand over, message and review work.
 */
export default function CaseWorkspace({ caseId, role, staff = [], onClose, onChanged }) {
  const isHead = role === 'department_head';
  const canManage = ['department_head', 'department_officer'].includes(role);
  const [report, setReport] = useState(null);
  const [tab, setTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialog, setDialog] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!caseId) return;
    setError('');
    try {
      const { data } = await departmentApi.report(caseId);
      setReport(data.report || null);
    } catch (err) { setError(apiMessage(err)); } finally { setLoading(false); }
  }, [caseId]);

  useEffect(() => { setLoading(true); setReport(null); load(); }, [caseId, load]);
  useDepartmentSync(load, { enabled: Boolean(caseId) });

  const escalated = Boolean(report?.escalation?.isEscalated && !report?.escalation?.resolvedAt);

  async function changePriority(value) {
    setBusy(true);
    try {
      await departmentApi.priority(report._id, value);
      showSuccess('Priority updated', `Case priority is now ${value}.`);
      await load(); onChanged?.();
    } catch (err) { showError('Unable to update priority', apiMessage(err)); } finally { setBusy(false); }
  }

  async function changeStatus(value) {
    setBusy(true);
    try {
      await departmentApi.status(report._id, value);
      showSuccess('Status updated', `Case status is now ${value.replaceAll('_', ' ')}.`);
      await load(); onChanged?.();
    } catch (err) { showError('Unable to update status', apiMessage(err)); } finally { setBusy(false); }
  }

  function afterDialog() { setDialog(null); load(); onChanged?.(); }

  if (!caseId) return null;

  const footer = report ? (
    <>
      <button type="button" onClick={load} className={secondaryButton}><RefreshCw size={14} className="mr-1 inline" /> Refresh</button>
      {canManage && !escalated && (
        <button type="button" onClick={() => setDialog('escalate')} className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-2 text-sm font-bold text-white hover:bg-red-700">
          <ShieldAlert size={14} aria-hidden="true" /> Escalate
        </button>
      )}
      {isHead && escalated && (
        <button type="button" onClick={() => { setTab('overview'); setDialog('resolve'); }} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-bold text-white hover:bg-emerald-700">
          <CheckCircle2 size={14} aria-hidden="true" /> Resolve escalation
        </button>
      )}
      {canManage && (
        <button type="button" onClick={() => setDialog('handover')} className={secondaryButton}>
          <ArrowRightLeft size={14} className="mr-1 inline" /> Hand over
        </button>
      )}
      {isHead && report.status === 'under_review' && (
        <button type="button" onClick={() => setDialog('review')} className={primaryButton}>
          <CheckCircle2 size={14} className="mr-1 inline" /> Review completion
        </button>
      )}
    </>
  ) : null;


  return (
    <>
      <Drawer
        open
        onClose={onClose}
        title={report?.title || 'Case workspace'}
        subtitle={report ? `${String(report.category || '').replaceAll('_', ' ')} · ${report.location?.address || report.location?.area || 'Location not recorded'}` : 'Loading case…'}
        width="sm:max-w-2xl"
        footer={footer}
      >
        {error && <div className="mb-3"><OpsError message={error} onRetry={load} /></div>}

        {loading && !report ? (
          <div className="space-y-3">{[0, 1, 2, 3].map((index) => <div key={index} className="h-20 animate-pulse rounded-xl bg-slate-100" />)}</div>
        ) : report ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill value={report.status} />
              <PriorityPill value={report.priority} />
              <SlaPill sla={report.sla} />
              {escalated && <Pill tone="danger"><AlertTriangle size={11} aria-hidden="true" /> Escalated</Pill>}
              {report.assignedTeam?.name && <Pill tone="progress">Team {report.assignedTeam.name}</Pill>}
              {report.activeTask && <Pill tone="info">Task {String(report.activeTask.status || '').replaceAll('_', ' ')}</Pill>}
            </div>

            {escalated && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                <p className="font-black uppercase tracking-wider">Escalated to Department Head</p>
                <p className="mt-1 font-semibold">{report.escalation.reason}</p>
                <p className="mt-1 text-xs">Escalated {formatOpsDate(report.escalation.escalatedAt)}</p>
              </div>
            )}
            {!escalated && report.escalation?.resolvedAt && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                <p className="font-black uppercase tracking-wider">Escalation resolved</p>
                <p className="mt-1">{report.escalation.resolutionNote || 'No note recorded.'}</p>
                <p className="mt-1 text-xs">{formatOpsDate(report.escalation.resolvedAt)}</p>
              </div>
            )}

            <NextActionCard nextAction={report.nextAction} />

            <div className="flex flex-wrap gap-1.5">
              {workspaceTabs.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${tab === item.id ? 'border-ink bg-ink text-white' : 'border-slate-300 bg-white text-slate-600 hover:border-civic-300'}`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {tab === 'overview' && (
              <div className="space-y-4">
                <Panel title="SLA position" subtitle={`${String(report.priority || 'medium').replaceAll('_', ' ')} priority targets`}>
                  <SlaBreakdown sla={report.sla} />
                </Panel>

                <Panel title="Case details">
                  <dl className="grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
                    <div><dt className="text-xs font-black uppercase tracking-wider text-slate-400">Submitted</dt><dd className="font-semibold">{formatOpsDate(report.createdAt)}</dd></div>
                    <div><dt className="text-xs font-black uppercase tracking-wider text-slate-400">Deadline</dt><dd className="font-semibold">{formatOpsDate(report.dueAt)}</dd></div>
                    <div><dt className="text-xs font-black uppercase tracking-wider text-slate-400">Category</dt><dd className="font-semibold">{String(report.category || '').replaceAll('_', ' ')}</dd></div>
                    <div><dt className="text-xs font-black uppercase tracking-wider text-slate-400">Location</dt><dd className="font-semibold">{report.location?.address || report.location?.area || 'Not recorded'}</dd></div>
                  </dl>
                  {report.description && <p className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{report.description}</p>}
                </Panel>

                <Panel title="Ownership">
                  <dl className="grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
                    <div><dt className="text-xs font-black uppercase tracking-wider text-slate-400">Officer</dt><dd className="font-semibold">{report.assignedOfficer?.name || 'Unassigned'}</dd></div>
                    <div><dt className="text-xs font-black uppercase tracking-wider text-slate-400">Field worker</dt><dd className="font-semibold">{report.assignedFieldWorker?.name || 'Unassigned'}</dd></div>
                    <div><dt className="text-xs font-black uppercase tracking-wider text-slate-400">Team</dt><dd className="font-semibold">{report.assignedTeam?.name || 'No team'}</dd></div>
                    <div><dt className="text-xs font-black uppercase tracking-wider text-slate-400">Team leader</dt><dd className="font-semibold">{report.teamLeader?.name || 'Not set'}</dd></div>
                  </dl>
                </Panel>
              </div>
            )}


            {tab === 'overview' && report.activeTask && (
              <Panel title="Linked field task" subtitle={report.activeTask.taskNumber || 'Field task'}>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill value={report.activeTask.status} kind="task" />
                  <PriorityPill value={report.activeTask.priority} />
                  <span className="text-xs text-slate-500">Due {formatOpsDate(report.activeTask.targetDueAt)}</span>
                </div>
                {report.activeTask.blockedInfo?.reason && (
                  <p className="mt-2 rounded-lg border border-red-200 bg-red-50 p-2.5 text-sm text-red-800">Blocked: {report.activeTask.blockedInfo.reason}</p>
                )}
                {report.activeTask.completion?.summary && (
                  <p className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 text-sm text-emerald-800">{report.activeTask.completion.summary}</p>
                )}
              </Panel>
            )}

            {tab === 'overview' && report.completionReport?.verificationStatus && (
              <Panel title="Completion report" subtitle={`Verification: ${report.completionReport.verificationStatus}`}>
                <p className="text-sm text-slate-700">{report.completionReport.summary || 'No summary submitted.'}</p>
                {report.completionReport.materials && <p className="mt-1 text-xs text-slate-500">Materials: {report.completionReport.materials}</p>}
                {report.completionReport.notes && <p className="mt-1 text-xs text-slate-500">Notes: {report.completionReport.notes}</p>}
              </Panel>
            )}

            {tab === 'overview' && canManage && (
              <Panel title="Case controls" subtitle="Priority and status changes are written to the case activity log.">
                <div className="grid gap-3 sm:grid-cols-2">
                  <TextField label="Priority">
                    <select className={inputClass} disabled={busy} value={report.priority || 'medium'} onChange={(event) => changePriority(event.target.value)}>
                      {priorities.map((value) => <option key={value} value={value}>{value}</option>)}
                    </select>
                  </TextField>
                  <TextField label="Status">
                    <select className={inputClass} disabled={busy} value={report.status} onChange={(event) => changeStatus(event.target.value)}>
                      {reportStatuses.map((value) => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}
                    </select>
                  </TextField>
                </div>
              </Panel>
            )}

            {tab === 'dispatch' && (
              canManage ? (
                <CaseAssignmentPanel report={report} staff={staff} onChanged={() => { load(); onChanged?.(); }} />
              ) : (
                <EmptyPanel title="Dispatch is managed by department officers" message="You can see the current assignment but cannot change it from this role." />
              )
            )}

            {tab === 'messages' && <CaseConversation report={report} onPosted={() => { load(); onChanged?.(); }} />}

            {tab === 'activity' && <CaseTimeline report={report} />}
          </div>
        ) : (
          <EmptyPanel title="Case not available" message="This case could not be loaded or is outside your department scope." />
        )}
      </Drawer>

      {dialog === 'escalate' && <EscalateModal report={report} onClose={() => setDialog(null)} onDone={afterDialog} />}
      {dialog === 'resolve' && <ResolveEscalationModal report={report} onClose={() => setDialog(null)} onResolved={afterDialog} />}
      {dialog === 'handover' && <HandoverModal report={report} staff={staff} onClose={() => setDialog(null)} onDone={afterDialog} />}
      {dialog === 'review' && <ReviewCompletionModal report={report} onClose={() => setDialog(null)} onDone={afterDialog} />}
    </>
  );
}

