/**
 * AI Gateway Execution Engine (task §6, §7, §12, §14).
 *
 * Core multi-turn reasoning and tool-calling execution loop:
 *  1. Checks rate limits (security/rateLimiter.js).
 *  2. Scans user prompt for safety / prompt injection (security/promptSafety.js).
 *  3. Builds deterministic ground-truth context (gateway/contextEngine.js).
 *  4. Builds system prompt & message history (prompts/systemPrompts.js).
 *  5. Executes reasoning loop up to maxToolCalls:
 *     - Tool request: validates RBAC, schema, executes handler, fences result.
 *     - Action confirmation: issues confirmation token.
 *     - Final answer: validates citations and grounding.
 *  6. Validates final output contract (security/outputValidator.js).
 *  7. Logs full request audit trail (security/audit.js).
 */

import { readAiConfig, limitsForRole, estimateCost } from '../config/aiConfig.js';
import { getModelRouter } from './modelRouter.js';
import { getDefaultToolRegistry } from '../tools/index.js';
import { validateAction } from '../actions/actionRegistry.js';
import { createActionConfirmation } from '../actions/actionExecutor.js';
import { buildContextForUser } from './contextEngine.js';
import { buildSystemPrompt, buildContextMessage, buildToolFollowUp } from '../prompts/systemPrompts.js';
import { parseDecision } from './providers/providerInterface.js';
import { validateAiResponse } from '../security/outputValidator.js';
import { scanUntrustedContent, fenceToolResult } from '../security/promptSafety.js';
import { enforceRateLimits } from '../security/rateLimiter.js';
import { auditAi, auditToolDenied, AI_AUDIT_ACTIONS } from '../security/audit.js';
import { validateToolInput } from '../tools/schemaValidator.js';
import { AiError } from '../errors.js';

export class AiGateway {
  constructor({ router = null, toolRegistry = null } = {}) {
    this.router = router || getModelRouter();
    this.toolRegistry = toolRegistry || getDefaultToolRegistry();
  }
  async processRequest({
    user,
    message = '',
    history = [],
    pageContext = {},
    signal = null
  }) {
    if (!user || !user.role) {
      throw new AiError('NOT_AUTHORIZED', { message: 'Authentication required.' });
    }

    const config = readAiConfig();
    const roleLimits = limitsForRole(user.role, config);

    // 1. Enforce Rate Limiting
    await enforceRateLimits(user);

    // 2. Message length validation
    const trimmedMessage = String(message || '').trim();
    if (!trimmedMessage) {
      throw new AiError('BAD_REQUEST', { message: 'Message content cannot be empty.' });
    }
    if (trimmedMessage.length > config.maxMessageChars) {
      throw new AiError('MESSAGE_TOO_LONG');
    }

    // 3. Prompt Safety Scan
    const safetyCheck = scanUntrustedContent(trimmedMessage);
    if (safetyCheck.suspicious) {
      await auditAi({
        user,
        action: AI_AUDIT_ACTIONS.injectionBlocked,
        targetType: 'system',
        targetId: user._id,
        targetName: 'Prompt safety shield',
        description: `Potential prompt manipulation detected: [${safetyCheck.matches.join(', ')}]`,
        metadata: { matches: safetyCheck.matches },
        result: 'failure'
      });
    }

    // 4. Ground-truth pre-fetch via Context Engine
    const { contextText, verifiedData, citations: groundCitations } = await buildContextForUser({
      user,
      pageContext
    });

    // 5. System prompt preparation
    const capabilities = {
      toolGroups: this.toolRegistry.describeFor(user),
      actions: user.role === 'citizen' ? ['createReport', 'saveCommunityDraft', 'markAllNotificationsRead'] : ['saveCommunityDraft', 'markAllNotificationsRead']
    };

    const systemPrompt = buildSystemPrompt({
      role: user.role,
      capabilities,
      pageContext,
      structured: true
    });

    const activeToolCitations = [...groundCitations];
    const toolExecutions = [];
    const maxToolCalls = Math.min(config.maxToolCalls, roleLimits.maxToolCalls);

    const toolResults = [];
    const normalizedHistory = (Array.isArray(history) ? history : [])
      .slice(-config.historyMessages)
      .map((h) => ({
        role: h.role === 'assistant' ? 'assistant' : 'user',
        content: String(h.content || '')
      }));

    let currentPromptText = buildContextMessage({
      contextText,
      toolResults,
      question: trimmedMessage
    });

    const conversationMessages = [
      ...normalizedHistory,
      { role: 'user', content: currentPromptText }
    ];

    let totalTokens = { inputTokens: 0, outputTokens: 0 };
    let currentTurn = 0;
    let finalDecision = null;
    let lastProviderMeta = { provider: 'unknown', model: 'unknown', degraded: false };
    // 6. Multi-turn Tool & Reasoning Loop
    while (currentTurn <= maxToolCalls) {
      currentTurn += 1;

      const completion = await this.router.chat({
        system: systemPrompt,
        messages: conversationMessages,
        temperature: config.temperature,
        maxTokens: roleLimits.maxOutputTokens,
        user,
        signal
      });

      lastProviderMeta = {
        provider: completion.provider,
        model: completion.model,
        degraded: completion.degraded
      };

      totalTokens.inputTokens += completion.usage?.inputTokens || 0;
      totalTokens.outputTokens += completion.usage?.outputTokens || 0;

      let decision;
      try {
        decision = parseDecision(completion.text, { allowPlainText: true });
      } catch (err) {
        decision = { type: 'answer', message: completion.text };
      }

      // Check for tool request
      if (decision.type === 'tool_request' && decision.tool && currentTurn <= maxToolCalls) {
        const tool = this.toolRegistry.get(decision.tool);
        const auth = this.toolRegistry.isAuthorized(user, tool);

        if (!tool || !auth.ok) {
          await auditToolDenied(user, decision.tool, auth.reason || 'unauthorized');
          toolResults.push({
            name: decision.tool,
            fenced: fenceToolResult(decision.tool, { error: `Permission denied or tool unavailable: ${decision.tool}` })
          });
          conversationMessages.push({ role: 'assistant', content: completion.text });
          conversationMessages.push({
            role: 'user',
            content: buildToolFollowUp({ toolName: decision.tool, toolFailed: true })
          });
          continue;
        }

        let toolInput = decision.input || {};
        if (tool.inputSchema) {
          const check = validateToolInput(toolInput, tool.inputSchema);
          if (!check.ok) {
            toolResults.push({
              name: decision.tool,
              fenced: fenceToolResult(decision.tool, { error: `Invalid input: ${check.errors.join('; ')}` })
            });
            conversationMessages.push({ role: 'assistant', content: completion.text });
            conversationMessages.push({
              role: 'user',
              content: buildToolFollowUp({ toolName: decision.tool, toolFailed: true })
            });
            continue;
          }
          toolInput = check.value;
        }

        try {
          const result = await tool.handler({ user, input: toolInput });
          toolExecutions.push({ tool: tool.name, input: toolInput });

          if (Array.isArray(result?.citations)) {
            activeToolCitations.push(...result.citations);
          }

          toolResults.push({
            name: tool.name,
            fenced: fenceToolResult(tool.name, result?.data ?? result)
          });

          await auditAi({
            user,
            action: AI_AUDIT_ACTIONS.toolExecuted,
            targetType: 'system',
            targetId: user._id,
            targetName: tool.name,
            description: `Tool "${tool.name}" executed successfully`,
            metadata: { tool: tool.name, input: toolInput },
            result: 'success'
          });

          conversationMessages.push({ role: 'assistant', content: completion.text });
          conversationMessages.push({
            role: 'user',
            content: buildToolFollowUp({ toolName: tool.name, toolFailed: false })
          });
          continue;
        } catch (handlerErr) {
          toolResults.push({
            name: tool.name,
            fenced: fenceToolResult(tool.name, { error: 'Failed to retrieve data from domain service.' })
          });
          conversationMessages.push({ role: 'assistant', content: completion.text });
          conversationMessages.push({
            role: 'user',
            content: buildToolFollowUp({ toolName: tool.name, toolFailed: true })
          });
          continue;
        }
      }
      // Propose state-changing action
      if (decision.type === 'action_confirmation' && decision.action?.name) {
        const actionProposal = await createActionConfirmation({
          user,
          actionName: decision.action.name,
          payload: decision.action.payload || {},
          explanation: decision.action.explanation || decision.message || ''
        });

        finalDecision = {
          type: 'action_confirmation',
          message: decision.message || `CivicSync has prepared "${actionProposal.label}" for your confirmation.`,
          action: {
            token: actionProposal.token,
            name: actionProposal.actionName,
            label: actionProposal.label,
            risk: actionProposal.risk,
            payload: actionProposal.payload,
            explanation: actionProposal.explanation,
            expiresAt: actionProposal.expiresAt
          }
        };
        break;
      }

      finalDecision = decision;
      break;
    }

    if (!finalDecision) {
      finalDecision = { type: 'insufficient_data', message: 'I could not finalize verified information for this inquiry.' };
    }

    // 7. Output Validation & Grounding Verification
    const hasData = Object.keys(verifiedData || {}).length > 0 || toolResults.length > 0;
    const validated = validateAiResponse({
      decision: finalDecision,
      availableCitations: activeToolCitations,
      validateAction,
      verifiedData,
      hasVerifiedData: hasData,
      meta: lastProviderMeta
    });

    const estimatedSpend = estimateCost({
      provider: lastProviderMeta.provider,
      model: lastProviderMeta.model,
      inputTokens: totalTokens.inputTokens,
      outputTokens: totalTokens.outputTokens,
      pricing: config.pricing
    });

    // 8. Record audit trail
    await auditAi({
      user,
      action: AI_AUDIT_ACTIONS.request,
      targetType: 'system',
      targetId: user._id,
      targetName: lastProviderMeta.provider,
      description: `CivicSync AI responded (${validated.response.type}) using ${lastProviderMeta.provider}:${lastProviderMeta.model}`,
      metadata: {
        provider: lastProviderMeta.provider,
        model: lastProviderMeta.model,
        tokens: totalTokens,
        estimatedCost: estimatedSpend,
        toolExecutions: toolExecutions.length,
        degraded: lastProviderMeta.degraded
      },
      result: 'success'
    });

    return {
      response: validated.response,
      toolExecutions,
      usage: totalTokens,
      costEstimate: estimatedSpend,
      provider: lastProviderMeta.provider,
      model: lastProviderMeta.model
    };
  }



}
let defaultGatewayInstance = null;

export function getAiGateway() {
  if (!defaultGatewayInstance) {
    defaultGatewayInstance = new AiGateway();
  }
  return defaultGatewayInstance;
}

export default getAiGateway;

