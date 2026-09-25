/**
 * AI audit trail (task §27, §32).
 *
 * CivicSync already owns one audit system: models/ActivityLog.js, written by the
 * Super Admin, department and emergency flows. The AI platform therefore records
 * into that same collection instead of introducing a second, competing trail.
 *
 * `targetType: 'system'` is used with explicit `ai_*` action names so the AI
 * trail is filterable in the existing audit screens without schema changes.
 * Nothing here can throw into a request path: audit failures are swallowed and
 * reported through the returned boolean.
 */
import ActivityLog from '../../models/ActivityLog.js';
import { redactSecrets } from './promptSafety.js';

/** Action names reserved for the AI platform. */
export const AI_AUDIT_ACTIONS = Object.freeze({
  request: 'ai_request',
  toolExecuted: 'ai_tool_executed',
  toolDenied: 'ai_tool_denied',
  actionPrepared: 'ai_action_prepared',
  actionConfirmed: 'ai_action_confirmed',
  actionRejected: 'ai_action_rejected',
  actionExecuted: 'ai_action_executed',
  actionDelegated: 'ai_action_delegated',
  rateLimited: 'ai_rate_limited',
  injectionBlocked: 'ai_prompt_injection_detected',
  providerFailure: 'ai_provider_failure',
  feedback: 'ai_feedback'
});

/**
 * Writes one AI audit row.
 *
 * @param {{ user?: object, action: string, targetType?: string, targetId?: unknown, targetName?: string, description?: string, metadata?: object, result?: 'success'|'failure'|'info' }} entry
 */
export async function auditAi(entry = {}) {
  const { user, action, targetType = 'system', targetId = null, targetName = '', description = '', metadata = {}, result = 'info' } = entry;
  if (!user?._id || !action) return false;
  try {
    await ActivityLog.create({
      admin: user._id,
      actorRole: user.role || '',
      action: String(action).slice(0, 100),
      targetType,
      // ActivityLog requires a targetId; the AI trail points at the actor when
      // the event has no domain record (e.g. a rate-limit rejection).
      targetId: targetId || user._id,
      targetName: String(targetName || '').slice(0, 200),
      description: String(description || '').slice(0, 500),
      // Secrets can never reach the audit trail, even if a caller passes them.
      metadata: redactSecrets(metadata || {}),
      result
    });
    return true;
  } catch {
    return false;
  }
}

/** Records a tool authorization refusal. Denials are always audited as failures. */
export function auditToolDenied(user, toolName, reason) {
  return auditAi({
    user,
    action: AI_AUDIT_ACTIONS.toolDenied,
    description: `AI capability "${toolName}" was refused`,
    metadata: { tool: toolName, reason },
    result: 'failure'
  });
}
