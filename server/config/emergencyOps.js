
export const EMERGENCY_ROLES = Object.freeze([
  'emergency_department_head',
  'emergency_department_officer',
  'emergency_officer',
  'emergency_field_worker'
]);

/** The one global Emergency Department Head. */
export const HEAD_ROLE = 'emergency_department_head';
/** Roles that share command oversight (Super Admin is the technical authority). */
export const COMMAND_ROLES = Object.freeze(['admin', HEAD_ROLE]);

/** Incident classification decided by the Emergency Head. */
export const EMERGENCY_TYPES = Object.freeze(['MEDICAL', 'FIRE', 'SECURITY', 'ACCIDENT', 'NATURAL_DISASTER', 'OTHER']);

/** Priority scale (highest first). Priority history is retained on the incident. */
export const PRIORITIES = Object.freeze(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']);
export const PRIORITY_RANK = Object.freeze({ CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 });

/** Response units a team can be composed as. */
export const RESPONSE_TYPES = Object.freeze(['MEDICAL_RESPONSE', 'FIRE_RESPONSE', 'SECURITY_RESPONSE', 'RESCUE_RESPONSE', 'MULTI_AGENCY_RESPONSE']);

/** Incident lifecycle statuses. */
export const WORKFLOW = Object.freeze({
  SUBMITTED: 'SUBMITTED',
  HEAD_REVIEW: 'EMERGENCY_HEAD_REVIEW',
  ASSIGNED_EDO: 'ASSIGNED_TO_EMERGENCY_DEPARTMENT_OFFICER',
  EDO_REVIEW: 'EMERGENCY_DEPARTMENT_OFFICER_REVIEW',
  ASSIGNED_EO: 'ASSIGNED_TO_EMERGENCY_OFFICER',
  ACCEPTED_EO: 'ACCEPTED_BY_EMERGENCY_OFFICER',
  TEAM_FORMED: 'RESOURCE_TEAM_FORMED',
  EN_ROUTE: 'EN_ROUTE_TO_SCENE',
  ON_SCENE: 'ON_SCENE',
  RESPONSE_ACTIVE: 'ACTIVE_RESPONSE_IN_PROGRESS',
  ESCALATED: 'ESCALATED_WITHIN_HIERARCHY',
  FIELD_WORK_COMPLETED: 'FIELD_WORK_COMPLETED',
  RESOLVED: 'RESOLVED_PENDING_CONFIRMATION',
  CLOSED: 'CLOSED_BY_EMERGENCY_HEAD',
  CANCELLED: 'CANCELLED_WITH_REASON',
  FALSE_REPORT: 'MARKED_FALSE_REPORT'
});

export const WORKFLOW_STATUSES = Object.freeze(Object.values(WORKFLOW));

/** Closed-out statuses: nothing else may happen to the incident. */
export const TERMINAL_STATUSES = Object.freeze([WORKFLOW.CLOSED, WORKFLOW.CANCELLED, WORKFLOW.FALSE_REPORT]);

/** Statuses that still hold live resources (workers stay BUSY). */
export const RESOURCE_HOLDING_STATUSES = Object.freeze([
  WORKFLOW.TEAM_FORMED,
  WORKFLOW.EN_ROUTE,
  WORKFLOW.ON_SCENE,
  WORKFLOW.RESPONSE_ACTIVE,
  WORKFLOW.ESCALATED,
  WORKFLOW.FIELD_WORK_COMPLETED
]);

export const TRANSITION_RULES = Object.freeze({
  [WORKFLOW.HEAD_REVIEW]: { from: [WORKFLOW.SUBMITTED], roles: COMMAND_ROLES },
  [WORKFLOW.ASSIGNED_EDO]: { from: [WORKFLOW.SUBMITTED, WORKFLOW.HEAD_REVIEW, WORKFLOW.ASSIGNED_EDO, WORKFLOW.EDO_REVIEW], roles: COMMAND_ROLES },
  [WORKFLOW.EDO_REVIEW]: { from: [WORKFLOW.ASSIGNED_EDO], roles: [...COMMAND_ROLES, 'emergency_department_officer'] },
  [WORKFLOW.ASSIGNED_EO]: { from: [WORKFLOW.ASSIGNED_EDO, WORKFLOW.EDO_REVIEW, WORKFLOW.ASSIGNED_EO], roles: [...COMMAND_ROLES, 'emergency_department_officer'] },
  [WORKFLOW.ACCEPTED_EO]: { from: [WORKFLOW.ASSIGNED_EO], roles: [...COMMAND_ROLES, 'emergency_officer'] },
  [WORKFLOW.TEAM_FORMED]: {
    from: [WORKFLOW.ACCEPTED_EO, WORKFLOW.TEAM_FORMED, WORKFLOW.EN_ROUTE, WORKFLOW.ON_SCENE, WORKFLOW.RESPONSE_ACTIVE],
    roles: [...COMMAND_ROLES, 'emergency_department_officer', 'emergency_officer']
  },
  [WORKFLOW.EN_ROUTE]: { from: [WORKFLOW.TEAM_FORMED], roles: [...COMMAND_ROLES, 'emergency_department_officer', 'emergency_officer', 'emergency_field_worker'] },
  [WORKFLOW.ON_SCENE]: { from: [WORKFLOW.TEAM_FORMED, WORKFLOW.EN_ROUTE], roles: [...COMMAND_ROLES, 'emergency_department_officer', 'emergency_officer', 'emergency_field_worker'] },
  [WORKFLOW.RESPONSE_ACTIVE]: { from: [WORKFLOW.TEAM_FORMED, WORKFLOW.EN_ROUTE, WORKFLOW.ON_SCENE], roles: [...COMMAND_ROLES, 'emergency_department_officer', 'emergency_officer', 'emergency_field_worker'] },
  [WORKFLOW.ESCALATED]: {
    from: [WORKFLOW.ASSIGNED_EDO, WORKFLOW.EDO_REVIEW, WORKFLOW.ASSIGNED_EO, WORKFLOW.ACCEPTED_EO, WORKFLOW.TEAM_FORMED, WORKFLOW.EN_ROUTE, WORKFLOW.ON_SCENE, WORKFLOW.RESPONSE_ACTIVE, WORKFLOW.FIELD_WORK_COMPLETED],
    roles: EMERGENCY_ROLES
  },
  [WORKFLOW.FIELD_WORK_COMPLETED]: {
    from: [WORKFLOW.TEAM_FORMED, WORKFLOW.EN_ROUTE, WORKFLOW.ON_SCENE, WORKFLOW.RESPONSE_ACTIVE, WORKFLOW.ESCALATED, WORKFLOW.FIELD_WORK_COMPLETED],
    roles: [...COMMAND_ROLES, 'emergency_department_officer', 'emergency_officer', 'emergency_field_worker']
  },
  [WORKFLOW.RESOLVED]: { from: [WORKFLOW.FIELD_WORK_COMPLETED], roles: [...COMMAND_ROLES, 'emergency_department_officer'] },
  [WORKFLOW.CLOSED]: { from: [WORKFLOW.RESOLVED], roles: COMMAND_ROLES },
  [WORKFLOW.CANCELLED]: {
    from: [WORKFLOW.SUBMITTED, WORKFLOW.HEAD_REVIEW, WORKFLOW.ASSIGNED_EDO, WORKFLOW.EDO_REVIEW, WORKFLOW.ASSIGNED_EO, WORKFLOW.ACCEPTED_EO, WORKFLOW.TEAM_FORMED, WORKFLOW.EN_ROUTE, WORKFLOW.ON_SCENE, WORKFLOW.RESPONSE_ACTIVE, WORKFLOW.ESCALATED, WORKFLOW.FIELD_WORK_COMPLETED, WORKFLOW.RESOLVED],
    roles: COMMAND_ROLES
  },
  [WORKFLOW.FALSE_REPORT]: { from: [WORKFLOW.SUBMITTED, WORKFLOW.HEAD_REVIEW, WORKFLOW.ASSIGNED_EDO, WORKFLOW.EDO_REVIEW, WORKFLOW.ASSIGNED_EO, WORKFLOW.CANCELLED], roles: COMMAND_ROLES }
});

/** Statuses a transition may start from, derived from the rules above. */
export const TRANSITIONS = Object.freeze(
  Object.fromEntries(Object.entries(TRANSITION_RULES).map(([target, rule]) => [target, [...rule.from]]))
);

/** Which role an actor is allowed to place into a case (case-level hand-off). */
export const CASE_ASSIGNMENT = Object.freeze({
  emergency_department_head: ['emergency_department_officer'],
  emergency_department_officer: ['emergency_officer'],
  emergency_officer: ['emergency_field_worker'],
  admin: ['emergency_department_officer', 'emergency_officer', 'emergency_field_worker']
});

/** Escalation levels: who is being asked to take over. */
export const ESCALATION_LEVELS = Object.freeze({
  DEPARTMENT_OFFICER: { label: 'Emergency Department Officer', role: 'emergency_department_officer' },
  HEAD: { label: 'Emergency Head', role: 'emergency_department_head' },
  OFFICER: { label: 'Emergency Officer', role: 'emergency_officer' }
});

export const TEAM_KINDS = Object.freeze(['TASK', 'ROSTER']);
export const TEAM_MEMBER_STATUS = Object.freeze(['ACTIVE', 'FIELD_WORK_COMPLETED', 'RELEASED']);

/** Operations status mirrored onto the legacy `Emergency.status` field. */
export const LEGACY_STATUS = Object.freeze({
  SUBMITTED: 'received',
  EMERGENCY_HEAD_REVIEW: 'assessing',
  ASSIGNED_TO_EMERGENCY_DEPARTMENT_OFFICER: 'assessing',
  EMERGENCY_DEPARTMENT_OFFICER_REVIEW: 'assessing',
  ASSIGNED_TO_EMERGENCY_OFFICER: 'dispatched',
  ACCEPTED_BY_EMERGENCY_OFFICER: 'dispatched',
  RESOURCE_TEAM_FORMED: 'dispatched',
  EN_ROUTE_TO_SCENE: 'en_route',
  ON_SCENE: 'on_scene',
  ACTIVE_RESPONSE_IN_PROGRESS: 'responding',
  ESCALATED_WITHIN_HIERARCHY: 'responding',
  FIELD_WORK_COMPLETED: 'responding',
  RESOLVED_PENDING_CONFIRMATION: 'resolved',
  CLOSED_BY_EMERGENCY_HEAD: 'closed',
  CANCELLED_WITH_REASON: 'cancelled',
  MARKED_FALSE_REPORT: 'rejected'
});

/** Operations status mirrored onto `EmergencyResponseAssignment.status`. */
export const LEGACY_ASSIGNMENT_STATUS = Object.freeze({
  SUBMITTED: 'assigned',
  EMERGENCY_HEAD_REVIEW: 'assigned',
  ASSIGNED_TO_EMERGENCY_DEPARTMENT_OFFICER: 'assigned',
  EMERGENCY_DEPARTMENT_OFFICER_REVIEW: 'assigned',
  ASSIGNED_TO_EMERGENCY_OFFICER: 'assigned',
  ACCEPTED_BY_EMERGENCY_OFFICER: 'accepted',
  RESOURCE_TEAM_FORMED: 'accepted',
  EN_ROUTE_TO_SCENE: 'en_route',
  ON_SCENE: 'on_scene',
  ACTIVE_RESPONSE_IN_PROGRESS: 'responding',
  ESCALATED_WITHIN_HIERARCHY: 'responding',
  FIELD_WORK_COMPLETED: 'completed',
  RESOLVED_PENDING_CONFIRMATION: 'completed',
  CLOSED_BY_EMERGENCY_HEAD: 'completed',
  CANCELLED_WITH_REASON: 'cancelled',
  MARKED_FALSE_REPORT: 'cancelled'
});

/** Priority mirrored onto the legacy severity/priority fields (lowercase). */
export const LEGACY_SEVERITY = Object.freeze({ CRITICAL: 'critical', HIGH: 'high', MEDIUM: 'medium', LOW: 'low' });
export const SEVERITY_PRIORITY = Object.freeze({ critical: 'CRITICAL', high: 'HIGH', medium: 'MEDIUM', low: 'LOW' });

/** Operations type mirrored onto the legacy citizen-facing category. */
export const TYPE_TO_CATEGORY = Object.freeze({
  MEDICAL: 'medical',
  FIRE: 'fire_disaster',
  SECURITY: 'security_crime',
  ACCIDENT: 'road_traffic',
  NATURAL_DISASTER: 'environmental_disaster',
  OTHER: 'other'
});
export const CATEGORY_TO_TYPE = Object.freeze({
  medical: 'MEDICAL',
  fire_disaster: 'FIRE',
  security_crime: 'SECURITY',
  women_safety: 'SECURITY',
  child_safety: 'SECURITY',
  missing_person: 'SECURITY',
  road_traffic: 'ACCIDENT',
  environmental_disaster: 'NATURAL_DISASTER'
});

/** Roles allowed to drive field-side movement of a team. */
export const FIELD_ROLES = Object.freeze(['emergency_department_head', 'emergency_department_officer', 'emergency_officer', 'emergency_field_worker', 'admin']);

/** Audit action names written to ActivityLog for traceability. */
export const OPS_AUDIT_ACTIONS = Object.freeze([
  'emergency_ops_received',
  'emergency_reviewed',
  'emergency_classified',
  'emergency_priority_changed',
  'emergency_department_officer_assigned',
  'emergency_officer_assigned',
  'emergency_officer_accepted',
  'emergency_response_team_formed',
  'emergency_roster_team_created',
  'emergency_team_disbanded',
  'emergency_en_route',
  'emergency_on_scene',
  'emergency_response_active',
  'emergency_progress_updated',
  'emergency_blocker_raised',
  'emergency_blocker_resolved',
  'emergency_escalated',
  'emergency_escalation_resolved',
  'emergency_field_work_completed',
  'emergency_resolved',
  'emergency_closed',
  'emergency_cancelled',
  'emergency_false_report',
  'emergency_instructions_added',
  'emergency_head_replaced',
  'emergency_head_demoted'
]);

export const escalationNoun = (level) => ESCALATION_LEVELS[level]?.label || 'the level above';
export const priorityWeight = (priority) => PRIORITY_RANK[priority] || 0;
export const opsLabel = (value = '') => String(value).replaceAll('_', ' ');
