
export const STAGE_LABELS = {
  SUBMITTED: 'Submitted',
  DEPARTMENT_HEAD_REVIEW: 'Under Review',
  ASSIGNED_TO_DEPARTMENT_OFFICER: 'Assigned to Department Officer',
  DEPARTMENT_OFFICER_REVIEW: 'Department Officer reviewing',
  ASSIGNED_TO_OFFICER: 'Preparing field task',
  TEAM_FORMED: 'Team Assigned',
  ACCEPTED: 'Accepted by the team',
  IN_PROGRESS: 'In Progress',
  ON_HOLD: 'Work on hold',
  BLOCKED: 'Work blocked',
  COMPLETED: 'Completed',
  PENDING_VERIFICATION: 'Pending Verification',
  VERIFIED: 'Verified',
  RESOLVED: 'Resolved',
  CANCELLED: 'Cancelled',
  REOPENED: 'Reopened'
};

/** Progress path shown to the citizen on a case timeline. */
export const CITIZEN_STAGES = ['SUBMITTED', 'DEPARTMENT_HEAD_REVIEW', 'ASSIGNED_TO_DEPARTMENT_OFFICER', 'ASSIGNED_TO_OFFICER', 'TEAM_FORMED', 'IN_PROGRESS', 'COMPLETED', 'PENDING_VERIFICATION', 'VERIFIED', 'RESOLVED'];

/** Citizen-facing wording for the same stages (mirrors server/services/reportWorkflow.js). */
export const CITIZEN_STAGE_LABELS = {
  SUBMITTED: 'Submitted',
  DEPARTMENT_HEAD_REVIEW: 'Under Review',
  ASSIGNED_TO_DEPARTMENT_OFFICER: 'Assigned to Department Officer',
  DEPARTMENT_OFFICER_REVIEW: 'Assigned to Department Officer',
  ASSIGNED_TO_OFFICER: 'Preparing field task',
  TEAM_FORMED: 'Team Assigned',
  ACCEPTED: 'Team Assigned',
  IN_PROGRESS: 'In Progress',
  ON_HOLD: 'In Progress',
  BLOCKED: 'In Progress',
  COMPLETED: 'Work Finished',
  PENDING_VERIFICATION: 'Pending Verification',
  VERIFIED: 'Verified',
  RESOLVED: 'Resolved',
  CANCELLED: 'Cancelled',
  REOPENED: 'Under Review'
};

export const stageLabel = (stage) => STAGE_LABELS[stage] || String(stage || '').replaceAll('_', ' ');

export const citizenStageLabel = (stage) => CITIZEN_STAGE_LABELS[stage] || stageLabel(stage);

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
  verified: 'Verified',
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
