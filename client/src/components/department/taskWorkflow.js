/**
 * Client mirror of the server-side DepartmentTask transition map
 * (see server/controllers/departmentController.js -> updateTaskStatus).
 * The server remains the source of truth; this only drives which buttons render.
 */
export const taskTransitions = {
  assigned: ['accepted', 'rejected', 'cancelled'],
  accepted: ['traveling', 'blocked', 'cancelled'],
  traveling: ['arrived', 'blocked'],
  arrived: ['in_progress', 'blocked'],
  in_progress: ['completed', 'blocked', 'paused'],
  paused: ['in_progress', 'blocked'],
  blocked: ['in_progress', 'traveling', 'arrived', 'cancelled'],
  completed: [],
  rejected: [],
  cancelled: []
};

export const taskStatusFilters = [
  { id: 'active', label: 'Active', statuses: ['assigned', 'accepted', 'traveling', 'arrived', 'in_progress'] },
  { id: 'blocked', label: 'Blocked', statuses: ['blocked'] },
  { id: 'done', label: 'Completed', statuses: ['completed'] },
  { id: 'closed', label: 'Rejected / Cancelled', statuses: ['rejected', 'cancelled'] },
  { id: 'all', label: 'All tasks', statuses: null }
];

const labels = {
  accepted: 'Accept task',
  rejected: 'Reject assignment',
  traveling: 'Start travel',
  arrived: 'Confirm arrival on site',
  in_progress: 'Start field work',
  completed: 'Complete task & upload evidence',
  paused: 'Pause work',
  blocked: 'Report blocker',
  cancelled: 'Cancel task'
};

export function transitionLabel(from, to) {
  if (from === 'blocked' && to === 'in_progress') return 'Resume work';
  if (from === 'paused' && to === 'in_progress') return 'Resume work';
  return labels[to] || to;
}

export function transitionTone(to) {
  if (to === 'completed') return 'success';
  if (to === 'blocked' || to === 'rejected' || to === 'cancelled') return 'danger';
  if (to === 'accepted') return 'info';
  return 'neutral';
}

/** Dialog type required before a transition can be submitted. */
export function transitionDialog(to) {
  if (to === 'completed') return 'complete';
  if (to === 'blocked') return 'block';
  if (to === 'rejected') return 'reject';
  return null;
}

export function progressIndex(status) {
  const order = ['assigned', 'accepted', 'traveling', 'arrived', 'in_progress', 'completed'];
  const index = order.indexOf(status);
  return index === -1 ? 0 : index;
}

export const taskProgressSteps = ['assigned', 'accepted', 'traveling', 'arrived', 'in_progress', 'completed'];
