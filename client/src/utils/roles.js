export const roles = ['citizen', 'admin', 'department_head', 'department_officer', 'officer', 'field_worker', 'emergency_department_head', 'emergency_department_officer', 'emergency_officer', 'emergency_field_worker'];

export const roleLabels = {
  citizen: 'Citizen',
  department_head: 'Department Head',
  department_officer: 'Department Officer',
  officer: 'Officer',
  field_worker: 'Field Worker',
  admin: 'Administrator',
  emergency_department_head: 'Emergency Department Head',
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
  emergency_department_officer: '/dashboard/emergency-officer',
  emergency_officer: '/dashboard/emergency-officer',
  emergency_field_worker: '/dashboard/emergency-field-worker',
  admin: '/dashboard/admin'
};

export const dashboardPathFor = (role) => dashboardPaths[role] || '/login';
