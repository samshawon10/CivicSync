import { useEffect, useState } from 'react';
import { UserCheck, ArrowRight, ShieldCheck, Wrench } from 'lucide-react';
import { departmentApi } from '../../services/departmentService.js';
import { apiMessage } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { showSuccess, showError } from '../../utils/sweetAlert.js';
import { OpsError, TextField, inputClass, primaryButton } from './DepartmentOpsUI.jsx';
import { STAGE_LABELS, canAssignCase } from './workflowLabels.js';

export default function CaseAssignmentPanel({ report, staff, onChanged }) {
  const { user } = useAuth();
  const role = user?.role || 'officer';
  const canAssign = canAssignCase(role);
  const isHead = role === 'department_head';

  const people = Array.isArray(staff) ? staff : [];
  const [departmentOfficerId, setDepartmentOfficerId] = useState(report.assignedDepartmentOfficer?._id || '');
  const [officerId, setOfficerId] = useState(report.assignedOfficer?._id || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const departmentOfficers = people.filter((person) => person.role === 'department_officer');
  const officers = people.filter((person) => person.role === 'officer');

  useEffect(() => {
    setDepartmentOfficerId(report.assignedDepartmentOfficer?._id || '');
    setOfficerId(report.assignedOfficer?._id || '');
  }, [report.assignedDepartmentOfficer?._id, report.assignedOfficer?._id]);

  async function assign(field, targetId, applyValue) {
    if (!targetId) { setError('Choose someone to assign first.'); return; }
    setBusy(true); setError('');
    try {
      const { data } = await departmentApi.assign(report._id, { [field]: targetId });
      applyValue(targetId);
      showSuccess('Case assigned', data.message || 'The hand-off is recorded and the next person has been notified.');
      onChanged?.();
    } catch (err) {
      const message = apiMessage(err);
      setError(message); showError('Unable to assign', message);
    } finally { setBusy(false); }
  }

  if (!canAssign) {
    return (
      <div className="space-y-3">
        <OpsError message={error} />
        <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          <ShieldCheck size={14} className="mr-1 inline text-civic-600" aria-hidden="true" />
          {role === 'officer'
            ? 'You own this case. Field workers and teams are assigned to the task, not the case.'
            : 'Case routing is handled by the Department Head and Department Officer.'}
        </p>
        {report.workflowStage && (
          <p className="text-xs text-slate-500">Current stage: {STAGE_LABELS[report.workflowStage] || report.workflowStage}</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <OpsError message={error} />

      {isHead ? (
        <div className="space-y-2">
          <TextField label="Assign to Department Officer" hint="You route the case to a Department Officer. You do not place workers yourself.">
            <select className={inputClass} value={departmentOfficerId} onChange={(event) => setDepartmentOfficerId(event.target.value)}>
              <option value="">Unassigned</option>
              {departmentOfficers.map((person) => (
                <option key={person.id || person._id} value={person.id || person._id}>
                  {person.name} · {person.workload ?? 0} active
                </option>
              ))}
            </select>
          </TextField>
          <button
            type="button"
            disabled={busy || !departmentOfficerId}
            onClick={() => assign('departmentOfficerId', departmentOfficerId, setDepartmentOfficerId)}
            className={primaryButton}
          >
            <UserCheck size={15} className="mr-1 inline" /> {busy ? 'Assigning…' : 'Assign Department Officer'}
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <TextField label="Assign to Officer" hint="The Officer staffs the task and picks the workers. You do not assign workers directly.">
            <select className={inputClass} value={officerId} onChange={(event) => setOfficerId(event.target.value)}>
              <option value="">Unassigned</option>
              {officers.map((person) => (
                <option key={person.id || person._id} value={person.id || person._id}>
                  {person.name} · {person.workload ?? 0} active
                </option>
              ))}
            </select>
          </TextField>
          <button
            type="button"
            disabled={busy || !officerId}
            onClick={() => assign('officerId', officerId, setOfficerId)}
            className={primaryButton}
          >
            <UserCheck size={15} className="mr-1 inline" /> {busy ? 'Assigning…' : 'Assign Officer'}
          </button>
        </div>
      )}

      {/* Chain of custody: always obvious who currently holds the case. */}
      <ol className="space-y-1.5 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
        <li className="font-black text-ink">Chain of custody</li>
        <li className="flex flex-wrap items-center gap-2">
          <span>1. Department Head</span>
          <ArrowRight size={12} aria-hidden="true" />
          <span className="font-semibold">{report.assignedDepartmentOfficer?.name || '— awaiting hand-off —'}</span>
        </li>
        <li className="flex flex-wrap items-center gap-2">
          <span>2. Department Officer</span>
          <ArrowRight size={12} aria-hidden="true" />
          <span className="font-semibold">{report.assignedOfficer?.name || '— awaiting hand-off —'}</span>
        </li>
        <li className="flex flex-wrap items-center gap-2">
          <span>3. Officer</span>
          <ArrowRight size={12} aria-hidden="true" />
          <Wrench size={12} aria-hidden="true" />
          <span className="font-semibold">assigns workers on the task</span>
        </li>
      </ol>
    </div>
  );
}
