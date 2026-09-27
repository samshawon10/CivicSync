import { useCallback, useEffect, useState } from 'react';
import { UserPlus, Users, PlayCircle, CheckCircle2, AlertTriangle, RefreshCw, X } from 'lucide-react';
import { departmentApi } from '../../services/departmentService.js';
import { apiMessage } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { showSuccess, showError } from '../../utils/sweetAlert.js';
import { OpsError, Pill, TextField, inputClass, primaryButton, secondaryButton, StatusPill } from './DepartmentOpsUI.jsx';
import {
  AVAILABILITY_LABELS, PROGRESS_KIND_LABELS, TASK_STATE_LABELS, canStaffTasks
} from './workflowLabels.js';

export default function TaskOperationsPanel({ caseId, task, onChanged }) {
  const { user } = useAuth();
  const role = user?.role || 'officer';
  const mayStaff = canStaffTasks(role);

  const taskId = task?._id || '';
  const [workers, setWorkers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [updates, setUpdates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [workerId, setWorkerId] = useState('');
  const [teamId, setTeamId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [workerRes, teamRes] = await Promise.all([
        departmentApi.availableWorkers(),
        departmentApi.teams()
      ]);
      setWorkers(workerRes.data.workers || []);
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

  async function createTask() {
    await run(() => departmentApi.createTask({ reportId: caseId }), 'Operational task created. Staff it with available workers.');
  }

  if (!taskId) {
    return (
      <div className="space-y-3">
        <OpsError message={error} />
        <p className="text-sm text-slate-600">
          No operational task yet. {mayStaff || role === 'department_officer' || role === 'department_head'
            ? 'Create one to start field work on this case.'
            : 'The Officer assigned to this case will create it.'}
        </p>
        {(mayStaff || role === 'department_officer') && (
          <button type="button" disabled={busy} onClick={createTask} className={primaryButton}>
            <PlayCircle size={15} className="mr-1 inline" /> Create field task
          </button>
        )}
      </div>
    );
  }

  const bookedIds = new Set(
    [task?.assignedWorker?._id, ...(task?.workerIds || []).map((worker) => worker?._id || worker)]
      .filter(Boolean).map(String)
  );

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
            Staffing — you own this task, so worker and team assignment is yours.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <TextField label="Assign an available worker">
              <select className={inputClass} value={workerId} onChange={(event) => setWorkerId(event.target.value)}>
                <option value="">Select a worker…</option>
                {workers.map((worker) => (
                  <option key={worker._id} value={worker._id} disabled={worker.availability !== 'available' || bookedIds.has(String(worker._id))}>
                    {worker.name} · {AVAILABILITY_LABELS[worker.availability]}
                    {bookedIds.has(String(worker._id)) ? ' · already on task' : ''}
                  </option>
                ))}
              </select>
            </TextField>
            <TextField label="Or attach a team" hint="Normal teams are built for this task; roster teams are standing.">
              <select className={inputClass} value={teamId} onChange={(event) => setTeamId(event.target.value)}>
                <option value="">Select a team…</option>
                {teams.map((team) => (
                  <option key={team._id} value={team._id}>
                    {team.name} · {team.type || 'normal'} · {(team.members || []).length} members
                  </option>
                ))}
              </select>
            </TextField>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || !workerId}
              onClick={() => run(() => departmentApi.assignWorker(taskId, workerId), 'Worker assigned and marked busy.')}
              className={primaryButton}
            >
              <UserPlus size={15} className="mr-1 inline" /> Assign worker
            </button>
            <button
              type="button"
              disabled={busy || !teamId}
              onClick={() => run(() => departmentApi.attachTeam(taskId, teamId), 'Team attached and its members booked.')}
              className={secondaryButton}
            >
              <Users size={15} className="mr-1 inline" /> Attach team
            </button>
            {task?.team && (
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

      <div className="flex flex-wrap gap-2">
        {['accepted', 'in_progress', 'completed'].map((status) => (
          <button
            key={status}
            type="button"
            disabled={busy}
            onClick={() => run(() => departmentApi.transitionTask(taskId, { status }), `Task moved to ${TASK_STATE_LABELS[status] || status}.`)}
            className={secondaryButton}
          >
            {status === 'completed'
              ? <CheckCircle2 size={14} className="mr-1 inline" />
              : <PlayCircle size={14} className="mr-1 inline" />}
            {TASK_STATE_LABELS[status]}
          </button>
        ))}
        <button
          type="button"
          disabled={busy}
          onClick={() => run(() => departmentApi.transitionTask(taskId, { status: 'blocked', reason: 'Reported from the field' }), 'Task marked blocked.')}
          className={secondaryButton}
        >
          <AlertTriangle size={14} className="mr-1 inline" /> Blocked
        </button>
      </div>

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
