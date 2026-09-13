export const roles = ['citizen', 'department_head', 'department_officer', 'field_worker', 'admin'];

export const roleLabels = {
  citizen: 'Citizen',
  department_head: 'Department Head',
  department_officer: 'Department Officer',
  field_worker: 'Field Worker',
  admin: 'Administrator'
};

export const dashboardPaths = {
  citizen: '/dashboard/citizen',
  department_head: '/dashboard/department-head',
  department_officer: '/dashboard/department-officer',
  field_worker: '/dashboard/field-worker',
  admin: '/dashboard/admin'
};

export const dashboardPathFor = (role) => dashboardPaths[role] || '/login';

