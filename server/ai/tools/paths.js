/**
 * Deep links for AI citations.
 *
 * Only routes that actually exist in the SPA are produced. Department, emergency
 * command and admin workspaces open records from in-page state rather than a URL
 * parameter, so those citations carry no path and the client renders them as
 * plain references instead of a broken link.
 */

export const dashboardHome = Object.freeze({
  citizen: '/dashboard/citizen',
  department_head: '/dashboard/department-head',
  department_officer: '/dashboard/department-officer',
  officer: '/dashboard/officer',
  field_worker: '/dashboard/field-worker',
  emergency_department_head: '/dashboard/emergency-head',
  emergency_department_officer: '/dashboard/emergency-officer',
  emergency_officer: '/dashboard/emergency-officer',
  emergency_field_worker: '/dashboard/emergency-field-worker',
  admin: '/admin/dashboard'
});

export const homePathFor = (user) => dashboardHome[user?.role] || '/dashboard';

/** Citizen case detail is a real route; staff workspaces are not. */
export function casePath(user, id) {
  if (user?.role === 'citizen') return `/dashboard/citizen/reports/${id}`;
  return null;
}

/** Citizen emergency tracking is a real route. */
export function emergencyPath(user, id) {
  if (user?.role === 'citizen') return `/dashboard/citizen/emergency/${id}`;
  return null;
}

export const servicePath = () => '/dashboard/citizen/nearby-services';
export const facilityPath = () => '/dashboard/citizen/nearby-services';
export const directoryPath = () => '/dashboard/citizen/nearby-services';
export const alertPath = () => '/dashboard/citizen/alerts';
export const communityPath = () => '/dashboard/citizen/community';
export const notificationsPath = (user) => (user?.role === 'citizen' ? '/dashboard/citizen/notifications' : null);
export const serviceAdminPath = () => '/admin/services';
export const auditPath = () => '/admin/audit-logs';
