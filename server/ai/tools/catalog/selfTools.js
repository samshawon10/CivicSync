/**
 * Self-service tools (task §7). Read-only.
 *
 * `getNotifications` and `getMyProfile` are strictly self-scoped: they take the
 * user from the authenticated request and never accept an id argument, so a
 * prompt can never turn them into a way to read someone else's data.
 */
import Notification from '../../../models/Notification.js';
import User from '../../../models/User.js';
import { departmentSlaTargets } from '../../../services/departmentSla.js';
import { roleMeta } from '../../../config/permissions.js';
import { TOOL_RISK } from '../toolRegistry.js';
import { notificationsPath } from '../paths.js';

export const selfTools = [
  {
    name: 'getNotifications',
    category: 'self',
    risk: TOOL_RISK.read,
    description: 'The signed-in user\'s own recent notifications, newest first.',
    inputs: 'limit?:number, unreadOnly?:boolean',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: { limit: { type: 'integer', minimum: 1, maximum: 50 }, unreadOnly: { type: 'boolean' } }
    },
    roles: ['citizen', 'admin', 'department_head', 'department_officer', 'officer', 'field_worker', 'emergency_department_head', 'emergency_department_officer', 'emergency_officer', 'emergency_field_worker'],
    async handler({ user, input }) {
      const filter = { recipient: user._id };
      if (input.unreadOnly) filter.readAt = null;
      const rows = await Notification.find(filter)
        .select('message type relatedType relatedId readAt createdAt')
        .sort({ createdAt: -1 })
        .limit(Math.min(Number(input.limit) || 10, 50))
        .lean();
      return {
        data: {
          notifications: rows.map((row) => ({ id: String(row._id), message: row.message, type: row.type, relatedType: row.relatedType, read: Boolean(row.readAt), at: row.createdAt })),
          unreadCount: rows.filter((row) => !row.readAt).length,
          note: rows.length ? undefined : 'There are no notifications to show for this account.'
        },
        citations: rows.slice(0, 5).map((row) => ({ type: 'notification', id: String(row._id), label: String(row.message).slice(0, 80), path: notificationsPath(user) }))
      };
    }
  },
  {
    name: 'getMyProfile',
    category: 'self',
    risk: TOOL_RISK.read,
    description: 'The signed-in user\'s own CivicSync profile: name, role, department and what that role may do in the platform.',
    inputs: '(none)',
    inputSchema: { type: 'object', additionalProperties: false, properties: {} },
    roles: ['citizen', 'admin', 'department_head', 'department_officer', 'officer', 'field_worker', 'emergency_department_head', 'emergency_department_officer', 'emergency_officer', 'emergency_field_worker'],
    async handler({ user }) {
      const row = await User.findById(user._id).select('name email role departmentName status emailVerified createdAt preferences').lean();
      if (!row) return { data: null, note: 'This account could not be re-read from CivicSync.' };
      return {
        data: {
          id: String(row._id),
          name: row.name,
          email: row.email,
          role: row.role,
          roleLabel: roleMeta[row.role]?.label || row.role,
          roleDescription: roleMeta[row.role]?.description || '',
          department: row.departmentName || null,
          status: row.status,
          emailVerified: Boolean(row.emailVerified),
          memberSince: row.createdAt,
          notificationPreference: row.preferences?.emailNotifications ?? true,
          slaTargetsMinutes: departmentSlaTargets
        },
        citations: [{ type: 'profile', id: String(row._id), label: `${row.name} · ${roleMeta[row.role]?.label || row.role}` }]
      };
    }
  }
];
