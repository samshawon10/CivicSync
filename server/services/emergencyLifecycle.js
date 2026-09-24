export const assignmentStatusTransitions = {
  assigned: ['accepted', 'cancelled'],
  accepted: ['en_route', 'cancelled'],
  en_route: ['on_scene', 'cancelled'],
  on_scene: ['responding', 'completed', 'cancelled'],
  responding: ['completed', 'cancelled'],
  completed: [],
  cancelled: []
};

const cancelAndEscalate = ['escalated', 'cancelled', 'false_report'];
export const emergencyStatusTransitions = {
  reported: ['received', 'assessing', ...cancelAndEscalate],
  received: ['assessing', 'verified', ...cancelAndEscalate],
  assessing: ['verified', ...cancelAndEscalate],
  verified: ['dispatched', 'resolved', ...cancelAndEscalate],
  dispatched: ['en_route', 'requires_backup', ...cancelAndEscalate],
  en_route: ['on_scene', 'requires_backup', ...cancelAndEscalate],
  on_scene: ['responding', 'requires_backup', ...cancelAndEscalate],
  responding: ['requires_backup', 'resolved', ...cancelAndEscalate],
  requires_backup: ['dispatched', 'en_route', 'on_scene', 'responding', 'resolved', ...cancelAndEscalate],
  escalated: ['assessing', 'dispatched', 'en_route', 'on_scene', 'responding', 'requires_backup', 'resolved'],
  resolved: ['closed'],
  closed: [],
  cancelled: [],
  false_report: [],
  reassigned: []
};

export function canTransitionAssignment(from, to) {
  return Boolean(assignmentStatusTransitions[from]?.includes(to));
}

export function canTransitionEmergency(from, to) {
  return Boolean(emergencyStatusTransitions[from]?.includes(to));
}
