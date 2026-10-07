import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock3,
  MapPin,
  RefreshCw,
  Search,
  Users
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { apiMessage } from '../../services/api.js';
import { departmentApi } from '../../services/departmentService.js';
import { showError, showSuccess } from '../../utils/sweetAlert.js';
import { Modal } from '../../components/ui/Overlays.jsx';

const priorityRank = { urgent: 0, high: 1, medium: 2, low: 3 };
const workerStatusRank = { in_progress: 0, accepted: 1, assigned: 2, completed: 3 };

function display(value = '') {
  return String(value).replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value, options = { dateStyle: 'medium', timeStyle: 'short' }) {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not recorded' : date.toLocaleString([], options);
}

function assignmentFor(task, userId) {
  return task.workerAssignments?.find((assignment) =>
    String(assignment.worker?._id || assignment.worker) === String(userId)
  );
}

function workerStatus(task, userId) {
  if (['cancelled', 'rejected'].includes(task.status)) return task.status;
  const assignment = assignmentFor(task, userId);
  if (assignment) return assignment.status;
  if (task.status === 'in_progress') return 'in_progress';
  if (task.status === 'accepted') return 'accepted';
  return 'assigned';
}

function taskLabel(task, userId) {
  if (task.status === 'blocked') return 'Blocked';
  if (task.status === 'verified') return 'Verified';
  if (task.status === 'completed') return 'Awaiting Team Leader Verification';
  if (['paused', 'on_hold', 'cancelled', 'rejected'].includes(task.status)) return display(task.status);
  const status = workerStatus(task, userId);
  if (status === 'completed') return 'Awaiting Team Leader Verification';
  return display(status);
}

function priorityOf(task) {
  return task.priority || task.report?.priority || null;
}

function assignedAt(task) {
  const assigned = task.timeline?.find((entry) => ['assigned', 'team_formed'].includes(entry.status));
  return assigned?.timestamp || null;
}

function lastUpdated(task) {
  return task.updatedAt || task.timeline?.at(-1)?.timestamp;
}

function StatusBadge({ task, userId }) {
  const status = ['blocked', 'verified', 'completed', 'paused', 'on_hold', 'cancelled', 'rejected'].includes(task.status)
    ? task.status
    : workerStatus(task, userId);
  const tone = {
    assigned: 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200',
    accepted: 'border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-200',
    in_progress: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200',
    blocked: 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200',
    completed: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200',
    verified: 'border-cyan-200 bg-cyan-50 text-cyan-800 dark:border-cyan-900 dark:bg-cyan-950/40 dark:text-cyan-200',
    paused: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200',
    on_hold: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200',
    cancelled: 'border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300',
    rejected: 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200'
  }[status] || 'border-line bg-surface-2 text-fg-muted';
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${tone}`}>{taskLabel(task, userId)}</span>;
}

function PriorityBadge({ value }) {
  const tone = {
    urgent: 'bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-200',
    high: 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200',
    medium: 'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-200',
    low: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
  }[value] || 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200';
  return <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${tone}`}>{value ? display(value) : 'Priority not set'}</span>;
}

function ProgressBar({ value = 0 }) {
  const progress = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div className="flex items-center gap-3">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={progress} aria-label="Task progress">
        <span className="block h-full rounded-full bg-civic-600 transition-[width]" style={{ width: `${progress}%` }} />
      </div>
      <span className="w-10 text-right text-xs font-bold text-fg-muted">{progress}%</span>
    </div>
  );
}

function TaskCard({ task, userId, onOpen }) {
  const assignment = assignmentFor(task, userId);
  const progress = assignment?.progressPercent ?? task.progressPercent ?? 0;
  const address = task.location?.address || task.report?.location?.address || task.report?.location?.area;
  const leader = task.teamLeader?.name || task.team?.leader?.name;
  return (
    <article className="rounded-2xl border border-line bg-surface p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge task={task} userId={userId} />
            <PriorityBadge value={priorityOf(task)} />
            <span className="rounded-full border border-line px-2.5 py-1 text-xs font-semibold text-fg-muted">{display(task.report?.category || 'Category not recorded')}</span>
            <span className="text-xs font-semibold text-fg-muted">{task.taskNumber || 'Field task'}</span>
          </div>
          <h3 className="mt-3 text-lg font-black leading-snug text-fg">{task.title}</h3>
          <p className="mt-1 line-clamp-2 text-sm leading-6 text-fg-muted">{task.description || task.report?.title || 'No task description provided.'}</p>
        </div>
        <div className="w-full sm:w-36">
          <ProgressBar value={progress} />
        </div>
      </div>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div className="flex min-w-0 items-start gap-2 text-fg-muted">
          <ClipboardList size={16} className="mt-0.5 shrink-0 text-civic-700" aria-hidden="true" />
          <div className="min-w-0"><dt className="text-xs font-semibold">Related report</dt><dd className="truncate font-bold text-fg">{task.report?.title || 'Report details unavailable'}</dd><dd className="text-xs text-fg-muted">{task.masterReportCount || 1} citizen report{task.masterReportCount === 1 ? '' : 's'} linked</dd></div>
        </div>
        <div className="flex min-w-0 items-start gap-2 text-fg-muted">
          <MapPin size={16} className="mt-0.5 shrink-0 text-civic-700" aria-hidden="true" />
          <div className="min-w-0"><dt className="text-xs font-semibold">Location</dt><dd className="truncate font-bold text-fg">{address || 'Location not recorded'}</dd></div>
        </div>
        <div className="flex min-w-0 items-start gap-2 text-fg-muted">
          <Users size={16} className="mt-0.5 shrink-0 text-civic-700" aria-hidden="true" />
          <div className="min-w-0"><dt className="text-xs font-semibold">Response team</dt><dd className="truncate font-bold text-fg">{task.team?.name || 'Team not recorded'}</dd><dd className="truncate text-xs text-fg-muted">Team Leader: {leader || 'Not assigned'}</dd><dd className="truncate text-xs text-fg-muted">Members: {task.team?.members?.map((member) => member.name || 'Team member').join(', ') || 'Not recorded'}</dd></div>
        </div>
        <div className="flex min-w-0 items-start gap-2 text-fg-muted">
          <CalendarDays size={16} className="mt-0.5 shrink-0 text-civic-700" aria-hidden="true" />
          <div className="min-w-0"><dt className="text-xs font-semibold">Assigned</dt><dd className="truncate font-bold text-fg">{formatDate(assignedAt(task))}</dd></div>
        </div>
      </dl>
      {task.targetDueAt && <p className="mt-3 flex items-center gap-2 text-xs font-semibold text-fg-muted"><Clock3 size={14} aria-hidden="true" />Target date: {formatDate(task.targetDueAt, { dateStyle: 'medium' })}</p>}
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-3">
        <p className="truncate text-xs text-fg-muted">Last updated {formatDate(lastUpdated(task))}</p>
        <button type="button" onClick={() => onOpen(task)} className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-lg px-3 text-sm font-bold text-civic-700 transition hover:bg-civic-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-civic-600 dark:hover:bg-surface-2">
          View task <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>
    </article>
  );
}

function TaskSkeleton() {
  return <div className="space-y-3" aria-label="Loading assigned tasks">{[0, 1, 2].map((item) => <div key={item} className="h-52 animate-pulse rounded-2xl border border-line bg-surface-2" />)}</div>;
}

function StatsGrid({ stats, loading, showHints = false }) {
  return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{loading
    ? [0, 1, 2, 3].map((item) => <div key={item} className="h-28 animate-pulse rounded-xl border border-line bg-surface-2" />)
    : stats.map(([label, value, Icon]) => <article key={label} className="rounded-xl border border-line bg-surface p-4 shadow-sm"><div className="flex items-center justify-between"><p className="text-sm font-bold text-fg-muted">{label}</p><span className="grid h-9 w-9 place-items-center rounded-lg bg-civic-50 text-civic-700 dark:bg-civic-950/40 dark:text-civic-200"><Icon size={17} aria-hidden="true" /></span></div><p className="mt-4 text-3xl font-black text-fg">{value}</p>{showHints && <p className="mt-1 text-xs text-fg-muted">{label === 'Pending Updates' ? 'Assigned or accepted; next action is yours' : 'From your assigned task records'}</p>}</article>)}
  </div>;
}

function EmptyTasks({ filtered = false, status }) {
  const message = filtered
    ? 'Try another status or search term to find your assigned field work.'
    : status === 'verified'
      ? 'Team Leader-verified work will appear here after your field task has been reviewed.'
    : status === 'completed'
      ? 'Completed work will appear here after your team finishes its assigned tasks.'
      : 'Your assigned field work will appear here when your Team Leader dispatches a task.';
  return (
    <div className="rounded-2xl border border-dashed border-line bg-surface p-8 text-center sm:p-10">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-civic-50 text-civic-700 dark:bg-civic-950/40 dark:text-civic-200"><ClipboardList size={22} aria-hidden="true" /></span>
      <h3 className="mt-4 font-black text-fg">{filtered ? 'No tasks match this view' : status === 'verified' ? 'No verified tasks yet' : status === 'completed' ? 'No completed tasks yet' : 'No field tasks assigned yet'}</h3>
      <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-fg-muted">{message}</p>
    </div>
  );
}

function TeamPanel({ task, userId }) {
  if (!task?.team) {
    return <div className="rounded-2xl border border-dashed border-line bg-surface p-8 text-center"><Users className="mx-auto text-civic-700" size={24} aria-hidden="true" /><h3 className="mt-3 font-black text-fg">Team details are not available</h3><p className="mt-1 text-sm text-fg-muted">Your Team Leader and teammates will appear here when a response team is assigned.</p></div>;
  }
  const leader = task.teamLeader || task.team.leader;
  const members = task.team.members || [];
  return (
    <section className="rounded-2xl border border-line bg-surface p-5 shadow-sm sm:p-7">
      <div className="flex items-start gap-3">
        <span className="grid h-12 w-12 place-items-center rounded-xl bg-civic-50 text-civic-700 dark:bg-civic-950/40 dark:text-civic-200"><Users size={21} aria-hidden="true" /></span>
        <div><p className="text-xs font-bold uppercase tracking-wide text-civic-700">My response team</p><h2 className="mt-1 text-xl font-black text-fg">{task.team.name}</h2><p className="mt-1 text-sm text-fg-muted">{task.team.serviceArea || 'Department field operations'}</p></div>
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-line p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-fg-muted">Team Leader</p>
          <p className="mt-2 font-black text-fg">{leader?.name || 'Not assigned'}</p>
          {leader?.phone && <a className="mt-1 inline-block text-sm font-semibold text-civic-700 underline-offset-2 hover:underline" href={`tel:${leader.phone}`}>{leader.phone}</a>}
        </div>
        <div className="rounded-xl border border-line p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-fg-muted">Team members</p>
          {members.length ? <ul className="mt-2 divide-y divide-line">{members.map((member) => {
            const id = member._id || member;
            const you = String(id) === String(userId);
            return <li key={String(id)} className="flex items-center justify-between gap-3 py-2 first:pt-0"><span className="font-semibold text-fg">{member.name || 'Team member'}</span>{you && <span className="rounded-full bg-civic-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-civic-800 dark:bg-civic-950/60 dark:text-civic-200">You</span>}</li>;
          })}</ul> : <p className="mt-2 text-sm text-fg-muted">Member names are not available.</p>}
        </div>
      </div>
      <p className="mt-4 text-xs text-fg-muted">Team details are limited to information needed to coordinate this assignment.</p>
    </section>
  );
}

function TaskDetails({ task, updates, userId }) {
  const leader = task.teamLeader || task.team?.leader;
  const members = task.team?.members || [];
  const startedAt = task.timeline?.find((item) => item.status === 'in_progress')?.timestamp;
  const ownAssignment = assignmentFor(task, userId);
  const activity = [
    ...(task.timeline || []).map((item, index) => ({
      id: `status-${item._id || index}`,
      timestamp: item.timestamp,
      actor: item.actor?.name || display(item.actorRole || 'CivicSync'),
      text: item.note || display(item.status)
    })),
    ...updates.map((item) => ({
      id: `update-${item._id}`,
      timestamp: item.createdAt,
      actor: item.worker?.name || 'Field Worker',
      text: item.note || display(item.kind),
      progressPercent: item.progressPercent,
      kind: item.kind
    }))
  ].sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
  const address = task.location?.address || task.report?.location?.address || task.report?.location?.area;
  const progress = ownAssignment?.progressPercent ?? task.progressPercent ?? 0;
  return (
    <div className="grid gap-4 lg:grid-cols-[1.1fr_.9fr]">
      <div className="space-y-4">
        <section className="rounded-xl border border-line p-4">
          <div className="flex flex-wrap gap-2"><StatusBadge task={task} userId={userId} /><PriorityBadge value={priorityOf(task)} /></div>
          <p className="mt-4 text-sm leading-6 text-fg">{task.description || 'No task description provided.'}</p>
          {task.instructions && <div className="mt-3 rounded-lg bg-civic-50 p-3 text-sm leading-6 text-civic-950 dark:bg-civic-950/30 dark:text-civic-100"><p className="text-xs font-black uppercase tracking-wide">Field instructions</p><p className="mt-1">{task.instructions}</p></div>}
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div><dt className="text-xs font-semibold text-fg-muted">Related report</dt><dd className="mt-0.5 font-bold text-fg">{task.report?.title || 'Report details unavailable'}</dd></div>
            <div><dt className="text-xs font-semibold text-fg-muted">Category</dt><dd className="mt-0.5 font-bold text-fg">{display(task.report?.category || 'Not recorded')}</dd></div>
            <div><dt className="text-xs font-semibold text-fg-muted">Location</dt><dd className="mt-0.5 font-bold text-fg">{address || 'Location not recorded'}</dd></div>
            <div><dt className="text-xs font-semibold text-fg-muted">Assigned</dt><dd className="mt-0.5 font-bold text-fg">{formatDate(assignedAt(task))}</dd></div>
            <div><dt className="text-xs font-semibold text-fg-muted">Started at</dt><dd className="mt-0.5 font-bold text-fg">{formatDate(startedAt)}</dd></div>
            <div><dt className="text-xs font-semibold text-fg-muted">Last updated</dt><dd className="mt-0.5 font-bold text-fg">{formatDate(lastUpdated(task))}</dd></div>
            {task.targetDueAt && <div><dt className="text-xs font-semibold text-fg-muted">Target date</dt><dd className="mt-0.5 font-bold text-fg">{formatDate(task.targetDueAt)}</dd></div>}
          </dl>
          {task.status === 'blocked' && task.blockedInfo?.reason && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200"><p className="font-black">{task.blockedInfo.reason}</p><p className="mt-1">{task.blockedInfo.description}</p>{task.blockedInfo.resourceNeeded && <p className="mt-1 font-semibold">Needed: {task.blockedInfo.resourceNeeded}</p>}</div>}
          {(ownAssignment?.completionSummary || task.completion?.summary) && <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100"><p className="font-black">Completion note</p><p className="mt-1 leading-6">{ownAssignment?.completionSummary || task.completion.summary}</p></div>}
          <div className="mt-4"><p className="mb-2 text-xs font-bold text-fg-muted">Your progress</p><ProgressBar value={progress} /></div>
        </section>
        <section className="rounded-xl border border-line p-4">
          <h3 className="font-black text-fg">Team</h3>
          <p className="mt-2 text-sm text-fg-muted"><span className="font-semibold text-fg">{task.team?.name || 'Team not recorded'}</span>{leader?.name ? ` · Team Leader ${leader.name}` : ''}</p>
          {members.length > 0 && <ul className="mt-3 flex flex-wrap gap-2">{members.map((member) => {
            const id = member._id || member;
            return <li key={String(id)} className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-fg">{member.name || 'Team member'}{String(id) === String(userId) ? ' · YOU' : ''}</li>;
          })}</ul>}
          {leader?.phone && <a className="mt-3 inline-flex min-h-10 items-center text-sm font-bold text-civic-700 underline-offset-2 hover:underline" href={`tel:${leader.phone}`}>Contact Team Leader · {leader.phone}</a>}
        </section>
      </div>
      <section className="rounded-xl border border-line p-4">
        <h3 className="font-black text-fg">Activity and field updates</h3>
        {activity.length ? <ol className="mt-4 space-y-4">{activity.map((event) => <li key={event.id} className="grid grid-cols-[12px_1fr] gap-3"><span className="mt-1.5 h-2.5 w-2.5 rounded-full bg-civic-600 ring-4 ring-civic-100 dark:ring-civic-950" /><div className="min-w-0"><p className="text-sm font-semibold text-fg">{event.text}</p><p className="mt-1 text-xs text-fg-muted">{event.actor} · {formatDate(event.timestamp)}{event.progressPercent !== undefined ? ` · ${event.progressPercent}%` : ''}</p></div></li>)}</ol>
          : <p className="mt-3 text-sm text-fg-muted">Task assignment and field updates will appear here.</p>}
      </section>
    </div>
  );
}

function ActionDialog({ kind, task, userId, onClose, onSubmit, busy, error }) {
  const [draft, setDraft] = useState({ note: '', progressPercent: '', reason: '', description: '' });
  const title = {
    accept: 'Accept field task',
    start: 'Start field work',
    progress: 'Add field update',
    blocker: 'Report an operational blocker',
    complete: 'Complete field work'
  }[kind];
  const completion = kind === 'complete';
  const blocker = kind === 'blocker';
  const confirm = kind === 'accept' || kind === 'start';
  const submit = (event) => {
    event.preventDefault();
    const payload = {};
    if (kind === 'progress') {
      payload.kind = 'progress';
      payload.note = draft.note.trim();
      if (draft.progressPercent !== '') payload.progressPercent = Number(draft.progressPercent);
    } else if (blocker) {
      payload.kind = 'blocked';
      payload.reason = draft.reason.trim();
      payload.description = draft.description.trim();
      payload.note = draft.description.trim();
    } else if (completion) {
      payload.summary = draft.note.trim();
    }
    onSubmit(kind, payload);
  };
  return (
    <Modal
      open={Boolean(kind)}
      onClose={onClose}
      title={title}
      subtitle={task.title}
      size="md"
      footer={<><button type="button" onClick={onClose} disabled={busy} className="min-h-11 rounded-lg border border-line px-4 text-sm font-bold text-fg disabled:opacity-50">Cancel</button><button type="submit" form="field-worker-action" disabled={busy || (completion && draft.note.trim().length < 10) || (blocker && (!draft.reason || draft.description.trim().length < 3)) || ((kind === 'progress') && draft.note.trim().length < 3)} className="min-h-11 rounded-lg bg-civic-700 px-5 text-sm font-bold text-white transition hover:bg-civic-800 disabled:cursor-not-allowed disabled:opacity-50">{busy ? 'Saving…' : confirm ? (kind === 'accept' ? 'Accept Task' : 'Start Field Work') : completion ? 'Submit Completion' : blocker ? 'Report Blocker' : 'Save Update'}</button></>}
    >
      <form id="field-worker-action" onSubmit={submit} className="space-y-4">
        {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">{error}</p>}
        {confirm && <div className="rounded-xl bg-civic-50 p-4 text-sm leading-6 text-civic-950 dark:bg-civic-950/30 dark:text-civic-100">{kind === 'accept' ? 'Confirm that you can take responsibility for this assigned field task.' : 'Confirm that you are on site and ready to begin field work.'}</div>}
        {kind === 'progress' && <>
          <label className="block text-sm font-bold text-fg">Field update<textarea autoFocus rows={4} maxLength={1000} required minLength={3} value={draft.note} onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value }))} placeholder="Describe work completed, observations, or conditions on site." className="mt-2 w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-fg placeholder:text-fg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-civic-600" /></label>
          <label className="block text-sm font-bold text-fg">Progress percentage <span className="font-normal text-fg-muted">(optional)</span><input type="number" min={assignmentFor(task, userId)?.progressPercent || 0} max="100" step="1" inputMode="numeric" value={draft.progressPercent} onChange={(event) => setDraft((current) => ({ ...current, progressPercent: event.target.value }))} placeholder="e.g. 40" className="mt-2 min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-sm text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-civic-600" /></label>
        </>}
        {blocker && <>
          <label className="block text-sm font-bold text-fg">Blocker type<select required value={draft.reason} onChange={(event) => setDraft((current) => ({ ...current, reason: event.target.value }))} className="mt-2 min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-sm text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-civic-600"><option value="">Choose a blocker</option>{['Equipment unavailable', 'Access blocked', 'Additional materials required', 'Safety issue', 'Unable to locate site', 'Other'].map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <label className="block text-sm font-bold text-fg">Description<textarea required minLength={3} maxLength={1000} rows={4} value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} placeholder="Explain what is preventing the work from continuing." className="mt-2 w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-fg placeholder:text-fg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-civic-600" /></label>
        </>}
        {completion && <label className="block text-sm font-bold text-fg">Completion note<textarea autoFocus required minLength={10} maxLength={1200} rows={5} value={draft.note} onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value }))} placeholder="Describe the field work completed and its outcome." className="mt-2 w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-fg placeholder:text-fg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-civic-600" /><span className="mt-1 block text-xs font-normal text-fg-muted">At least 10 characters. The Team Leader will review this work before the case moves forward.</span></label>}
      </form>
    </Modal>
  );
}

export default function FieldWorkerDashboard({ view, setView, live, refreshVersion }) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState(null);
  const [updates, setUpdates] = useState([]);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [action, setAction] = useState('');
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError('');
    try {
      const { data } = await departmentApi.tasks();
      setTasks(data.tasks || []);
    } catch (err) {
      setError(apiMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (refreshVersion > 0) load(true);
  }, [refreshVersion, load]);

  const sortedTasks = useMemo(() => [...tasks].sort((a, b) => {
    const aStatus = workerStatus(a, user.id);
    const bStatus = workerStatus(b, user.id);
    const aRank = a.status === 'blocked' ? -1 : workerStatusRank[aStatus] ?? 4;
    const bRank = b.status === 'blocked' ? -1 : workerStatusRank[bStatus] ?? 4;
    return aRank - bRank
      || (priorityRank[priorityOf(a)] ?? 5) - (priorityRank[priorityOf(b)] ?? 5)
      || new Date(a.targetDueAt || '9999-12-31') - new Date(b.targetDueAt || '9999-12-31');
  }), [tasks, user.id]);

  const counts = useMemo(() => {
    const statuses = tasks.map((task) => workerStatus(task, user.id));
    return {
      assigned: tasks.length,
      active: statuses.filter((status) => ['accepted', 'in_progress'].includes(status)).length,
      completed: statuses.filter((status) => status === 'completed').length,
      pendingUpdates: statuses.filter((status) => ['assigned', 'accepted'].includes(status)).length
    };
  }, [tasks, user.id]);

  const visibleTasks = useMemo(() => {
    const term = search.trim().toLowerCase();
    return sortedTasks.filter((task) => {
      const status = workerStatus(task, user.id);
      if (filter === 'verified' && task.status !== 'verified') return false;
      if (filter === 'completed' && (status !== 'completed' || task.status === 'verified')) return false;
      if (['assigned', 'accepted', 'in_progress'].includes(filter) && status !== filter) return false;
      if (!term) return true;
      return [
        task.title,
        task.description,
        task.taskNumber,
        task.report?.title,
        task.report?.category,
        task.location?.address,
        task.report?.location?.address,
        task.report?.location?.area
      ].filter(Boolean).some((value) => String(value).toLowerCase().includes(term));
    });
  }, [sortedTasks, user.id, filter, search]);

  const teamTask = sortedTasks.find((task) => task.team && !['cancelled', 'rejected'].includes(task.status)) || null;
  const priorityTask = sortedTasks.find((task) => !['completed', 'verified', 'cancelled', 'rejected'].includes(task.status)
    && workerStatus(task, user.id) !== 'completed') || null;

  async function openDetails(task) {
    setSelected(task);
    setUpdates([]);
    setDetailsLoading(true);
    setActionError('');
    try {
      const [taskResult, updateResult] = await Promise.all([
        departmentApi.task(task._id),
        departmentApi.taskUpdates(task._id)
      ]);
      setSelected(taskResult.data.task);
      setUpdates(updateResult.data.updates || []);
    } catch (err) {
      setActionError(apiMessage(err));
    } finally {
      setDetailsLoading(false);
    }
  }

  async function submitAction(kind, payload) {
    if (!selected || busy) return;
    setBusy(true);
    setActionError('');
    try {
      if (kind === 'accept') await departmentApi.transitionTask(selected._id, { status: 'accepted' });
      else if (kind === 'start') await departmentApi.transitionTask(selected._id, { status: 'in_progress' });
      else if (kind === 'progress' || kind === 'blocker') await departmentApi.taskProgress(selected._id, payload);
      else if (kind === 'complete') await departmentApi.completeTask(selected._id, payload);

      const taskId = selected._id;
      const [taskResult, updateResult] = await Promise.all([
        departmentApi.task(taskId),
        departmentApi.taskUpdates(taskId)
      ]);
      setSelected(taskResult.data.task);
      setUpdates(updateResult.data.updates || []);
      setTasks((current) => current.map((task) => task._id === taskId ? taskResult.data.task : task));
      setAction('');
      showSuccess('Field task updated', kind === 'complete' ? 'Your completion note was submitted for Team Leader verification.' : 'Your task update has been recorded.');
    } catch (err) {
      const message = apiMessage(err);
      setActionError(message);
      showError('Unable to update field task', message);
    } finally {
      setBusy(false);
    }
  }

  function availableActions(task) {
    const status = workerStatus(task, user.id);
    if (['completed', 'verified', 'blocked', 'paused', 'on_hold', 'cancelled', 'rejected'].includes(task.status)) return [];
    if (task.status === 'blocked') return [];
    if (status === 'assigned') return ['accept'];
    if (status === 'accepted') return ['start'];
    if (status === 'in_progress' && task.status === 'in_progress') return ['progress', 'blocker', 'complete'];
    return [];
  }

  const actions = selected ? availableActions(selected) : [];
  const actionButtons = (task) => {
    const available = availableActions(task);
    if (task.status === 'verified') return <span className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-cyan-50 px-3 text-sm font-bold text-cyan-800 dark:bg-cyan-950/30 dark:text-cyan-200"><CheckCircle2 size={16} />Team Leader verified</span>;
    if (task.status === 'completed' || workerStatus(task, user.id) === 'completed') return <span className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-emerald-50 px-3 text-sm font-bold text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200"><Check size={16} />Awaiting Team Leader Verification</span>;
    if (task.status === 'blocked') return <span className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-red-50 px-3 text-sm font-bold text-red-800 dark:bg-red-950/30 dark:text-red-200"><AlertTriangle size={16} />Waiting for Team Leader support</span>;
    return available.map((kind) => <button key={kind} type="button" onClick={() => { setActionError(''); setAction(kind); }} className={`min-h-11 rounded-lg px-4 text-sm font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-civic-600 ${kind === 'complete' ? 'bg-emerald-700 text-white hover:bg-emerald-800' : kind === 'blocker' ? 'border border-red-200 text-red-800 hover:bg-red-50 dark:border-red-900 dark:text-red-200 dark:hover:bg-red-950/30' : 'bg-civic-700 text-white hover:bg-civic-800'}`}>
      {kind === 'accept' ? 'Accept Task' : kind === 'start' ? 'Start Field Work' : kind === 'progress' ? 'Update Progress' : kind === 'blocker' ? 'Report Blocker' : 'Complete Field Work'}
    </button>);
  };

  const stats = [
    ['Assigned Tasks', counts.assigned, ClipboardList],
    ['Active Tasks', counts.active, Clock3],
    ['Completed Tasks', counts.completed, CheckCircle2],
    ['Pending Updates', counts.pendingUpdates, RefreshCw]
  ];

  if (view === 'team') {
    return <div className="space-y-5"><header><p className="text-sm font-bold text-civic-700">Your field unit</p><h2 className="mt-1 text-2xl font-black text-fg">My Team</h2><p className="mt-1 text-sm text-fg-muted">Team and Team Leader details for your current assigned work.</p></header>{loading ? <div className="h-48 animate-pulse rounded-2xl bg-surface-2" /> : <TeamPanel task={teamTask} userId={user.id} />}</div>;
  }

  if (view === 'tasks') {
    return (
      <div className="space-y-5">
        <header className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm font-bold text-civic-700">Your assignments</p><h2 className="mt-1 text-2xl font-black text-fg">My Field Tasks</h2><p className="mt-1 text-sm text-fg-muted">Tasks assigned to you through your response team.</p></div><button type="button" onClick={() => load()} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-line bg-surface px-3 text-sm font-bold text-fg"><RefreshCw size={15} /> Refresh</button></header>
        <StatsGrid stats={stats} loading={loading} />
        <section className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <label className="relative block"><span className="sr-only">Search assigned tasks</span><Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted" aria-hidden="true" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search title, location, category…" className="min-h-11 w-full rounded-lg border border-line bg-surface pl-10 pr-3 text-sm text-fg placeholder:text-fg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-civic-600" /></label>
            <label className="flex items-center gap-2 text-sm font-semibold text-fg-muted">Status<select value={filter} onChange={(event) => setFilter(event.target.value)} className="min-h-11 rounded-lg border border-line bg-surface px-3 text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-civic-600"><option value="all">All tasks</option><option value="assigned">Assigned</option><option value="accepted">Accepted</option><option value="in_progress">In Progress</option><option value="completed">Completed</option><option value="verified">Verified</option></select></label>
          </div>
          {error && <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200"><p>{error}</p><button type="button" onClick={() => load()} className="mt-2 font-bold underline">Try again</button></div>}
          <div className="mt-4">{loading ? <TaskSkeleton /> : visibleTasks.length ? <div className="space-y-3">{visibleTasks.map((task) => <TaskCard key={task._id} task={task} userId={user.id} onOpen={openDetails} />)}</div> : <EmptyTasks filtered={Boolean(search.trim()) || (!['all', 'completed', 'verified'].includes(filter) && tasks.length > 0)} status={filter} />}</div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-2xl bg-ink p-5 text-white sm:p-7">
        <div className="pointer-events-none absolute -right-12 -top-20 h-64 w-64 rounded-full border border-civic-300/20" />
        <div className="pointer-events-none absolute -right-2 -top-10 h-44 w-44 rounded-full border border-civic-300/15" />
        <p className="text-sm font-semibold text-civic-200">Field operations · {user.departmentName || 'Your department'}</p>
        <h2 className="mt-2 text-2xl font-black sm:text-3xl">What do you need to do today, {user.name?.split(' ')[0] || 'there'}?</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Your assigned team tasks, field updates, and next steps are all in one place.</p>
        <span className={`mt-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold ${live ? 'border-emerald-300/30 bg-emerald-400/10 text-emerald-100' : 'border-white/15 bg-white/5 text-slate-200'}`} role="status" aria-live="polite"><span className={`h-2 w-2 rounded-full ${live ? 'bg-emerald-400' : 'bg-amber-300'}`} />{live ? 'Live task updates' : 'Reconnecting to task updates'}</span>
      </section>
      <section aria-label="Field task summary"><StatsGrid stats={stats} loading={loading} showHints /></section>
      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200"><p>{error}</p><button type="button" onClick={() => load()} className="mt-2 font-bold underline">Retry loading field tasks</button></div>}
      <section>
        <div className="mb-3 flex items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-civic-700">Priority work</p><h3 className="mt-1 text-xl font-black text-fg">Today's Work</h3></div><button type="button" onClick={() => setView('tasks')} className="min-h-10 text-sm font-bold text-civic-700 hover:underline">All tasks <ChevronRight size={15} className="inline" /></button></div>
        {loading ? <TaskSkeleton /> : priorityTask ? <TaskCard task={priorityTask} userId={user.id} onOpen={openDetails} /> : <EmptyTasks />}
      </section>
      <div className="grid gap-5 xl:grid-cols-[1.3fr_.7fr]">
        <section className="min-w-0"><div className="mb-3 flex items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-civic-700">Your queue</p><h3 className="mt-1 text-xl font-black text-fg">Recent Field Tasks</h3></div><button type="button" onClick={() => setView('tasks')} className="min-h-10 text-sm font-bold text-civic-700 hover:underline">View all</button></div>{loading ? <TaskSkeleton /> : sortedTasks.length ? <div className="space-y-3">{sortedTasks.slice(0, 3).map((task) => <TaskCard key={task._id} task={task} userId={user.id} onOpen={openDetails} />)}</div> : <EmptyTasks />}</section>
        <div className="space-y-5"><section><div className="mb-3 flex items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-civic-700">Field unit</p><h3 className="mt-1 text-xl font-black text-fg">My Team</h3></div><button type="button" onClick={() => setView('team')} className="min-h-10 text-sm font-bold text-civic-700 hover:underline">Details <ChevronRight size={15} className="inline" /></button></div>{loading ? <div className="h-36 animate-pulse rounded-xl bg-surface-2" /> : <TeamPanel task={teamTask} userId={user.id} />}</section>
          <section className="rounded-xl border border-line bg-surface p-4"><h3 className="font-black text-fg">Recent activity</h3>{sortedTasks.length ? <ul className="mt-3 divide-y divide-line">{sortedTasks.slice(0, 4).map((task) => <li key={task._id} className="py-3 first:pt-0 last:pb-0"><p className="text-sm font-semibold text-fg">{task.title}</p><p className="mt-1 text-xs text-fg-muted">{taskLabel(task, user.id)} · {formatDate(lastUpdated(task))}</p></li>)}</ul> : <p className="mt-2 text-sm text-fg-muted">Task assignments and field updates will appear here.</p>}</section>
        </div>
      </div>
      <section><div className="mb-3"><p className="text-xs font-bold uppercase tracking-wide text-civic-700">Work history</p><h3 className="mt-1 text-xl font-black text-fg">Completed Work</h3></div>{loading ? <div className="h-28 animate-pulse rounded-xl bg-surface-2" /> : counts.completed ? <div className="grid gap-3 md:grid-cols-2">{sortedTasks.filter((task) => workerStatus(task, user.id) === 'completed').slice(0, 4).map((task) => <TaskCard key={task._id} task={task} userId={user.id} onOpen={openDetails} />)}</div> : <EmptyTasks status="completed" />}</section>
      {selected && <Modal open onClose={() => { setSelected(null); setUpdates([]); setAction(''); }} title={selected.title} subtitle={`${selected.taskNumber || 'Field task'} · ${taskLabel(selected, user.id)}`} size="xl" footer={<>{actions.length ? actionButtons(selected) : selected.status === 'verified' || workerStatus(selected, user.id) === 'completed' || selected.status === 'blocked' ? actionButtons(selected) : null}</>}>
        {detailsLoading ? <div className="space-y-4" aria-label="Loading task details"><div className="h-36 animate-pulse rounded-xl bg-surface-2" /><div className="h-48 animate-pulse rounded-xl bg-surface-2" /></div> : <TaskDetails task={selected} updates={updates} userId={user.id} />}
        {actionError && !action && <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">{actionError}</p>}
      </Modal>}
      {action && selected && <ActionDialog kind={action} task={selected} userId={user.id} onClose={() => !busy && setAction('')} onSubmit={submitAction} busy={busy} error={actionError} />}
    </div>
  );
}
