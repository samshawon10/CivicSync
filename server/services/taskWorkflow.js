
export const TASK_STATES = Object.freeze([
  'pending',
  'assigned',
  'team_formed',
  'accepted',
  'in_progress',
  'on_hold',
  'blocked',
  'completed',
  'cancelled',
  'rejected',
  // legacy field-execution states still produced by older clients
  'traveling',
  'arrived',
  'paused',
  'reopened'
]);

export const taskTransitions = Object.freeze({
  pending: ['assigned', 'cancelled'],
  assigned: ['team_formed', 'accepted', 'rejected', 'cancelled'],
  team_formed: ['accepted', 'cancelled'],
  accepted: ['in_progress', 'blocked', 'cancelled'],
  in_progress: ['on_hold', 'paused', 'blocked', 'completed'],
  on_hold: ['in_progress', 'blocked', 'cancelled'],
  paused: ['in_progress', 'blocked', 'cancelled'],
  blocked: ['in_progress', 'cancelled'],
  completed: ['reopened'],
  cancelled: ['reopened'],
  rejected: [],
  reopened: ['pending', 'assigned'],
  traveling: ['arrived', 'in_progress', 'blocked', 'cancelled'],
  arrived: ['in_progress', 'blocked', 'cancelled']
});

/** States that still hold workers and must be released when they end. */
export const OPEN_TASK_STATES = Object.freeze([
  'pending', 'assigned', 'team_formed', 'accepted',
  'in_progress', 'on_hold', 'paused', 'blocked', 'traveling', 'arrived'
]);

/** States after which every worker must go back to `available`. */
export const CLOSING_TASK_STATES = Object.freeze(['completed', 'cancelled', 'rejected']);

/** Roles allowed to drive each target state. */
const TASK_DRIVERS = Object.freeze({
  officer: [
    'assigned', 'team_formed', 'accepted', 'traveling', 'arrived',
    'in_progress', 'on_hold', 'paused', 'blocked', 'completed', 'cancelled'
  ],
  field_worker: ['accepted', 'in_progress', 'on_hold', 'paused', 'blocked'],
  department_officer: ['in_progress', 'on_hold', 'blocked', 'completed', 'cancelled'],
  department_head: ['reopened', 'cancelled']
});

const CANCEL_ROLES = Object.freeze(['officer', 'department_officer', 'department_head']);
const REOPEN_ROLES = Object.freeze(['department_head']);

export function canDriveTaskState(role, state) {
  return Boolean(TASK_DRIVERS[role]?.includes(state));
}

export function isOpenTaskState(state) {
  return OPEN_TASK_STATES.includes(state);
}

export function checkTaskTransition({ from, to, actorRole }) {
  if (!TASK_STATES.includes(to)) {
    return { ok: false, status: 422, message: `"${to}" is not a valid task state.` };
  }
  // Authority is checked BEFORE the transition table on purpose. If this actor
  // may never drive that state at all, the answer is "you may not do this"
  // (403), not "that would be an odd state change" (409) — otherwise a worker
  // probing officer-only actions gets a misleading state error.
  if (to === 'cancelled' && !CANCEL_ROLES.includes(actorRole)) {
    return { ok: false, status: 403, message: 'Only an officer or department management can cancel a task.' };
  }
  if (to === 'reopened' && !REOPEN_ROLES.includes(actorRole)) {
    return { ok: false, status: 403, message: 'Only a department head can reopen a task.' };
  }
  if (!canDriveTaskState(actorRole, to)) {
    return {
      ok: false,
      status: 403,
      message: `A ${String(actorRole).replaceAll('_', ' ')} cannot move a task to "${to}".`
    };
  }
  if (from === to) {
    return { ok: false, status: 409, message: `Task is already ${from}.` };
  }
  const allowed = taskTransitions[from] || [];
  if (!allowed.includes(to)) {
    return {
      ok: false,
      status: 409,
      message: `A task at "${from}" cannot move to "${to}".`
    };
  }
  return { ok: true };
}

/** Audit action name for a transition, so logs stay consistent. */
export const TASK_AUDIT_ACTIONS = Object.freeze({
  assigned: 'TASK_ASSIGNED',
  team_formed: 'TEAM_ASSIGNED',
  accepted: 'TASK_ACCEPTED',
  in_progress: 'TASK_STARTED',
  on_hold: 'TASK_ON_HOLD',
  blocked: 'TASK_BLOCKED',
  completed: 'TASK_COMPLETED',
  cancelled: 'TASK_CANCELLED',
  reopened: 'TASK_REOPENED',
  rejected: 'TASK_REJECTED'
});

export function taskAuditAction(state) {
  return TASK_AUDIT_ACTIONS[state] || 'TASK_STATUS_CHANGED';
}