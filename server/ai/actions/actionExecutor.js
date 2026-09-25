/**
 * Action Executor (task §10).
 *
 * Implements the Human-in-the-Loop state-changing action workflow for CivicSync AI:
 *  1. Propose action: Issue an action confirmation token stored in AiConfirmation with TTL.
 *  2. Confirm action: User approves with confirmation token.
 *     - Verifies token validity, expiration, and user ownership.
 *     - Enforces RBAC permissions against role.
 *     - Dispatches to the underlying domain service/model.
 *     - Records audit trail (ai.action.confirmed, ai.action.executed).
 *  3. Reject action: User declines with confirmation token.
 *     - Invalidates token.
 *     - Records audit trail (ai.action.rejected).
 */

import crypto from 'crypto';
import AiConfirmation from '../../models/AiConfirmation.js';
import Report from '../../models/Report.js';
import Notification from '../../models/Notification.js';
import CommunityDraft from '../../models/CommunityDraft.js';
import { getAction, validateAction, ACTION_NAMES } from './actionRegistry.js';
import { readAiConfig } from '../config/aiConfig.js';
import { auditAi, AI_AUDIT_ACTIONS } from '../security/audit.js';
import { AiError } from '../errors.js';
import { reportCategories, reportDepartments, reportPriorities } from '../../config/reportOptions.js';

/**
 * Creates and persists a pending action confirmation record for human-in-the-loop review.
 */
export async function createActionConfirmation({ user, actionName, payload = {}, explanation = '' }) {
  if (!user?._id) {
    throw new AiError('INVALID_STATE', { message: 'User context is required to prepare an action.' });
  }

  const action = getAction(actionName);
  if (!action) {
    throw new AiError('ACTION_NOT_PERMITTED', { message: `Action "${actionName}" is not registered.` });
  }

  if (!action.roles.includes(user.role)) {
    throw new AiError('ROLE_NOT_PERMITTED', {
      message: `Role "${user.role}" is not authorized to execute action "${actionName}".`
    });
  }

  const validation = validateAction(actionName, payload);
  if (!validation.ok) {
    throw new AiError('INVALID_TOOL_INPUT', { message: validation.message });
  }

  const config = readAiConfig();
  const ttlMinutes = config.confirmationTtlMinutes || 15;
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
  const token = crypto.randomBytes(24).toString('hex');

  await AiConfirmation.create({
    token,
    user: user._id,
    role: user.role,
    actionName,
    payload,
    explanation,
    status: 'pending',
    expiresAt
  });

  await auditAi({
    user,
    action: AI_AUDIT_ACTIONS.actionPrepared,
    targetType: 'system',
    targetId: user._id,
    targetName: action.label,
    description: `AI proposed action "${action.label}" requiring confirmation`,
    metadata: { actionName, payload, token: `${token.slice(0, 6)}...` },
    result: 'info'
  });

  return {
    token,
    actionName,
    label: action.label,
    risk: action.risk,
    payload,
    explanation,
    expiresAt
  };
}

/**
 * Confirms and executes an action previously prepared by the AI assistant.
 */
export async function confirmAction({ token, user }) {
  if (!token || typeof token !== 'string') {
    throw new AiError('INVALID_CONFIRMATION', { message: 'Confirmation token is required.' });
  }

  const record = await AiConfirmation.findOne({ token });
  if (!record) {
    throw new AiError('CONFIRMATION_EXPIRED', { message: 'Action confirmation token was not found or has expired.' });
  }

  if (String(record.user) !== String(user._id)) {
    throw new AiError('ROLE_NOT_PERMITTED', { message: 'You do not own this action confirmation token.' });
  }

  if (record.status !== 'pending') {
    throw new AiError('INVALID_STATE', { message: `This action confirmation has already been ${record.status}.` });
  }

  if (record.expiresAt < new Date()) {
    record.status = 'expired';
    await record.save();
    throw new AiError('CONFIRMATION_EXPIRED', { message: 'Action confirmation token has expired.' });
  }

  const action = getAction(record.actionName);
  if (!action) {
    throw new AiError('ACTION_NOT_PERMITTED', { message: `Action "${record.actionName}" is not registered.` });
  }

  if (!action.roles.includes(user.role)) {
    throw new AiError('ROLE_NOT_PERMITTED', {
      message: `Your current role "${user.role}" cannot execute action "${record.actionName}".`
    });
  }

  let executionResult = null;

  try {
    switch (record.actionName) {
      case ACTION_NAMES.createReport: {
        const { title, description, category, departmentName, priority = 'medium' } = record.payload;
        
        const resolvedCategory = reportCategories.includes(category) ? category : 'other';
        const resolvedDept = reportDepartments.includes(departmentName) ? departmentName : 'Other';
        const resolvedPriority = reportPriorities.includes(priority) ? priority : 'medium';

        const report = await Report.create({
          title: String(title).trim(),
          description: String(description).trim(),
          category: resolvedCategory,
          departmentName: resolvedDept,
          priority: resolvedPriority,
          createdBy: user._id,
          source: 'ai_copilot',
          activity: [{
            action: 'Report created via AI Copilot confirmed action',
            actorRole: user.role,
            note: record.explanation || ''
          }]
        });

        executionResult = {
          reportId: report._id,
          title: report.title,
          category: report.category,
          departmentName: report.departmentName,
          status: report.status,
          path: `/dashboard/citizen/reports/${report._id}`
        };
        break;
      }

      case ACTION_NAMES.markAllNotificationsRead: {
        const updateResult = await Notification.updateMany(
          { recipient: user._id, readAt: null },
          { readAt: new Date() }
        );
        executionResult = {
          modifiedCount: updateResult.modifiedCount || 0
        };
        break;
      }

      case ACTION_NAMES.saveCommunityDraft: {
        const { content, category = 'general', area = '' } = record.payload;
        const draft = await CommunityDraft.findOneAndUpdate(
          { author: user._id },
          {
            content: String(content || '').trim(),
            category: category || 'general',
            location: { area: String(area || '').trim(), label: '' }
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        executionResult = {
          draftId: draft._id,
          category: draft.category,
          updatedAt: draft.updatedAt
        };
        break;
      }

      default:
        throw new AiError('ACTION_NOT_PERMITTED', { message: `Unsupported action executor: ${record.actionName}` });
    }

    record.status = 'confirmed';
    await record.save();

    await auditAi({
      user,
      action: AI_AUDIT_ACTIONS.actionConfirmed,
      targetType: 'system',
      targetId: user._id,
      targetName: action.label,
      description: `User confirmed and executed AI action "${action.label}"`,
      metadata: { actionName: record.actionName, result: executionResult },
      result: 'success'
    });

    return {
      success: true,
      actionName: record.actionName,
      label: action.label,
      result: executionResult,
      message: `Action "${action.label}" executed successfully.`
    };
  } catch (error) {
    await auditAi({
      user,
      action: AI_AUDIT_ACTIONS.actionExecuted,
      targetType: 'system',
      targetId: user._id,
      targetName: action.label,
      description: `Execution failed for AI action "${action.label}": ${error.message}`,
      metadata: { actionName: record.actionName, error: error.message },
      result: 'failure'
    });
    throw error;
  }
}

/**
 * Rejects an action confirmation token.
 */
export async function rejectAction({ token, user, reason = '' }) {
  if (!token || typeof token !== 'string') {
    throw new AiError('INVALID_CONFIRMATION', { message: 'Confirmation token is required.' });
  }

  const record = await AiConfirmation.findOne({ token });
  if (!record) {
    throw new AiError('CONFIRMATION_EXPIRED', { message: 'Action confirmation token not found or already processed.' });
  }

  if (String(record.user) !== String(user._id)) {
    throw new AiError('ROLE_NOT_PERMITTED', { message: 'You do not own this action confirmation token.' });
  }

  record.status = 'rejected';
  await record.save();

  await auditAi({
    user,
    action: AI_AUDIT_ACTIONS.actionRejected,
    targetType: 'system',
    targetId: user._id,
    targetName: record.actionName,
    description: `User rejected AI action proposal: ${reason || 'No reason provided'}`,
    metadata: { actionName: record.actionName, reason },
    result: 'info'
  });

  return {
    success: true,
    message: 'Action was successfully rejected and cancelled.'
  };
}
