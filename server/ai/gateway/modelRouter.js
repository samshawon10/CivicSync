/**
 * Model Router (task §6, §16).
 *
 * Provides resilient provider resolution, multi-tier fallback routing,
 * health tracking, circuit-breaker-like fault recovery, and deterministic degradation.
 */

import { readAiConfig, providerIds, providerLabels } from '../config/aiConfig.js';
import { createGeminiProvider } from './providers/geminiProvider.js';
import { createGroqProvider } from './providers/groqProvider.js';
import { createOpenRouterProvider } from './providers/openrouterProvider.js';
import { createLocalProvider } from './providers/localProvider.js';
import { createCivicRulesProvider } from './providers/civicRulesProvider.js';
import { assertProviderContract } from './providers/providerInterface.js';
import { AiError, RETRYABLE_CODES } from '../errors.js';
import { auditAi, AI_AUDIT_ACTIONS } from '../security/audit.js';

// Provider health tracking: failure timestamps & consecutive errors
const providerStatus = new Map();

function getStatus(id) {
  if (!providerStatus.has(id)) {
    providerStatus.set(id, { failures: 0, lastFailure: 0, lastError: null });
  }
  return providerStatus.get(id);
}

function recordSuccess(id) {
  const status = getStatus(id);
  status.failures = 0;
  status.lastError = null;
}

function recordFailure(id, error) {
  const status = getStatus(id);
  status.failures += 1;
  status.lastFailure = Date.now();
  status.lastError = error?.message || String(error);
}

function isCoolingDown(id) {
  const status = getStatus(id);
  if (status.failures < 3) return false;
  const cooldownPeriod = 30 * 1000;
  return (Date.now() - status.lastFailure < cooldownPeriod);
}

/** Instantiates a provider instance according to runtime configuration. */
export function buildProvider(providerId, config = readAiConfig()) {
  const timeoutMs = config.timeoutMs;
  switch (providerId) {
    case 'gemini':
      return createGeminiProvider({
        apiKey: config.credentials.gemini,
        model: config.models.gemini,
        baseUrl: config.endpoints.gemini,
        timeoutMs
      });
    case 'groq':
      return createGroqProvider({
        apiKey: config.credentials.groq,
        model: config.models.groq,
        baseUrl: config.endpoints.groq,
        timeoutMs
      });
    case 'openrouter':
      return createOpenRouterProvider({
        apiKey: config.credentials.openrouter,
        model: config.models.openrouter,
        baseUrl: config.endpoints.openrouter,
        timeoutMs
      });
    case 'local':
      return createLocalProvider({
        apiKey: config.credentials.local,
        model: config.models.local,
        baseUrl: config.endpoints.local,
        timeoutMs
      });
    case 'civic_rules':
      return createCivicRulesProvider();
    default:
      throw new AiError('PROVIDER_NOT_CONFIGURED', { message: `Unknown AI provider requested: ${providerId}` });
  }
}

/**
 * Model Router instance managing provider lifecycle, chat execution, and automatic failover.
 */
export class ModelRouter {
  constructor(config = null) {
    this.customConfig = config;
  }

  getConfig() {
    return this.customConfig || readAiConfig();
  }

  /** Returns list of configured and ready providers in priority chain order. */
  getChain() {
    const config = this.getConfig();
    const chainIds = config.providerChain || ['gemini', 'civic_rules'];
    return chainIds.map((id) => {
      try {
        const provider = buildProvider(id, config);
        assertProviderContract(provider);
        return { id, provider, configured: provider.isConfigured() };
      } catch {
        return { id, provider: null, configured: false };
      }
    });
  }

  /**
   * Executes a chat completion across the provider chain with automatic fallback.
   */
  async chat({ system, messages = [], temperature, maxTokens, user = null, signal = null }) {
    const config = this.getConfig();
    const chain = this.getChain();
    let lastError = null;
    let attemptedCount = 0;

    for (const item of chain) {
      if (!item.configured || !item.provider) continue;
      if (isCoolingDown(item.id) && item.id !== 'civic_rules') continue;

      attemptedCount += 1;
      const isFallback = attemptedCount > 1;

      try {
        const result = await item.provider.chat({
          system,
          messages,
          temperature: temperature ?? config.temperature,
          maxTokens: maxTokens ?? config.maxOutputTokens,
          signal
        });

        recordSuccess(item.id);
        return {
          ...result,
          degraded: isFallback || item.id === 'civic_rules'
        };
      } catch (error) {
        recordFailure(item.id, error);
        lastError = error;

        if (user) {
          await auditAi({
            user,
            action: AI_AUDIT_ACTIONS.providerFailure,
            targetType: 'system',
            targetId: user._id,
            targetName: item.id,
            description: `Provider "${item.id}" failed: ${error.message}. Attempting fallback.`,
            metadata: { provider: item.id, code: error.code || 'ERROR', message: error.message },
            result: 'failure'
          });
        }

        if (signal?.aborted) throw error;
      }
    }

    throw (
      lastError ||
      new AiError('PROVIDER_UNAVAILABLE', {
        message: 'All configured AI providers and fallback rules engines failed.'
      })
    );
  }

  /** Returns current health and diagnostic status for Super Admin / health endpoint. */
  getHealth() {
    const config = this.getConfig();
    return providerIds.map((id) => {
      const status = getStatus(id);
      let configured = false;
      try {
        const p = buildProvider(id, config);
        configured = p.isConfigured();
      } catch {
        configured = false;
      }

      return {
        id,
        label: providerLabels[id] || id,
        model: config.models[id] || null,
        configured,
        failures: status.failures,
        coolingDown: isCoolingDown(id),
        lastError: status.lastError
      };
    });
  }
}

let defaultRouterInstance = null;

export function getModelRouter() {
  if (!defaultRouterInstance) {
    defaultRouterInstance = new ModelRouter();
  }
  return defaultRouterInstance;
}

export default getModelRouter;
