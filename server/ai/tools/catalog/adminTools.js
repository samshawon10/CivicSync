/**
 * Super Admin platform tools (task §7). Read-only, admin-only.
 *
 * Every handler wraps the EXISTING admin controller (see tools/controllerBridge.js)
 * so the assistant explains exactly the numbers the Command Center shows. The AI
 * never mutates platform state: role changes, settings, deletions and permission
 * edits remain privileged screens (§36).
 */
import { getAnalytics, getDashboardStats, listActivityLogs } from '../../../controllers/adminController.js';
import { getGovernanceOverview, getOperationsAnalytics, getSystemHealth } from '../../../controllers/adminGovernanceController.js';
import { TOOL_RISK } from '../toolRegistry.js';
import { requireJson } from '../controllerBridge.js';
import { auditPath, homePathFor } from '../paths.js';

const RANGES = ['7d', '30d', '3m', '6m', '1y'];

export const adminTools = [
  {
    name: 'getPlatformAnalytics',
    category: 'platform',
    risk: TOOL_RISK.read,
    description: 'Platform-wide civic analytics for a time range: case status distribution, category mix, department performance and emergency response time.',
    inputs: 'range?:string',
    inputSchema: { type: 'object', additionalProperties: false, properties: { range: { type: 'string', enum: RANGES } } },
    roles: ['admin'],
    permission: { resource: 'analytics', action: 'view' },
    async handler({ user, input }) {
      const payload = await requireJson(getAnalytics, { user, query: { range: input.range || '30d' } });
      return { data: { range: input.range || '30d', analytics: payload?.analytics || null, note: 'Served by the existing CivicSync analytics endpoint.' }, citations: [] };
    }
  },
  {
    name: 'getPlatformOverview',
    category: 'platform',
    risk: TOOL_RISK.read,
    description: 'Platform KPI cards: user/role counts, case totals by status, emergency totals, resolution rate and department performance.',
    inputs: 'range?:string',
    inputSchema: { type: 'object', additionalProperties: false, properties: { range: { type: 'string', enum: RANGES } } },
    roles: ['admin'],
    permission: { resource: 'analytics', action: 'view' },
    async handler({ user, input }) {
      const payload = await requireJson(getDashboardStats, { user, query: { range: input.range || '30d' } });
      const dashboard = payload?.dashboard || {};
      return {
        data: {
          range: input.range || '30d',
          cards: dashboard.cards || null,
          roleCounts: dashboard.roleCounts || null,
          changes: dashboard.changes || null,
          resolutionRate: dashboard.resolutionRate ?? null,
          departmentPerformance: dashboard.departmentPerformance || [],
          note: dashboard.cards ? undefined : 'The platform returned no dashboard payload.'
        },
        citations: []
      };
    }
  },
  {
    name: 'getSystemHealth',
    category: 'platform',
    risk: TOOL_RISK.read,
    description: 'Observable CivicSync infrastructure checks (database, realtime, storage, AI provider reachability) exactly as the platform reports them.',
    inputs: '(none)',
    inputSchema: { type: 'object', additionalProperties: false, properties: {} },
    roles: ['admin'],
    permission: { resource: 'settings', action: 'view' },
    async handler({ user }) {
      const payload = await requireJson(getSystemHealth, { user });
      return {
        data: {
          checks: payload?.checks || [],
          summary: payload?.summary || null,
          checkedAt: payload?.checkedAt || null,
          note: 'Unobservable subsystems are reported as not monitored rather than assumed healthy.'
        },
        citations: []
      };
    }
  },
  {
    name: 'getOperationsAnalytics',
    category: 'platform',
    risk: TOOL_RISK.read,
    description: 'Operations analytics across cases, teams, tasks and emergency assignments, including feature-flag state.',
    inputs: '(none)',
    inputSchema: { type: 'object', additionalProperties: false, properties: {} },
    roles: ['admin'],
    permission: { resource: 'analytics', action: 'view' },
    async handler({ user }) {
      const payload = await requireJson(getOperationsAnalytics, { user });
      return { data: { operations: payload?.operations || payload || null, note: 'Served by the existing operations analytics endpoint.' }, citations: [] };
    }
  },
  {
    name: 'getGovernanceOverview',
    category: 'platform',
    risk: TOOL_RISK.read,
    description: 'Governance overview: account and department health, moderation and configuration signals for the selected range.',
    inputs: 'range?:string',
    inputSchema: { type: 'object', additionalProperties: false, properties: { range: { type: 'string', enum: RANGES } } },
    roles: ['admin'],
    permission: { resource: 'settings', action: 'view' },
    async handler({ user, input }) {
      const payload = await requireJson(getGovernanceOverview, { user, query: { range: input.range || '30d' } });
      return { data: { governance: payload?.governance || payload || null, range: input.range || '30d' }, citations: [] };
    }
  },
  {
    name: 'getAuditSummary',
    category: 'platform',
    risk: TOOL_RISK.read,
    description: 'Recent platform audit/activity entries, optionally filtered by action or target type, for an honest summary of what happened.',
    inputs: 'action?:string, targetType?:string, limit?:number',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        action: { type: 'string', maxLength: 60 },
        targetType: { type: 'string', maxLength: 40 },
        limit: { type: 'integer', minimum: 1, maximum: 30 }
      }
    },
    roles: ['admin'],
    permission: { resource: 'audit', action: 'view' },
    async handler({ user, input }) {
      const payload = await requireJson(listActivityLogs, { user, query: { action: input.action || '', targetType: input.targetType || '', limit: Math.min(Number(input.limit) || 15, 30) } });
      const logs = payload?.logs || payload?.activity || [];
      return {
        data: {
          entries: logs.map((row) => ({ action: row.action, actorRole: row.actorRole || null, targetType: row.targetType, targetName: row.targetName || '', description: row.description || '', result: row.result, at: row.createdAt })),
          note: logs.length ? undefined : 'No audit entry matches that filter.'
        },
        citations: logs.slice(0, 5).map((row) => ({ type: 'audit', id: String(row._id), label: `${row.action} · ${row.targetName || row.targetType}`, path: auditPath() }))
      };
    }
  },
  {
    name: 'getMyAdminDestinations',
    category: 'platform',
    risk: TOOL_RISK.read,
    description: 'Authorized Super Admin destinations for the operations the assistant refuses to perform itself.',
    inputs: '(none)',
    inputSchema: { type: 'object', additionalProperties: false, properties: {} },
    roles: ['admin'],
    async handler({ user }) {
      return {
        data: {
          home: homePathFor(user),
          destinations: [
            { label: 'Users & roles', path: '/admin/users' },
            { label: 'Departments', path: '/admin/departments' },
            { label: 'Emergency command', path: '/admin/emergencies' },
            { label: 'Service catalogue', path: '/admin/services' },
            { label: 'Audit logs', path: '/admin/audit-logs' },
            { label: 'System settings', path: '/admin/settings' },
            { label: 'Roles & permissions', path: '/admin/permissions' }
          ],
          note: 'Privileged changes are performed by the administrator on these screens, not by the assistant.'
        },
        citations: []
      };
    }
  }

];
