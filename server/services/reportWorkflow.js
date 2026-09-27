
export const REPORT_WORKFLOW_STAGES = Object.freeze([
  'SUBMITTED',
  'DEPARTMENT_HEAD_REVIEW',
  'ASSIGNED_TO_DEPARTMENT_OFFICER',
  'DEPARTMENT_OFFICER_REVIEW',
  'ASSIGNED_TO_OFFICER',
  'TEAM_FORMED',
  'ACCEPTED',
  'IN_PROGRESS',
  'ON_HOLD',
  'BLOCKED',
  'COMPLETED',
  'CANCELLED',
  'REOPENED'
]);

export const reportWorkflowTransitions = Object.freeze({
  SUBMITTED: ['DEPARTMENT_HEAD_REVIEW', 'CANCELLED'],
  DEPARTMENT_HEAD_REVIEW: ['ASSIGNED_TO_DEPARTMENT_OFFICER', 'CANCELLED'],
  ASSIGNED_TO_DEPARTMENT_OFFICER: ['DEPARTMENT_OFFICER_REVIEW', 'ASSIGNED_TO_OFFICER', 'CANCELLED'],
  DEPARTMENT_OFFICER_REVIEW: ['ASSIGNED_TO_OFFICER', 'CANCELLED'],
  ASSIGNED_TO_OFFICER: ['TEAM_FORMED', 'CANCELLED'],
  TEAM_FORMED: ['ACCEPTED', 'CANCELLED'],
  ACCEPTED: ['IN_PROGRESS', 'BLOCKED', 'CANCELLED'],
  IN_PROGRESS: ['ON_HOLD', 'BLOCKED', 'COMPLETED'],
  ON_HOLD: ['IN_PROGRESS', 'BLOCKED', 'CANCELLED'],
  BLOCKED: ['IN_PROGRESS', 'CANCELLED'],
  COMPLETED: ['REOPENED'],
  CANCELLED: ['REOPENED'],
  REOPENED: ['DEPARTMENT_HEAD_REVIEW']
});

/** Stages that mean the case is still live work. */
export const ACTIVE_WORKFLOW_STAGES = Object.freeze([
  'DEPARTMENT_HEAD_REVIEW',
  'ASSIGNED_TO_DEPARTMENT_OFFICER',
  'DEPARTMENT_OFFICER_REVIEW',
  'ASSIGNED_TO_OFFICER',
  'TEAM_FORMED',
  'ACCEPTED',
  'IN_PROGRESS',
  'ON_HOLD',
  'BLOCKED'
]);

/** Terminal stages: no onward transition except an explicit reopen. */
export const CLOSED_WORKFLOW_STAGES = Object.freeze(['COMPLETED', 'CANCELLED']);

const STAGE_DRIVERS = Object.freeze({
  department_head: [
    'DEPARTMENT_HEAD_REVIEW', 'ASSIGNED_TO_DEPARTMENT_OFFICER',
    'CANCELLED', 'COMPLETED', 'REOPENED'
  ],
  department_officer: [
    'DEPARTMENT_OFFICER_REVIEW', 'ASSIGNED_TO_OFFICER',
    'IN_PROGRESS', 'ON_HOLD', 'BLOCKED', 'CANCELLED', 'COMPLETED'
  ],
  officer: ['TEAM_FORMED', 'ACCEPTED', 'IN_PROGRESS', 'ON_HOLD', 'BLOCKED', 'COMPLETED', 'CANCELLED'],
  field_worker: ['ACCEPTED', 'IN_PROGRESS', 'ON_HOLD', 'BLOCKED', 'COMPLETED']
});

/** Roles allowed to reopen a closed case (administrative override). */
const REOPEN_ROLES = Object.freeze(['department_head', 'admin']);

/** Roles allowed to cancel at any point. */
const CANCEL_ROLES = Object.freeze(['department_head', 'department_officer']);

export function canDriveStage(role, stage) {
  return Boolean(STAGE_DRIVERS[role]?.includes(stage));
}

export function checkStageTransition({ from, to, actorRole }) {
  if (from === to) {
    return { ok: false, status: 409, message: `This case is already at ${from}.` };
  }
  const allowed = reportWorkflowTransitions[from] || [];
  if (!allowed.includes(to)) {
    return {
      ok: false,
      status: 409,
      message: `A case at ${from} cannot move directly to ${to}.`
    };
  }
  // Reopening a closed case is an administrative act, not routine flow.
  if (to === 'REOPENED' && !REOPEN_ROLES.includes(actorRole)) {
    return { ok: false, status: 403, message: 'Only a department head can reopen a closed case.' };
  }
  if (to === 'CANCELLED' && !CANCEL_ROLES.includes(actorRole)) {
    return { ok: false, status: 403, message: 'Only department management can cancel a case.' };
  }
  if (!canDriveStage(actorRole, to)) {
    return { ok: false, status: 403, message: `A ${actorRole.replaceAll('_', ' ')} cannot move a case to ${to}.` };
  }
  return { ok: true };
}

/** Human-facing label used in activity notes and the citizen timeline. */
export const STAGE_LABELS = Object.freeze({
  SUBMITTED: 'Report submitted',
  DEPARTMENT_HEAD_REVIEW: 'Under department review',
  ASSIGNED_TO_DEPARTMENT_OFFICER: 'Assigned to Department Officer',
  DEPARTMENT_OFFICER_REVIEW: 'Department Officer reviewing',
  ASSIGNED_TO_OFFICER: 'Assigned to Officer',
  TEAM_FORMED: 'Team assigned',
  ACCEPTED: 'Team accepted the work',
  IN_PROGRESS: 'Work in progress',
  ON_HOLD: 'Work on hold',
  BLOCKED: 'Work blocked',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  REOPENED: 'Reopened'
});

export const CITIZEN_STAGE_LABELS = Object.freeze({
  SUBMITTED: 'Report Submitted',
  DEPARTMENT_HEAD_REVIEW: 'Under Department Review',
  ASSIGNED_TO_DEPARTMENT_OFFICER: 'Assigned to Department Officer',
  DEPARTMENT_OFFICER_REVIEW: 'Assigned to Department Officer',
  ASSIGNED_TO_OFFICER: 'Assigned to Officer',
  TEAM_FORMED: 'Team Assigned',
  ACCEPTED: 'Team Assigned',
  IN_PROGRESS: 'Work In Progress',
  ON_HOLD: 'Work In Progress',
  BLOCKED: 'Work In Progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  REOPENED: 'Under Department Review'
});