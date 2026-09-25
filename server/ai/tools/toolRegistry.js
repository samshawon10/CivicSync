/**
 * Tool Registry — the only way the AI layer may touch CivicSync data (task §8, §9).
 *
 * A tool declares:
 *   name, description, category, risk ('read' | 'write' | 'high_risk_write')
 *   inputSchema          — validated before execution (tools/schemaValidator.js)
 *   roles                — the existing CivicSync roles allowed to run it
 *   permission           — { resource, action } mapped onto config/permissions.js
 *   handler              — server code; the model never sees or supplies it
 *   confirmation         — required for write / high-risk tools
 *
 * The model may *request* a tool; only this registry decides whether the request
 * is allowed. An unknown or unauthorized tool is refused and audited, no matter
 * how confidently the model asked for it.
 */
import { AiError } from '../errors.js';
import { can, roleOrder } from '../../config/permissions.js';

/** Risk levels, in ascending order of consequence. */
export const TOOL_RISK = Object.freeze({ read: 'read', write: 'write', highRisk: 'high_risk_write' });

/** Tools that may never be auto-executed by the model or the SPA. */
export const HIGH_RISK_TOOL_NAMES = Object.freeze([]);

export function createToolRegistry(tools = []) {
  const byName = new Map();

  for (const tool of tools) {
    validateDefinition(tool);
    if (byName.has(tool.name)) throw new AiError('INVALID_TOOL', { message: `Duplicate AI tool name: ${tool.name}` });
    byName.set(tool.name, Object.freeze({ ...tool }));
  }

  function validateDefinition(tool) {
    const problems = [];
    if (!tool?.name || !/^[a-z][a-zA-Z0-9_]{2,48}$/.test(tool.name)) problems.push('name must be lowerCamelCase (3-48 chars)');
    if (!tool?.description || tool.description.length < 10) problems.push('description is required');
    if (!tool?.category) problems.push('category is required');
    if (!Object.values(TOOL_RISK).includes(tool?.risk)) problems.push('risk must be read, write or high_risk_write');
    if (typeof tool?.handler !== 'function') problems.push('handler is required');
    if (!Array.isArray(tool?.roles) || !tool.roles.length) problems.push('roles must list at least one CivicSync role');
    for (const role of tool?.roles || []) if (!roleOrder.includes(role)) problems.push(`unknown role: ${role}`);
    if (tool?.risk !== TOOL_RISK.read && tool?.confirmation !== true) problems.push('write tools must declare confirmation: true');
    if (problems.length) throw new AiError('INVALID_TOOL', { message: `AI tool "${tool?.name || 'unnamed'}" is invalid: ${problems.join('; ')}` });
  }

  const all = [...byName.values()];

  /** Tools the role may run, filtered by role + permission matrix. */
  function forRole(user) {
    if (!user?.role) return [];
    return all.filter((tool) => isAuthorized(user, tool).ok);
  }

  /**
   * Server-side authorization. Two independent checks must pass:
   *   1. the role allow-list declared on the tool,
   *   2. the platform permission matrix in config/permissions.js (when declared).
   */
  function isAuthorized(user, tool) {
    if (!user?.role) return { ok: false, reason: 'unauthenticated' };
    if (!tool) return { ok: false, reason: 'unknown_tool' };
    if (!tool.roles.includes(user.role)) return { ok: false, reason: 'role_not_permitted' };
    if (tool.permission?.resource) {
      const granted = can(user.role, tool.permission.resource, tool.permission.action || 'view');
      if (!granted) return { ok: false, reason: 'permission_matrix_denied' };
    }
    if (tool.requiresDepartment && !(user.departmentName || user.department?.name)) return { ok: false, reason: 'department_assignment_required' };
    return { ok: true, reason: null };
  }

  /** Looks up a tool the model named. Unknown names never resolve to a handler. */
  function get(name) {
    return byName.get(String(name || '').trim()) || null;
  }

  /** Capability list for the prompt + `/api/ai/capabilities`. */
  function describeFor(user) {
    const groups = {};
    for (const tool of forRole(user)) {
      groups[tool.category] = groups[tool.category] || [];
      groups[tool.category].push({ name: tool.name, description: tool.description, inputs: tool.inputs || '', risk: tool.risk });
    }
    return groups;
  }

  return { all, get, forRole, isAuthorized, describeFor, size: byName.size };
}
