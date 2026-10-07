/**
 * Human-facing names for the stored role keys.
 *
 * The stored role keys are unchanged (`officer`, `field_worker`, …) so existing
 * accounts, permissions and workflow rules keep working. What the user reads is
 * this table: the team-level operational role `officer` is the `Team Leader`,
 * and `field_worker` is a `Worker` — two different roles from the
 * `department_officer` (Department Officer) management role.
 */
export const ROLE_LABELS = Object.freeze({
  citizen: 'Citizen',
  admin: 'Administrator',
  department_head: 'Department Head',
  department_officer: 'Department Officer',
  officer: 'Team Leader',
  field_worker: 'Worker',
  emergency_department_head: 'Emergency Head',
  emergency_department_officer: 'Emergency Department Officer',
  emergency_officer: 'Emergency Officer',
  emergency_field_worker: 'Emergency Field Worker'
});

export function roleLabel(role) {
  return ROLE_LABELS[role] || String(role || '').replaceAll('_', ' ');
}

export const TEAM_LEADER_ROLE = 'officer';
export const WORKER_ROLE = 'field_worker';
