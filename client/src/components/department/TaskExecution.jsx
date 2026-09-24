import { useCallback, useEffect, useMemo, useState } from 'react';
import { ClipboardList, MapPin, Clock, RefreshCw, ArrowRight, User } from 'lucide-react';
import { departmentApi } from '../../services/departmentService.js';
import { apiMessage } from '../../services/api.js';
import { showSuccess, showError } from '../../utils/sweetAlert.js';
import {
  Panel,
  StatusPill,
  PriorityPill,
  EmptyPanel,
  OpsError,
  StatTile,
  secondaryButton,
  primaryButton,
  formatOpsDate,
  inputClass
} from './DepartmentOpsUI.jsx';
import TaskActionModal from './TaskActionModal.jsx';
import useDepartmentSync from './useDepartmentSync.js';
import { taskTransitions, taskStatusFilters, transitionLabel, transitionDialog, taskProgressSteps, progressIndex } from './taskWorkflow.js';

function TaskProgress({ status }) {
  const current = progressIndex(status);
  const isTerminalBad = ['blocked', 'rejected', 'cancelled', 'paused'].includes(status);
  return (
    <ol className="flex flex-wrap items-center gap-1" aria-label={`Task progress: ${status.replaceAll('_', ' ')}`}>
      {taskProgressSteps.map((step, index) => (
        <li key={step}>
          <span
            title={step.replaceAll('_', ' ')}
            className={`block h-1.5 w-6 rounded-full ${isTerminalBad ? 'bg-slate-200' : index <= current ? 'bg-civic-600' : 'bg-slate-200'}`}
          />
        </li>
      ))}
    </ol>
  );
}

function EvidenceList({ urls = [] }) {
  if (!urls.length) return null;
  return (
    <ul className="mt-2 flex flex-wrap gap-2">
      {urls.map((url, index) => (
        <li key={`${url}-${index}`}>
          <a href={url} target="_blank" rel="noreferrer" className="rounded-lg border border-civic-200 bg-civic-50 px-2 py-1 text-[11px] font-bold text-civic-700 hover:underline">
            Evidence {index + 1}
          </a>
        </li>
      ))}
    </ul>
  );
}

function TaskCard({ task, canAct, busyTransition, onTransition, onOpenCase }) {
  const options = taskTransitions[task.status] || [];
  const report = task.report || {};
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-ink px-2 py-0.5 text-[11px] font-black text-white">{task.taskNumber || 'TASK'}</span>
            <PriorityPill value={task.priority} />
            <StatusPill value={task.status} kind="task" />
          </div>
          <h4 className="mt-2 font-black text-ink">{task.title}</h4>
          <p className="mt-0.5 text-sm text-slate-600">{task.description || report.title || 'No description provided.'}</p>
        </div>
        <TaskProgress status={task.status} />
      </div>

      <dl className="mt-3 grid gap-1.5 text-xs text-slate-600 sm:grid-cols-2">
        <div className="flex items-center gap-1.5"><Clock size={12} className="text-slate-400" aria-hidden="true" /><dd className="font-semibold">Due {formatOpsDate(task.targetDueAt || report.dueAt)}</dd></div>
        <div className="flex items-center gap-1.5"><MapPin size={12} className="text-slate-400" aria-hidden="true" /><dd className="truncate font-semibold">{task.location?.address || report.location?.address || 'Location not recorded'}</dd></div>
        <div className="flex items-center gap-1.5"><User size={12} className="text-slate-400" aria-hidden="true" /><dd className="truncate font-semibold">{task.assignedWorker?.name || 'Unassigned worker'}{task.team?.name ? ` · ${task.team.name}` : ''}</dd></div>
        <div className="flex items-center gap-1.5"><ClipboardList size={12} className="text-slate-400" aria-hidden="true" /><dd className="truncate font-semibold">Case: {report.title || 'Linked case'}</dd></div>
      </dl>

      {task.status === 'blocked' && task.blockedInfo?.reason && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-800">
          <p className="font-black uppercase tracking-wider">Blocked</p>
          <p className="mt-0.5 font-semibold">{task.blockedInfo.reason}</p>
          {task.blockedInfo.description && <p className="mt-0.5">{task.blockedInfo.description}</p>}
          {task.blockedInfo.resourceNeeded && <p className="mt-1 font-semibold">Needs: {task.blockedInfo.resourceNeeded}</p>}
        </div>
      )}

      {task.status === 'completed' && task.completion?.summary && (
        <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 text-xs text-emerald-800">
          <p className="font-black uppercase tracking-wider">Completion report</p>
          <p className="mt-0.5 font-semibold">{task.completion.summary}</p>
          {task.completion.materialsUsed && <p className="mt-0.5">Materials: {task.completion.materialsUsed}</p>}
          {task.completion.remainingIssues && <p className="mt-0.5">Remaining: {task.completion.remainingIssues}</p>}
          <EvidenceList urls={task.completion.evidenceUrls} />
        </div>
      )}

      {task.rejection?.reason && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800">
          <p className="font-black uppercase tracking-wider">Rejected</p>
          <p className="mt-0.5 font-semibold">{task.rejection.reason}</p>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {canAct && options.map((next) => (
          <button
            key={next}
            type="button"
            disabled={busyTransition === next}
            onClick={() => onTransition(task, next)}
            className={next === 'completed' ? primaryButton : secondaryButton}
          >
            {busyTransition === next ? 'Working…' : transitionLabel(task.status, next)}
          </button>
        ))}
        {!canAct && <span className="text-xs font-semibold text-slate-400">Read-only for your role</span>}
        {onOpenCase && (
          <button type="button" onClick={() => onOpenCase(report._id || task.report)} className="text-xs font-black text-civic-700 hover:underline">
            Open case workspace <ArrowRight size={12} className="inline" />
          </button>
        )}
      </div>
    </article>
  );
}

export default function TaskExecution({ role, onOpenCase }) {
  const canAct = ['field_worker', 'officer', 'department_officer', 'department_head'].includes(role);
  const [tasks, setTasks] = useState([]);
  const [filterId, setFilterId] = useState('active');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(null);
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { const { data } = await departmentApi.tasks(); setTasks(data.tasks || []); }
    catch (err) { setError(apiMessage(err)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  const live = useDepartmentSync(load);

  const counts = useMemo(() => ({
    active: tasks.filter((task) => ['assigned', 'accepted', 'traveling', 'arrived', 'in_progress'].includes(task.status)).length,
    blocked: tasks.filter((task) => task.status === 'blocked').length,
    completed: tasks.filter((task) => task.status === 'completed').length,
    overdue: tasks.filter((task) => task.targetDueAt && new Date(task.targetDueAt) < new Date() && !['completed', 'cancelled', 'rejected'].includes(task.status)).length
  }), [tasks]);

  const visible = useMemo(() => {
    const filter = taskStatusFilters.find((item) => item.id === filterId);
    const term = search.trim().toLowerCase();
    return tasks.filter((task) => {
      if (filter?.statuses && !filter.statuses.includes(task.status)) return false;
      if (!term) return true;
      return [task.title, task.description, task.taskNumber, task.report?.title, task.assignedWorker?.name]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [tasks, filterId, search]);

  async function runDirect(task, next) {
    setBusy(`${task._id}:${next}`);
    try {
      await departmentApi.updateTaskStatus(task._id, { status: next });
      showSuccess('Task updated', `${task.taskNumber || 'Task'} → ${next.replaceAll('_', ' ')}.`);
      await load();
    } catch (err) { showError('Unable to update task', apiMessage(err)); } finally { setBusy(''); }
  }

  function onTransition(task, next) {
    const kind = transitionDialog(next);
    if (kind) { setPending({ task, kind }); return; }
    runDirect(task, next);
  }

  async function submitPending(payload) {
    const task = pending.task;
    setBusy(`${task._id}:${payload.status}`);
    try {
      if (payload.status === 'completed') await departmentApi.completeTask(task._id, payload);
      else await departmentApi.updateTaskStatus(task._id, payload);
      showSuccess('Task updated', `${task.taskNumber || 'Task'} → ${payload.status.replaceAll('_', ' ')}.`);
      setPending(null);
      await load();
    } catch (err) {
      const message = apiMessage(err);
      showError('Unable to update task', message);
      setBusy('');
      throw new Error(message);
    }
    setBusy('');
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Active tasks" value={counts.active} icon={ClipboardList} hint={live ? 'Live sync on' : 'Reconnecting…'} />
        <StatTile label="Blocked" value={counts.blocked} tone={counts.blocked ? 'danger' : 'neutral'} hint="Awaiting officer intervention" />
        <StatTile label="Completed" value={counts.completed} tone="success" hint="Submitted with evidence" />
        <StatTile label="Past target date" value={counts.overdue} tone={counts.overdue ? 'warning' : 'neutral'} hint="Open tasks past their target" />
      </div>

      <Panel
        title={role === 'field_worker' ? 'My assigned field tasks' : 'Department field task board'}
        subtitle="Each task mirrors one operational case. Transitions follow the enforced field workflow."
        action={<button type="button" onClick={load} className={secondaryButton}><RefreshCw size={14} className="mr-1 inline" /> Refresh</button>}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-1.5">
            {taskStatusFilters.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setFilterId(item.id)}
                className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${filterId === item.id ? 'border-ink bg-ink text-white' : 'border-slate-300 bg-white text-slate-600 hover:border-civic-300'}`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <input
            aria-label="Search tasks"
            className={`${inputClass} sm:max-w-xs`}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search task, case or worker…"
          />
        </div>

        <div className="mt-4"><OpsError message={error} onRetry={load} /></div>

        {loading ? (
          <div className="mt-4 space-y-3">{[0, 1, 2].map((index) => <div key={index} className="h-32 animate-pulse rounded-xl bg-slate-100" />)}</div>
        ) : visible.length ? (
          <div className="mt-4 space-y-3">
            {visible.map((task) => (
              <TaskCard
                key={task._id}
                task={task}
                canAct={canAct}
                busyTransition={busy.startsWith(`${task._id}:`) ? busy.split(':')[1] : ''}
                onTransition={onTransition}
                onOpenCase={onOpenCase}
              />
            ))}
          </div>
        ) : (
          <div className="mt-4"><EmptyPanel title="No tasks in this view" message="Accept an assignment or switch filters to see other field work." /></div>
        )}
      </Panel>

      {pending && <TaskActionModal task={pending.task} kind={pending.kind} onClose={() => setPending(null)} onSubmit={submitPending} />}
    </div>
  );
}

