/**
 * Global CivicSearch executor.
 *
 * Translates the scope descriptors from `civicSearchScope.js` into Mongo
 * filters and runs one bounded query per authorized category. Every query is
 * built from a role-scoped match: a category whose scope cannot be resolved
 * (for example a department user with no department) returns no rows instead of
 * falling back to an unscoped search.
 *
 * Result shape matches the Super Admin command palette contract
 * ({ groups: [{ key, label, items: [{ id, title, subtitle, tone, icon, path }] }] }),
 * so the palette and the citizen/field search overlay share one implementation.
 */
import Report from '../models/Report.js';
import CommunityPost from '../models/CommunityPost.js';
import Emergency from '../models/Emergency.js';
import EmergencyResponseAssignment from '../models/EmergencyResponseAssignment.js';
import SafetyFacility from '../models/SafetyFacility.js';
import EmergencyAlert from '../models/EmergencyAlert.js';
import Department from '../models/Department.js';
import DepartmentResource from '../models/DepartmentResource.js';
import DepartmentTask from '../models/DepartmentTask.js';
import ResponseTeam from '../models/ResponseTeam.js';
import EmergencyContact from '../models/EmergencyContact.js';
import User from '../models/User.js';
import ActivityLog from '../models/ActivityLog.js';
import { roleMeta } from '../config/permissions.js';
import { resolveCategories, searchCategories } from './civicSearchScope.js';

const PER_CATEGORY = 5;
const escapeRegex = (value = '') => String(value).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const labelize = (value = '') => String(value || '').replaceAll('_', ' ');
const tone = (value) => (value === 'critical' || value === 'urgent' ? 'critical' : value === 'high' ? 'high' : 'neutral');

/** Resolves a scope descriptor to a Mongo match, or null when it cannot be scoped. */
async function matchFor(key, user) {
  const descriptor = searchCategories[key].scopeFor(user);
  if (descriptor.kind === 'none') return null;
  if (descriptor.kind === 'all') return {};
  if (descriptor.kind === 'owner' || descriptor.kind === 'assigned') return { [descriptor.field]: descriptor.userId };
  if (descriptor.kind === 'department') return descriptor.departmentName ? { [descriptor.field]: descriptor.departmentName } : null;
  if (descriptor.kind === 'emergencyParticipant') {
    const assignmentIds = await EmergencyResponseAssignment.find({ $or: [{ emergencyOfficer: descriptor.userId }, { fieldWorkers: descriptor.userId }] }).distinct('_id');
    return { $or: [{ citizen: descriptor.userId }, { emergencyHead: descriptor.userId }, { responseAssignments: { $in: assignmentIds } }] };
  }
  if (descriptor.kind === 'communityVisible') {
    return { status: 'published', $or: [{ visibility: { $in: ['public', 'community'] } }, { author: descriptor.userId }] };
  }
  return null;
}

/** One bounded query. Returns [] when the scope is unusable (never unscoped). */
async function run(model, match, search, select, sort, toItem, limit) {
  if (!match) return [];
  const rows = await model.find({ ...match, ...search }).select(select).sort(sort).limit(limit).lean();
  return rows.map(toItem);
}

const staffHome = {
  department_head: '/dashboard/department-head',
  department_officer: '/dashboard/department-officer',
  officer: '/dashboard/officer',
  field_worker: '/dashboard/field-worker'
};
const casePath = (user, id) => (user.role === 'citizen' ? `/dashboard/citizen/reports/${id}` : staffHome[user.role] || '/dashboard/citizen/reports');

/**
 * Super Admin destinations. Admin results keep the exact deep-links the
 * previous /admin/search implementation used, so the command palette behaves
 * the same for the same records.
 */
const adminPath = (key, id) => ({
  cases: '/admin/complaints',
  community: '/admin/command-center',
  emergencies: `/admin/emergencies?focus=${id}`,
  facilities: `/admin/facilities?focus=${id}`,
  alerts: `/admin/alerts?focus=${id}`,
  directory: '/admin/departments',
  resources: '/admin/departments',
  tasks: '/admin/department-analytics',
  teams: `/admin/response-teams?focus=${id}`,
  citizens: `/admin/users?user=${id}`,
  audit: `/admin/audit-logs?focus=${id}`
}[key]);

/** One runner per authorized category. Never called for an unauthorized one. */
const runners = {
  cases: async (re, user, limit) => run(Report, await matchFor('cases', user),
    { $or: [{ title: re }, { description: re }, { departmentName: re }, { category: re }, { 'location.area': re }, { 'location.address': re }] },
    'title status priority departmentName category location createdAt',
    { createdAt: -1 },
    (row) => ({
      id: row._id,
      title: row.title,
      subtitle: `${labelize(row.status)} · ${row.departmentName} · ${labelize(row.priority)}${row.location?.area ? ` · ${row.location.area}` : ''}`,
      tone: tone(row.priority),
      icon: 'clipboardList',
      path: casePath(user, row._id)
    }), limit),

  community: async (re, user, limit) => run(CommunityPost, await matchFor('community', user),
    { $or: [{ content: re }, { hashtags: re }, { 'location.area': re }, { category: re }] },
    'content category hashtags location visibility createdAt',
    { createdAt: -1 },
    (row) => ({
      id: row._id,
      title: row.content ? `${row.content.slice(0, 70)}${row.content.length > 70 ? '…' : ''}` : 'Media post',
      subtitle: `${labelize(row.category)}${row.location?.area ? ` · ${row.location.area}` : ''}${row.visibility === 'community' ? ' · community' : ''}`,
      tone: 'neutral',
      icon: 'users',
      path: '/dashboard/citizen/community'
    }), limit),

  emergencies: async (re, user, limit) => run(Emergency, await matchFor('emergencies', user),
    { $or: [{ emergencyId: re }, { title: re }, { category: re }, { status: re }, { 'location.address': re }] },
    'emergencyId title category severity status visibility createdAt',
    { createdAt: -1 },
    (row) => ({
      id: row._id,
      title: `${row.emergencyId || 'Unnumbered'} · ${row.title}`,
      subtitle: `${labelize(row.category)} · ${row.severity} · ${labelize(row.status)}${row.visibility === 'restricted' ? ' · Restricted (location withheld)' : ''}`,
      tone: tone(row.severity),
      icon: 'siren',
      path: '/dashboard/citizen/emergency'
    }), limit),

  facilities: async (re, user, limit) => run(SafetyFacility, (await matchFor('facilities', user)) || {},
    { $or: [{ name: re }, { type: re }, { address: re }, { description: re }] },
    'name type address status available active openingHours phone',
    { name: 1 },
    (row) => ({
      id: row._id,
      title: row.name,
      subtitle: `${labelize(row.type)} · ${row.status}${row.address ? ` · ${row.address}` : ''}`,
      tone: row.status === 'offline' ? 'critical' : row.status === 'degraded' ? 'high' : 'neutral',
      icon: 'hospital',
      path: '/dashboard/citizen/nearby-services'
    }), limit),

  alerts: async (re, user, limit) => run(EmergencyAlert, (await matchFor('alerts', user)) || {},
    { $or: [{ title: re }, { message: re }, { category: re }, { affectedArea: re }] },
    'title message category severity status active affectedArea endAt createdAt',
    { createdAt: -1 },
    (row) => ({
      id: row._id,
      title: row.title,
      subtitle: `${labelize(row.category)} · ${row.severity} · ${row.active ? 'active' : 'expired'}${row.affectedArea ? ` · ${row.affectedArea}` : ''}`,
      tone: tone(row.severity),
      icon: 'megaphone',
      path: '/dashboard/citizen/alerts'
    }), limit),

  directory: async (re, user, limit) => run(Department, (await matchFor('directory', user)) || {},
    { $or: [{ name: re }, { type: re }, { description: re }, { address: re }, { contactNumber: re }, { email: re }] },
    'name type description address contactNumber email status scope',
    { name: 1 },
    (row) => ({
      id: row._id,
      title: row.name,
      subtitle: `${row.type || row.scope} · ${row.address || 'address not recorded'}${row.contactNumber ? ` · ${row.contactNumber}` : ''}`,
      tone: 'neutral',
      icon: 'building',
      path: '/dashboard/citizen/nearby-services'
    }), limit),

  resources: async (re, user, limit) => run(DepartmentResource, await matchFor('resources', user),
    { $or: [{ name: re }, { type: re }, { identifier: re }, { departmentName: re }] },
    'name type identifier status departmentName capacityOrQuantity',
    { name: 1 },
    (row) => ({
      id: row._id,
      title: row.name,
      subtitle: `${labelize(row.type)} · ${labelize(row.status)} · ${row.departmentName}`,
      tone: row.status === 'unavailable' ? 'critical' : row.status === 'available' ? 'success' : 'info',
      icon: 'layers',
      path: staffHome[user.role] || '/dashboard/department-head'
    }), limit),

  tasks: async (re, user, limit) => run(DepartmentTask, await matchFor('tasks', user),
    { $or: [{ title: re }, { taskNumber: re }, { description: re }, { departmentName: re }] },
    'title taskNumber status priority departmentName dueAt',
    { updatedAt: -1 },
    (row) => ({
      id: row._id,
      title: row.taskNumber ? `${row.taskNumber} · ${row.title}` : row.title,
      subtitle: `${labelize(row.status)} · ${labelize(row.priority)} · ${row.departmentName}`,
      tone: tone(row.priority),
      icon: 'route',
      path: staffHome[user.role] || '/dashboard/field-worker'
    }), limit),

  teams: async (re, user, limit) => run(ResponseTeam, await matchFor('teams', user),
    { $or: [{ name: re }, { type: re }, { 'baseLocation.address': re }] },
    'name type availability active baseLocation phone',
    { name: 1 },
    (row) => ({
      id: row._id,
      title: row.name,
      subtitle: `${labelize(row.type)} · ${row.active === false ? 'archived' : row.availability}${row.baseLocation?.address ? ` · ${row.baseLocation.address}` : ''}`,
      tone: row.active === false ? 'muted' : row.availability === 'available' ? 'success' : 'info',
      icon: 'route',
      path: '/dashboard/emergency-head'
    }), limit),

  contacts: async (re, user, limit) => run(EmergencyContact, await matchFor('contacts', user),
    { $or: [{ name: re }, { phone: re }] },
    'name phone relationship',
    { name: 1 },
    (row) => ({
      id: row._id,
      title: row.name,
      subtitle: `${row.relationship || 'contact'} · ${row.phone || 'no number'}`,
      tone: 'neutral',
      icon: 'phone',
      path: '/dashboard/citizen/emergency-contacts'
    }), limit),

  citizens: async (re, user, limit) => run(User, await matchFor('citizens', user),
    { role: 'citizen', $or: [{ name: re }, { email: re }, { phone: re }] },
    'name email phone role status createdAt',
    { name: 1 },
    (row) => ({
      id: row._id,
      title: row.name,
      subtitle: `${row.email} · ${roleMeta[row.role]?.label || row.role}${row.status === 'suspended' ? ' · Suspended' : ''}`,
      tone: row.status === 'suspended' ? 'critical' : 'neutral',
      icon: 'user',
      path: `/admin/users?user=${row._id}`
    }), limit),

  audit: async (re, user, limit) => run(ActivityLog, await matchFor('audit', user),
    { $or: [{ action: re }, { description: re }, { targetName: re }, { targetType: re }] },
    'action targetType targetName description actorRole result createdAt',
    { createdAt: -1 },
    (row) => ({
      id: row._id,
      title: labelize(row.action),
      subtitle: `${row.description || row.targetName || labelize(row.targetType)} · ${new Date(row.createdAt).toLocaleString()}`,
      tone: row.result === 'failure' ? 'critical' : 'neutral',
      icon: 'scroll',
      path: `/admin/audit-logs?focus=${row._id}`
    }), limit)
};

/**
 * Runs a permission-scoped, categorized search for one user.
 * @returns {{ query: string, categories: string[], groups: Array, total: number, took: number }}
 */
export async function searchForUser({ user, query, categories = [], limit = PER_CATEGORY }) {
  const startedAt = Date.now();
  const text = String(query || '').trim();
  const allowed = resolveCategories(user, categories);
  if (text.length < 2 || !allowed.length) return { query: text, categories: allowed, groups: [], total: 0, took: 0 };

  const expression = new RegExp(escapeRegex(text), 'i');
  const perCategory = Math.min(Math.max(Number(limit) || PER_CATEGORY, 1), 10);
  const settled = await Promise.all(allowed.map(async (key) => {
    try {
      return [key, await runners[key](expression, user, perCategory)];
    } catch {
      // A failing category must never break the whole search.
      return [key, []];
    }
  }));

  const groups = settled
    .map(([key, items]) => ({
      key,
      label: searchCategories[key].label,
      icon: searchCategories[key].icon,
      items: user.role === 'admin' ? items.map((item) => ({ ...item, path: adminPath(key, item.id) || item.path })) : items
    }))
    .filter((group) => group.items.length);

  return { query: text, categories: allowed, groups, total: groups.reduce((sum, group) => sum + group.items.length, 0), took: Date.now() - startedAt };
}

/** Short suggestions for the search box (titles only, still role-scoped). */
export async function suggestForUser({ user, query }) {
  const { groups } = await searchForUser({ user, query, limit: 3 });
  return groups.flatMap((group) => group.items.map((item) => ({ text: item.title, category: group.label, key: group.key, id: item.id }))).slice(0, 8);
}
