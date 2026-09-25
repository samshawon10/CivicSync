/**
 * Action Registry (task §10).
 *
 * Defines the state-changing actions the AI model is allowed to PROPOSE.
 * In accordance with CivicSync safety architecture:
 *  - The model NEVER executes an action directly.
 *  - Actions return type: "action_confirmation" with an explanation and payload.
 *  - When the user confirms, the Action Executor verifies RBAC, scopes, and executes.
 *  - High-risk operations (dispatching responders, modifying users/permissions,
 *    deleting records, resolving emergencies) are prohibited from the AI action catalog.
 */
import { AiError } from '../errors.js';
import { TOOL_RISK } from '../tools/toolRegistry.js';
import { roleOrder } from '../../config/permissions.js';
import { validateToolInput } from '../tools/schemaValidator.js';

export const ACTION_NAMES = Object.freeze({
  createReport: 'createReport',
  markAllNotificationsRead: 'markAllNotificationsRead',
  saveCommunityDraft: 'saveCommunityDraft'
});

export const actions = [
  {
    name: ACTION_NAMES.createReport,
    label: 'Submit Civic Report',
    description: 'Submit an official civic case report to the designated department.',
    risk: TOOL_RISK.write,
    roles: ['citizen'],
    path: '/dashboard/citizen/reports',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['title', 'description', 'category'],
      properties: {
        title: { type: 'string', minLength: 5, maxLength: 140 },
        description: { type: 'string', minLength: 10, maxLength: 2000 },
        category: { type: 'string', minLength: 2, maxLength: 60 },
        departmentName: { type: 'string', maxLength: 100 },
        priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] }
      }
    }
  },
  {
    name: ACTION_NAMES.markAllNotificationsRead,
    label: 'Mark All Notifications As Read',
    description: 'Mark all unread notifications in your inbox as read.',
    risk: TOOL_RISK.write,
    roles: roleOrder,
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {}
    }
  },
  {
    name: ACTION_NAMES.saveCommunityDraft,
    label: 'Save Community Discussion Draft',
    description: 'Save a draft post to your personal community drafts.',
    risk: TOOL_RISK.write,
    roles: roleOrder,
    path: '/dashboard/citizen/community',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['content'],
      properties: {
        content: { type: 'string', minLength: 1, maxLength: 5000 },
        category: { type: 'string', maxLength: 50 },
        area: { type: 'string', maxLength: 100 }
      }
    }
  }
];

const actionMap = new Map(actions.map((act) => [act.name, act]));

/** Validates whether an action exists and matches its schema for the output validator. */
export function validateAction(name, payload = {}) {
  const act = actionMap.get(name);
  if (!act) return { ok: false, message: `Unknown CivicSync action: ${name}` };
  if (act.inputSchema) {
    const check = validateToolInput(payload, act.inputSchema);
    if (!check.ok) {
      return { ok: false, message: `Invalid parameters for ${name}: ${check.errors.join('; ')}` };
    }
  }
  return { ok: true, action: act };
}

export function getAction(name) {
  return actionMap.get(name) || null;
}

export function listAuthorizedActions(role) {
  return actions
    .filter((act) => act.roles.includes(role))
    .map((act) => act.name);
}

