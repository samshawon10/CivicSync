import { useCallback, useEffect, useState } from 'react';
import { Users, PlayCircle, RefreshCw, X } from 'lucide-react';
import { departmentApi } from '../../services/departmentService.js';
import { apiMessage } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { showSuccess, showError } from '../../utils/sweetAlert.js';
import { OpsError, Pill, TextField, inputClass, primaryButton, secondaryButton, StatusPill } from './DepartmentOpsUI.jsx';
import {
  PROGRESS_KIND_LABELS, canStaffTasks
} from './workflowLabels.js';

export default function TaskOperationsPanel({ caseId, task, onChanged }) {
  const { user } = useAuth();
  const role = user?.role || 'officer';
  const mayStaff = canStaffTasks(role);

  const taskId = task?._id || '';
  const taskTeamId = task?.team?._id || task?.team || '';
  const [teams, setTeams] = useState([]);
  const [updates, setUpdates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [teamId, setTeamId] = useState('');
  const [draft, setDraft] = useState({ title: '', description: '', priority: 'medium', targetDueAt: '' });
  const availableTeams = teams.filter((team) =>
    String(team.leader?._id || team.leader) === String(user?._id || user?.id)
    && (!taskTeamId || String(team._id) === String(taskTeamId))
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const teamRes = await departmentApi.teams();
      setTeams(teamRes.data.teams || []);
      if (taskId) {
        const { data } = await departmentApi.taskUpdates(taskId);
        setUpdates(data.updates || []);
      }
    } catch (err) {
      setError(apiMessage(err));
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => { load(); }, [load]);

  async function run(action, successMessage) {
    setBusy(true);
    setError('');
    try {
      const { data } = await action();
      showSuccess('Field task updated', data.message || successMessage);
      setTeamId('');
      await load();
      onChanged?.();
    } catch (err) {
      const message = apiMessage(err);
      setError(message);
      showError('Unable to update field task', message);
    } finally {
      setBusy(false);
    }
  }

  async function createTask() {
    await run(() => departmentApi.createTask({
      reportId: caseId,
      title: draft.title.trim() || undefined,
      description: draft.description.trim() || undefined,
      priority: draft.priority,
      targetDueAt: draft.targetDueAt || undefined
    }), 'Operational task created.');
  }

  if (!taskId) {
    return (
      <div className="space-y-3">
        <OpsError message={error} />
        {(mayStaff || role === 'department_officer' || role === 'department_head') && (
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField label="Task title">
              <input className={inputClass} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="Defaults to the case title" maxLength={180} />
            </TextField>
            <TextField label="Priority">
              <select className={inputClass} value={draft.priority} onChange={(event) => setDraft({ ...draft, priority: event.target.value })}>
                {['low', 'medium', 'high', 'urgent'].map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </TextField>
            <TextField label="Task description">
              <textarea className={inputClass} rows={2} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="Defaults to the case description" maxLength={2000} />
            </TextField>
            <TextField label="SLA / due date">
              <input type="datetime-local" className={inputClass} value={draft.targetDueAt} onChange={(event) => setDraft({ ...draft, targetDueAt: event.target.value })} />
            </TextField>
          </div>
        )}
        <p className="text-sm text-slate-600">
          No operational task yet. {mayStaff ? 'Create one to start field work on this case.' : 'The assigned Team Leader creates the operational task when the case reaches this stage.'}
        </p>
        {mayStaff && ['pending', 'assigned', 'team_formed'].includes(task.status) && (
          <button type="button" disabled={busy} onClick={createTask} className={primaryButton}>
            <PlayCircle size={15} className="mr-1 inline" /> Create field task
          </button>
        )}

      </div>
    );
  }

  return (
    <div className="space-y-4">
      <OpsError message={error} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-black text-ink">{task?.taskNumber || 'Task'}</span>
          <StatusPill value={task?.status} kind="task" />
          <Pill tone="info">{TASK_STATE_LABELS[task?.status] || task?.status}</Pill>
          {task?.progressPercent > 0 && <Pill tone="success">{task.progressPercent}% complete</Pill>}
        </div>
        <button type="button" onClick={load} className={secondaryButton}>
          <RefreshCw size={14} className="mr-1 inline" /> Refresh
        </button>
      </div>

      {mayStaff && (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-bold text-slate-600">
            Assign a response team to dispatch this task. Each team must have at least two active Field Workers.
          </p>
          {!task?.team && ['pending', 'assigned', 'team_formed'].includes(task?.status) && <TextField label="Response team" hint="The Team Leader's team is assigned as one operational unit.">
            <select className={inputClass} value={teamId} onChange={(event) => setTeamId(event.target.value)} disabled={loading}>
              <option value="">Select your team…</option>
              {availableTeams.map((team) => (
                <option key={team._id} value={team._id}>
                  {team.name} · {(team.members || []).length} members
                </option>
              ))}
            </select>
            {!availableTeams.length && <p className="mt-1 text-xs text-amber-700">{loading ? 'Loading your teams…' : 'No team led by you is available. Create or update a response team with at least two active Field Workers.'}</p>}
          </TextField>}
          {task?.team && <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm"><p className="font-bold text-ink">{task.team.name} · {task.team.members?.length || task.workerAssignments?.length || 0} members</p><p className="mt-1 text-xs text-slate-600">Assigned as a team; workers accept and update their own assignments.</p></div>}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || loading || !teamId || Boolean(task?.team)}
              onClick={() => run(() => departmentApi.attachTeam(taskId, teamId), 'Team attached and its members booked.')}
              className={primaryButton}
            >
              <Users size={15} className="mr-1 inline" /> Assign response team
            </button>
            {task?.team && ['pending', 'assigned', 'team_formed'].includes(task.status) && (
              <button
                type="button"
                disabled={busy}
                onClick={() => run(() => departmentApi.detachTeam(taskId), 'Team detached and its workers released.')}
                className={secondaryButton}
              >
                <X size={15} className="mr-1 inline" /> Detach team
              </button>
            )}

          </div>
        </div>
      )}

      {(task?.team || task?.workerAssignments?.length > 0) && (
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-sm font-black text-ink">
            {task.team?.name || 'Individual assignments'} · {task.teamLeader?.name || 'Team Leader'}
          </p>
          <ul className="mt-2 space-y-2">
            {(task.workerAssignments || []).map((assignment) => (
              <li key={assignment.worker?._id || assignment.worker} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="font-semibold">{assignment.worker?.name || 'Worker'}</span>
                <span className="text-xs text-slate-600">{assignment.status.replaceAll('_', ' ')} · {assignment.progressPercent}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h4 className="text-sm font-black text-ink">Field progress</h4>
        {loading && <div className="mt-2 h-16 animate-pulse rounded-xl bg-slate-100" />}
        {!loading && !updates.length && (
          <p className="mt-2 rounded-lg border border-dashed border-slate-300 p-3 text-sm text-slate-500">
            No progress reported yet.
          </p>
        )}
        <ul className="mt-2 space-y-2">
          {updates.map((update) => (
            <li key={update._id} className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-ink">
                  {PROGRESS_KIND_LABELS[update.kind] || update.kind}
                  {update.progressPercent != null ? ` · ${update.progressPercent}%` : ''}
                </span>
                <span className="text-xs text-slate-500">{update.worker?.name}</span>
              </div>
              {update.note && <p className="mt-1 text-slate-600">{update.note}</p>}
              {update.blocker?.resourceNeeded && (
                <p className="mt-1 text-xs text-amber-700">Needs: {update.blocker.resourceNeeded}</p>
              )}
              {!!(update.evidence || []).length && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {update.evidence.map((item) => (
                    <img key={item.url} src={item.url} alt="Field evidence" className="h-16 w-16 rounded-lg object-cover" />
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
