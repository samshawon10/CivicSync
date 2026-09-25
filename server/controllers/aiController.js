/**
 * AI Copilot HTTP controller (task §12, §14, §22).
 *
 * Thin transport layer over the AI gateway:
 *  - Translates HTTP concerns (persistence, pagination, error mapping) into gateway calls.
 *  - Contains no reasoning or provider logic.
 */

import AiConversation from '../models/AiConversation.js';
import AiConfirmation from '../models/AiConfirmation.js';
import { getAiGateway } from '../ai/gateway/aiGateway.js';
import { getModelRouter } from '../ai/gateway/modelRouter.js';
import { getDefaultToolRegistry } from '../ai/tools/index.js';
import { listAuthorizedActions, getAction } from '../ai/actions/actionRegistry.js';
import { confirmAction, rejectAction } from '../ai/actions/actionExecutor.js';
import { limitsForRole, publicAiConfig, providerReadiness } from '../ai/config/aiConfig.js';
import { auditAi, AI_AUDIT_ACTIONS } from '../ai/security/audit.js';
import { toAiError } from '../ai/errors.js';

const MAX_HISTORY_MESSAGES = 20;
const MAX_STORED_MESSAGES = 100;

/**
 * Friendly, human-readable descriptions of the steps CivicSync took to answer.
 *
 * Tool names are internal identifiers (`getDepartmentWorkload`), so the raw name
 * is never sent to the browser. The client only ever renders these labels, which
 * describe the *outcome* ("Retrieved your cases") without exposing tool
 * permissions, endpoint names or query details.
 */
const TOOL_STEP_LABELS = Object.freeze({
  getMyCases: 'Retrieved your cases',
  getCaseDetails: 'Opened the case record',
  getCaseTimeline: 'Read the case timeline',
  getSLAStatus: 'Checked the SLA clock',
  getSimilarCases: 'Compared with similar cases',
  searchCases: 'Searched your accessible cases',
  getNotifications: 'Retrieved your notifications',
  getNearbyFacilities: 'Found nearby safety facilities',
  getSafetyAlerts: 'Retrieved active safety alerts',
  getServiceDetails: 'Read the service details',
  searchServices: 'Searched CivicSync services',
  getCivicInformation: 'Read verified civic guidance',
  getCommunityPost: 'Read the discussion',
  searchCommunity: 'Searched community discussions',
  getDepartmentWorkload: 'Retrieved department workload',
  getDepartmentCases: 'Retrieved department cases',
  getDepartmentDirectory: 'Read the department directory',
  getDepartmentResources: 'Retrieved department resources',
  getDepartmentStaff: 'Retrieved team information',
  getTeamAvailability: 'Checked team availability',
  getTeamRecommendations: 'Matched available teams',
  getAvailableResponseTeams: 'Checked responder availability',
  getMyFieldTasks: 'Retrieved your assigned tasks',
  getMyResponderAssignments: 'Retrieved your assignments',
  listActiveIncidents: 'Retrieved active incidents',
  getIncidentBriefing: 'Built the incident briefing',
  getOperationsAnalytics: 'Retrieved operational analytics',
  getPlatformOverview: 'Retrieved the platform overview',
  getPlatformAnalytics: 'Retrieved platform statistics',
  getGovernanceOverview: 'Retrieved governance data',
  getAuditSummary: 'Retrieved the audit summary',
  getSystemHealth: 'Checked system health',
  getMyAdminDestinations: 'Resolved admin destinations',
  getMyProfile: 'Read your profile',
  classifyCivicIssue: 'Classified the civic issue',
  triageEmergencyIncident: 'Assessed the incident'
});

/** `getMyCases` -> `Retrieved your cases`, with a safe generic fallback. */
export function stepLabel(toolName) {
  return TOOL_STEP_LABELS[toolName] || 'Retrieved CivicSync data';
}

/** Maps the gateway's `toolExecutions` into presentable steps for the client. */
function toSteps(executions = []) {
  return executions
    .map((execution) => ({ label: stepLabel(execution?.tool ?? execution?.name), ok: true }))
    .slice(0, 6);
}


/** Maps an AiError (or anything else) onto the standard express error pipeline. */
function forwardError(next, error) {
  return next(toAiError(error));
}

/**
 * POST /api/ai/chat
 * Runs one gateway turn, persists the exchange, and returns the grounded response.
 */
export async function chatWithAi(req, res, next) {
  try {
    const { message = '', conversationId = null, pageContext = {} } = req.body || {};
    const user = req.user;

    // Load the conversation and rebuild prior turns for multi-turn context.
    let conversation = null;
    if (conversationId) {
      conversation = await AiConversation.findOne({ _id: conversationId, user: user._id });
      if (!conversation) {
        return res.status(404).json({
          success: false,
          message: 'That CivicSync Intelligence conversation was not found.'
        });
      }
    } else {
      conversation = await AiConversation.create({
        user: user._id,
        role: user.role,
        pageContext: pageContext || {},
        messages: []
      });
    }

    const history = (conversation.messages || [])
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .slice(-MAX_HISTORY_MESSAGES)
      .map((m) => ({ role: m.role, content: m.content }));

    const result = await getAiGateway().processRequest({
      user,
      message,
      history,
      pageContext: conversation.pageContext || pageContext || {}
    });

    conversation.messages.push(
      { role: 'user', content: String(message).slice(0, 4000) },
      {
        role: 'assistant',
        content: result.response.message,
        citations: result.response.citations || [],
        suggestedActions: result.response.suggestedActions || [],
        actionConfirmation: result.response.action || null,
        // The gateway records `{ tool, input }`; persist the friendly step label so
        // reopening a thread shows the same trace without exposing tool internals.
        toolCalls: toSteps(result.toolExecutions),
        provider: result.provider,
        model: result.model,
        usage: result.usage,
        degraded: Boolean(result.degraded)
      }
    );

    // Keep conversations bounded so a thread cannot grow without limit.
    if (conversation.messages.length > MAX_STORED_MESSAGES) {
      conversation.messages = conversation.messages.slice(-MAX_STORED_MESSAGES);
    }
    if (conversation.messages.filter((m) => m.role === 'user').length === 1) {
      conversation.title = String(message).slice(0, 140);
    }
    await conversation.save();

    res.json({
      success: true,
      conversationId: conversation._id,
      response: result.response,
      // Presentable trace of what CivicSync did, for the tool-execution UI.
      steps: toSteps(result.toolExecutions),
      usage: result.usage,
      provider: result.provider,
      model: result.model
    });
  } catch (error) {
    forwardError(next, error);
  }
}

/**
 * GET /api/ai/conversations
 * Lists the caller's own conversations (never another user's).
 */
export async function listConversations(req, res, next) {
  try {
    const conversations = await AiConversation.find({ user: req.user._id, active: true })
      .select('title role messages pinned createdAt updatedAt')
      .sort({ pinned: -1, updatedAt: -1 })
      .limit(50)
      .lean();

    res.json({
      success: true,
      conversations: conversations.map((c) => ({
        id: c._id,
        title: c.title,
        pinned: c.pinned,
        messageCount: (c.messages || []).length,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt
      }))
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/ai/conversations/:id
 */
export async function getConversation(req, res, next) {
  try {
    const conversation = await AiConversation.findOne({
      _id: req.params.id,
      user: req.user._id
    }).lean();

    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation not found.' });
    }

    res.json({ success: true, conversation });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/ai/conversations/:id
 */
export async function deleteConversation(req, res, next) {
  try {
    const result = await AiConversation.deleteOne({
      _id: req.params.id,
      user: req.user._id
    });

    if (!result.deletedCount) {
      return res.status(404).json({ success: false, message: 'Conversation not found.' });
    }

    res.json({ success: true, message: 'Conversation deleted.' });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/ai/confirmations/:token/confirm
 * Executes a previously proposed action after human approval.
 */
export async function confirmAiAction(req, res, next) {
  try {
    const result = await confirmAction({ token: req.params.token, user: req.user });
    res.json({ success: true, ...result });
  } catch (error) {
    forwardError(next, error);
  }
}

/**
 * POST /api/ai/confirmations/:token/reject
 */
export async function rejectAiAction(req, res, next) {
  try {
    const result = await rejectAction({
      token: req.params.token,
      user: req.user,
      reason: String(req.body?.reason || '')
    });
    res.json({ success: true, ...result });
  } catch (error) {
    forwardError(next, error);
  }
}

/**
 * GET /api/ai/pending-confirmations
 * Lists actions awaiting this user's decision.
 */
export async function listPendingConfirmations(req, res, next) {
  try {
    const records = await AiConfirmation.find({
      user: req.user._id,
      status: 'pending',
      expiresAt: { $gt: new Date() }
    })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    res.json({
      success: true,
      confirmations: records.map((r) => {
        const action = getAction(r.actionName);
        return {
          token: r.token,
          actionName: r.actionName,
          label: action?.label || r.actionName,
          risk: action?.risk || 'write',
          payload: r.payload,
          explanation: r.explanation,
          expiresAt: r.expiresAt
        };
      })
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/ai/feedback
 * Records helpful/unhelpful feedback for transparency reporting.
 */
export async function submitAiFeedback(req, res, next) {
  try {
    const { conversationId, messageIndex, rating, comment = '' } = req.body || {};

    if (!['helpful', 'unhelpful'].includes(rating)) {
      return res.status(400).json({ success: false, message: 'Rating must be helpful or unhelpful.' });
    }

    const conversation = await AiConversation.findOne({
      _id: conversationId,
      user: req.user._id
    });

    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation not found.' });
    }

    const message = conversation.messages[Number(messageIndex)];
    if (!message) {
      return res
        .status(404)
        .json({ success: false, message: 'Message not found in that conversation.' });
    }

    message.feedback = {
      rating,
      comment: String(comment || '').slice(0, 1000),
      updatedAt: new Date()
    };
    await conversation.save();

    await auditAi({
      user: req.user,
      action: AI_AUDIT_ACTIONS.feedback,
      targetType: 'system',
      targetId: req.user._id,
      targetName: 'AI Copilot feedback',
      description: `User rated a CivicSync Intelligence response as ${rating}`,
      metadata: { rating },
      result: 'info'
    });

    res.json({ success: true, message: 'Thank you for the feedback.' });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/ai/capabilities
 * Tells the client exactly which tools/actions/limits the current role has.
 */
export async function getCapabilities(req, res, next) {
  try {
    const user = req.user;
    const registry = getDefaultToolRegistry();
    const limits = limitsForRole(user.role);

    res.json({
      success: true,
      capabilities: {
        role: user.role,
        tools: registry.describeFor(user),
        actions: listAuthorizedActions(user.role).map((name) => {
          const action = getAction(name);
          return {
            name,
            label: action.label,
            description: action.description,
            risk: action.risk
          };
        }),
        limits: {
          perMinute: limits.perMinute,
          perDay: limits.perDay,
          maxToolCalls: limits.maxToolCalls
        }
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/ai/health
 * Provider readiness and failure stats (no secrets are exposed).
 */
export async function getAiHealth(req, res, next) {
  try {
    res.json({
      success: true,
      config: publicAiConfig(),
      readiness: providerReadiness(),
      providers: getModelRouter().getHealth()
    });
  } catch (error) {
    next(error);
  }
}
