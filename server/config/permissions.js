/**
 * CivicSync role capability matrix.
 *
 * This file documents the capabilities that the BACKEND actually enforces
 * (see `middleware/authMiddleware.js`, the route guards in `routes/*.js`, and
 * the role checks inside the controllers). It is served to the Super Admin
 * dashboard so the Roles & Permissions screen reflects real enforcement
 * instead of a decorative front-end-only matrix.
 *
 * The frontend is never the security boundary: every entry below maps to a
 * server-side check that rejects unauthorised requests with 401/403.
 */

export const roleOrder = [
  'admin',
  'emergency_department_head',
  'emergency_department_officer',
  'emergency_officer',
  'emergency_field_worker',
  'department_head',
  'department_officer',
  'officer',
  'field_worker',
  'citizen'
];

export const roleMeta = {
  admin: { label: 'Super Admin', group: 'Governance', description: 'Governs the whole CivicSync ecosystem: users, roles, departments, configuration, audit and analytics.' },
  emergency_department_head: { label: 'Emergency Head', group: 'Emergency', description: 'Runs emergency command: classify, verify, dispatch, escalate, close incidents and manage alerts.' },
  emergency_department_officer: { label: 'Emergency Department Officer', group: 'Emergency', description: 'Legacy responder role retained for older records; participates in assignments without command authority.' },
  emergency_officer: { label: 'Emergency Officer', group: 'Emergency', description: 'Accepts assignments, moves through the assignment lifecycle and manages field workers.' },
  emergency_field_worker: { label: 'Emergency Field Worker', group: 'Emergency', description: 'Executes field work on an assignment and reports location and completion.' },
  department_head: { label: 'Department Head', group: 'Civic', description: 'Owns a civic department queue: priority, assignment, escalation and completion review.' },
  department_officer: { label: 'Department Officer', group: 'Civic', description: 'Works the department queue and updates assigned complaints.' },
  officer: { label: 'Officer', group: 'Civic', description: 'Handles complaints assigned directly to them.' },
  field_worker: { label: 'Field Worker', group: 'Civic', description: 'Completes assigned field work and submits completion evidence.' },
  citizen: { label: 'Citizen', group: 'Public', description: 'Reports civic issues, raises emergencies, tracks progress and manages safety services.' }
};

export const permissionActions = ['view', 'create', 'edit', 'assign', 'manage', 'escalate', 'resolve', 'close', 'delete', 'export'];

export const permissionMatrix = [
  {
    key: 'users',
    label: 'Users',
    enforcement: "routes/adminRoutes.js + routes/userRoutes.js (requireRole('admin'))",
    actions: {
      view: { roles: ['admin'] },
      create: { roles: [], note: 'Accounts are created by citizens/staff themselves through Firebase authentication.' },
      edit: { roles: ['admin'] },
      assign: { roles: ['admin'], note: 'Role and department assignment.' },
      manage: { roles: ['admin'], note: 'Suspend / activate accounts.' },
      delete: { roles: ['admin'], note: 'Administrator accounts and your own account cannot be deleted.' },
      export: { roles: ['admin'], note: 'CSV export endpoint.' }
    }
  },
  {
    key: 'departments',
    label: 'Departments',
    enforcement: "routes/adminRoutes.js (requireRole('admin'))",
    actions: {
      view: { roles: ['admin'], note: 'Authenticated staff can also read the citizen-facing department list.' },
      create: { roles: ['admin'] },
      edit: { roles: ['admin'] },
      assign: { roles: ['admin'], note: 'Department head and emergency head assignment.' },
      delete: { roles: ['admin'] },
      manage: { roles: ['admin'], note: 'Emergency routing (scope + emergency types).' }
    }
  },
  {
    key: 'complaints',
    label: 'Complaints',
    enforcement: 'controllers/adminController.js + controllers/departmentController.js',
    actions: {
      view: { roles: ['admin', 'department_head', 'department_officer', 'officer', 'field_worker', 'citizen'], scoped: true },
      edit: { roles: ['admin'] },
      assign: { roles: ['department_head'] },
      resolve: { roles: ['department_head', 'department_officer', 'officer', 'field_worker'], scoped: true },
      delete: { roles: ['admin', 'citizen'], scoped: true },
      export: { roles: ['admin'] }
    }
  },
  {
    key: 'emergencies',
    label: 'Emergencies',
    enforcement: 'routes/emergencyRoutes.js + config/emergencyOptions.js (commandRoles)',
    actions: {
      view: { roles: ['admin', 'emergency_department_head'], note: 'Command access; participants see only incidents they are assigned to.' },
      create: { roles: ['citizen', 'admin', 'emergency_department_head', 'emergency_officer'], note: 'Citizens raise SOS and emergency reports.' },
      edit: { roles: ['admin', 'emergency_department_head'], note: 'Classify, verify and correct incident details.' },
      assign: { roles: ['admin', 'emergency_department_head'] },
      escalate: { roles: ['admin', 'emergency_department_head'] },
      resolve: { roles: ['admin', 'emergency_department_head', 'emergency_officer'], scoped: true },
      close: { roles: ['admin', 'emergency_department_head'] },
      export: { roles: ['admin'] }
    }
  }
,
  {
    key: 'assignments',
    label: 'Response Assignments',
    enforcement: 'controllers/emergencyController.js (assignment lifecycle transitions)',
    actions: {
      view: { roles: ['admin', 'emergency_department_head', 'emergency_department_officer', 'emergency_officer', 'emergency_field_worker'], scoped: true },
      manage: { roles: ['admin', 'emergency_department_head'], note: 'Create, cancel and re-dispatch assignments.' },
      edit: { roles: ['emergency_officer', 'emergency_field_worker'], scoped: true, note: 'accepted → en route → on scene → responding → completed.' }
    }
  },
  {
    key: 'teams',
    label: 'Response Teams',
    enforcement: 'routes/responseTeamRoutes.js',
    actions: {
      view: { roles: ['admin', 'emergency_department_head', 'emergency_department_officer', 'emergency_officer'] },
      create: { roles: ['admin', 'emergency_department_head'] },
      edit: { roles: ['admin', 'emergency_department_head'] },
      delete: { roles: ['admin'] }
    }
  },
  {
    key: 'facilities',
    label: 'Safety Facilities',
    enforcement: 'routes/emergencyServiceRoutes.js',
    actions: {
      view: { roles: ['citizen', 'admin', 'emergency_department_head', 'emergency_department_officer', 'emergency_officer', 'emergency_field_worker', 'department_head', 'department_officer', 'officer', 'field_worker'] },
      create: { roles: ['admin', 'emergency_department_head'] },
      edit: { roles: ['admin', 'emergency_department_head'] },
      delete: { roles: ['admin'] }
    }
  },
  {
    key: 'categories',
    label: 'Emergency Categories',
    enforcement: 'controllers/emergencyController.js (manageCategories)',
    actions: {
      view: { roles: ['citizen', 'admin', 'emergency_department_head', 'emergency_department_officer', 'emergency_officer', 'emergency_field_worker'], note: 'Active categories are read by the citizen reporting flow.' },
      create: { roles: ['admin'] },
      edit: { roles: ['admin'] },
      manage: { roles: ['admin'], note: 'Activate or deactivate a category.' }
    }
  },
  {
    key: 'alerts',
    label: 'Alerts & Broadcast',
    enforcement: 'controllers/emergencyController.js (commandAccess)',
    actions: {
      view: { roles: ['citizen', 'admin', 'emergency_department_head', 'emergency_department_officer', 'emergency_officer', 'emergency_field_worker'], scoped: true, note: 'Everyone sees active alerts; only command sees archived ones.' },
      create: { roles: ['admin', 'emergency_department_head'] },
      edit: { roles: ['admin', 'emergency_department_head'] },
      delete: { roles: [], note: 'Alerts are expired or archived rather than deleted so notification history stays auditable.' }
    }
  },
  {
    key: 'analytics',
    label: 'Analytics & Intelligence',
    enforcement: 'routes/adminRoutes.js + controllers/emergencyController.js',
    actions: {
      view: { roles: ['admin'], note: 'System, department and operations analytics.' },
      export: { roles: ['admin'] },
      manage: { roles: ['emergency_department_head'], note: 'Emergency analytics, hotspots and safety intelligence.' }
    }
  },
  {
    key: 'audit',
    label: 'Audit & Activity Logs',
    enforcement: 'controllers/adminController.js (listActivityLogs)',
    actions: {
      view: { roles: ['admin'] },
      export: { roles: [], note: 'Deliberately not exposed: audit export is not implemented server-side.' }
    }
  },
  {
    key: 'settings',
    label: 'System Settings',
    enforcement: "routes/adminRoutes.js (requireRole('admin'))",
    actions: {
      view: { roles: ['admin'] },
      edit: { roles: ['admin'], note: 'Whitelisted keys only; secrets are never returned or editable.' }
    }
  },
  {
    key: 'notifications',
    label: 'Notifications',
    enforcement: 'controllers/notificationController.js',
    actions: {
      view: { roles: ['citizen', 'admin', 'emergency_department_head', 'emergency_department_officer', 'emergency_officer', 'emergency_field_worker', 'department_head', 'department_officer', 'officer', 'field_worker'], scoped: true },
      edit: { roles: ['citizen', 'admin', 'emergency_department_head', 'emergency_department_officer', 'emergency_officer', 'emergency_field_worker', 'department_head', 'department_officer', 'officer', 'field_worker'], scoped: true, note: 'Read or delete your own notifications only.' }
    }
  }
];

/** Utility used by the API: does `role` hold `action` on `resource`? */
export function can(role, resourceKey, action) {
  const resource = permissionMatrix.find((item) => item.key === resourceKey);
  if (!resource) return false;
  return Boolean(resource.actions[action]?.roles?.includes(role));
}
