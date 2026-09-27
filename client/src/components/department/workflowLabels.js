
export const STAGE_LABELS = {
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
};

export const TASK_STATE_LABELS = {
  pending: 'Pending',
  assigned: 'Assigned',
  team_formed: 'Team formed',
  accepted: 'Accepted',
  traveling: 'Travelling',
  arrived: 'On site',
  in_progress: 'In progress',
  on_hold: 'On hold',
  paused: 'Paused',
  blocked: 'Blocked',
  completed: 'Completed',
  cancelled: 'Cancelled',
  rejected: 'Rejected',
  reopened: 'Reopened'
};

export const AVAILABILITY_LABELS = {
  available: 'Available',
  busy: 'Busy',
  off_duty: 'Off duty',
  on_leave: 'On leave',
  unavailable: 'Unavailable'
};

export const AVAILABILITY_TONES = {
  available: 'success',
  busy: 'info',
  off_duty: 'neutral',
  on_leave: 'warning',
  unavailable: 'danger'
};

export const PROGRESS_KIND_LABELS = {
  started: 'Work started',
  inspection: 'Inspection completed',
  material: 'Material required',
  problem: 'Problem found',
  progress: 'Progress update',
  blocked: 'Work blocked',
  completed: 'Work completed',
  note: 'Note'
};

/** Roles that may be shown a worker/team assignment control. */
export function canStaffTasks(role) {
  return role === 'officer';
}

/** Roles that may hand a case to another person. */
export function canAssignCase(role) {
  return role === 'department_head' || role === 'department_officer';
}