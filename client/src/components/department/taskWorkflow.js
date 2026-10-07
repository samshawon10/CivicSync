
export const taskTransitions = {
  pending: ['assigned', 'cancelled'],
  assigned: ['team_formed', 'accepted', 'rejected', 'cancelled'],
  team_formed: ['accepted', 'cancelled'],
  accepted: ['traveling', 'in_progress', 'blocked', 'cancelled'],
  traveling: ['arrived', 'in_progress', 'blocked', 'cancelled'],
  arrived: ['in_progress', 'blocked', 'cancelled'],
  in_progress: ['on_hold', 'paused', 'blocked', 'completed'],
  on_hold: ['in_progress', 'blocked', 'cancelled'],
  paused: ['in_progress', 'blocked', 'cancelled'],
  blocked: ['in_progress', 'cancelled'],
  completed: ['verified', 'reopened'],
  verified: [],
  rejected: [],
  cancelled: ['reopened'],
  reopened: ['pending', 'assigned']
};

export const taskStatusFilters = [
  { id: 'active', label: 'Active', statuses: ['pending', 'assigned', 'team_formed', 'accepted', 'traveling', 'arrived', 'in_progress', 'on_hold', 'paused', 'reopened'] },
  { id: 'blocked', label: 'Blocked', statuses: ['blocked'] },
  { id: 'done', label: 'Completed', statuses: ['completed', 'verified'] },
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
  verified: 'Verify completed field work',
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
  if (to === 'completed' || to === 'verified') return 'success';
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
  if (status === 'verified') return order.length - 1;
  const index = order.indexOf(status);
  return index === -1 ? 0 : index;
}

export const taskProgressSteps = ['assigned', 'accepted', 'traveling', 'arrived', 'in_progress', 'completed'];
