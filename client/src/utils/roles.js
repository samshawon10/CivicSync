export const roles = ['citizen', 'admin', 'department_head', 'department_officer', 'officer', 'field_worker', 'emergency_department_head', 'emergency_department_officer', 'emergency_officer', 'emergency_field_worker'];

// Stored role keys stay unchanged; only the labels differ. `officer` is the
// team-level operational role (Team Leader) and is a different role from
// `department_officer` (Department Officer).
export const roleLabels = {
  citizen: 'Citizen',
  department_head: 'Department Head',
  department_officer: 'Department Officer',
  officer: 'Team Leader',
  field_worker: 'Worker',
  admin: 'Administrator',
  emergency_department_head: 'Emergency Head',
  emergency_department_officer: 'Emergency Department Officer',
  emergency_officer: 'Emergency Officer',
  emergency_field_worker: 'Emergency Field Worker'
};

export const dashboardPaths = {
  citizen: '/dashboard/citizen',
  department_head: '/dashboard/department-head',
  department_officer: '/dashboard/department-officer',
  officer: '/dashboard/officer',
  field_worker: '/dashboard/field-worker',
  emergency_department_head: '/dashboard/emergency-head',
  emergency_department_officer: '/dashboard/emergency-department-officer',
  emergency_officer: '/dashboard/emergency-officer',
  emergency_field_worker: '/dashboard/emergency-field-worker',
  admin: '/dashboard/admin'
};

export const dashboardPathFor = (role) => dashboardPaths[role] || '/login';
