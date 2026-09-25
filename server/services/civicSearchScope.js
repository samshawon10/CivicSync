/**
 * CivicSync Global CivicSearch — authorization + scoping rules.
 *
 * Pure functions only (no database access) so the permission rules can be
 * unit-tested directly: see civicSearchScope.test.js. The executor in
 * `services/civicSearch.js` translates these descriptors into Mongo filters.
 *
 * Security contract: a category is only offered when the role may see it, and
 * every category carries a scope descriptor that limits rows to data the role
 * owns. The search endpoint never falls back to "search everything".
 */
import { emergencyRoleGroups } from '../config/emergencyOptions.js';

/** Civic department staff (see controllers/reportController.js `staffRoles`). */
export const civicStaffRoles = ['department_head', 'department_officer', 'officer', 'field_worker'];
/** Emergency staff (see controllers/emergencyController.js `staffRoles`). */
export const emergencyRoles = emergencyRoleGroups.allStaff;
/** Emergency command roles (see controllers/emergencyController.js `commandRoles`). */
export const emergencyCommandRoles = emergencyRoleGroups.command;

/** Scope descriptors understood by services/civicSearch.js. */
export const scope = {
  all: () => ({ kind: 'all' }),
  none: () => ({ kind: 'none' }),
  owner: (field, user) => ({ kind: 'owner', field, userId: user?._id }),
  department: (field, user) => ({ kind: 'department', field, departmentName: user?.departmentName || '' }),
  /** Rows where `field` points at the viewer (field worker assignments). */
  assigned: (field, user) => ({ kind: 'assigned', field, userId: user?._id }),
  /** Emergencies the viewer reports, heads, or is dispatched to. */
  emergencyParticipant: (user) => ({ kind: 'emergencyParticipant', userId: user?._id })
};

const allStaffRoles = ['citizen', 'admin', ...civicStaffRoles, ...emergencyRoles];
const commandOrAdmin = (user) => emergencyCommandRoles.includes(user?.role);

/** Category catalogue. See `roles` (may search?) and `scopeFor` (which rows?). */
export const searchCategories = {
  cases: {
    label: 'Civic Cases',
    icon: 'clipboardList',
    path: '/dashboard/citizen/reports',
    roles: [...civicStaffRoles, 'citizen', 'admin'],
    scopeFor: (user) => (user.role === 'citizen' ? scope.owner('createdBy', user)
      : user.role === 'field_worker' ? scope.assigned('assignedFieldWorker', user)
        : user.role === 'admin' ? scope.all()
          : scope.department('departmentName', user))
  },
  community: {
    label: 'Community',
    icon: 'users',
    path: '/dashboard/citizen/community',
    roles: [...civicStaffRoles, 'citizen', 'admin'],
    scopeFor: (user) => (user.role === 'admin' ? scope.all() : { kind: 'communityVisible', userId: user._id })
  },
  emergencies: {
    label: 'Emergencies',
    icon: 'siren',
    path: '/dashboard/citizen/emergency',
    roles: [...emergencyRoles, 'admin'],
    scopeFor: (user) => (commandOrAdmin(user) ? scope.all() : scope.emergencyParticipant(user))
  },
  facilities: {
    label: 'Facilities',
    icon: 'hospital',
    path: '/dashboard/citizen/nearby-services',
    roles: allStaffRoles,
    scopeFor: () => ({ kind: 'all', activeOnly: true })
  },
  alerts: {
    label: 'Safety Alerts',
    icon: 'megaphone',
    path: '/dashboard/citizen/alerts',
    roles: allStaffRoles,
    scopeFor: (user) => (commandOrAdmin(user) ? scope.all() : { kind: 'all', activeOnly: true })
  },
  directory: {
    label: 'Civic Directory',
    icon: 'building',
    path: '/dashboard/citizen/nearby-services',
    roles: allStaffRoles,
    scopeFor: () => ({ kind: 'all', activeOnly: true })
  },
  resources: {
    label: 'Department Resources',
    icon: 'layers',
    path: '/dashboard/department-head',
    roles: ['admin', ...civicStaffRoles],
    scopeFor: (user) => (user.role === 'admin' ? scope.all() : scope.department('departmentName', user))
  },
  tasks: {
    label: 'Field Tasks',
    icon: 'route',
    path: '/dashboard/field-worker',
    roles: ['admin', ...civicStaffRoles],
    scopeFor: (user) => (user.role === 'admin' ? scope.all()
      : user.role === 'field_worker' ? scope.assigned('assignedWorker', user)
        : scope.department('departmentName', user))
  },
  teams: {
    label: 'Response Teams',
    icon: 'route',
    path: '/dashboard/emergency-head',
    roles: ['admin', 'emergency_department_head', 'emergency_department_officer', 'emergency_officer'],
    scopeFor: () => scope.all()
  },
  contacts: {
    label: 'Emergency Contacts',
    icon: 'phone',
    path: '/dashboard/citizen/emergency-contacts',
    roles: ['citizen'],
    scopeFor: (user) => scope.owner('citizen', user)
  },
  citizens: {
    label: 'Citizen Accounts',
    icon: 'users',
    path: '/admin/users',
    roles: ['admin'],
    scopeFor: () => scope.all()
  },
  audit: {
    label: 'Audit Events',
    icon: 'scroll',
    path: '/admin/audit-logs',
    roles: ['admin'],
    scopeFor: () => scope.all()
  }
};

export const searchCategoryIds = Object.keys(searchCategories);

/** Does `role` hold any searchable category? */
export function canSearch(role) {
  return searchCategoryIds.some((key) => searchCategories[key].roles.includes(role));
}

/** Categories offered to a role, in catalogue order. */
export function visibleCategories(user) {
  const role = user?.role;
  if (!role) return [];
  return searchCategoryIds.filter((key) => searchCategories[key].roles.includes(role));
}

/**
 * Resolves requested categories to the ones the role may actually use.
 * Unknown or unauthorized keys are dropped — never widened to "all".
 */
export function resolveCategories(user, requested = []) {
  const allowed = visibleCategories(user);
  const normalized = (requested || []).map((value) => String(value || '').trim()).filter(Boolean);
  if (!normalized.length) return allowed;
  return allowed.filter((key) => normalized.includes(key));
}

/**
 * True when a category's rows may expose contact/identity detail to the role.
 * Operational categories (citizen accounts, audit trail) and restricted
 * emergencies are always treated as non-public.
 */
export function isCategoryPublic(role, category) {
  if (category === 'emergencies') return emergencyRoles.includes(role);
  if (category === 'audit' || category === 'citizens') return false;
  return true;
}
