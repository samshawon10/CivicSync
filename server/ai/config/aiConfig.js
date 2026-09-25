/**
 * CivicSync AI Gateway — environment configuration.
 *
 * Design rule (task §5): the browser never sees a provider key. Every value here
 * is read from the server environment only, and `publicAiConfig()` exposes just
 * the facts a client may know (provider label, model label, limits).
 *
 * The config is read through a function (not a module-level constant) so tests
 * and the Super Admin view can observe environment changes without a restart.
 */

/** Provider identifiers understood by the Model Router. */
export const providerIds = Object.freeze(['gemini', 'groq', 'openrouter', 'local', 'civic_rules']);

export const providerLabels = Object.freeze({
  gemini: 'Google Gemini',
  groq: 'Groq',
  openrouter: 'OpenRouter',
  local: 'Self-hosted local model',
  civic_rules: 'CivicSync deterministic reasoning (rules engine)'
});

/**
 * Indicative pricing in USD per 1M tokens, used only to *estimate* spend.
 * Unknown models cost 0 — CivicSync reports an estimate, never a billing claim.
 * Override per deployment with AI_PRICING_OVERRIDES (JSON).
 */
export const modelPricing = Object.freeze({
  'gemini:gemini-2.0-flash': { input: 0.1, output: 0.4 },
  'gemini:gemini-2.5-flash': { input: 0.3, output: 2.5 },
  'groq:llama-3.3-70b-versatile': { input: 0.59, output: 0.79 },
  'groq:llama-3.1-8b-instant': { input: 0.05, output: 0.08 },
  'openrouter:openai/gpt-4o-mini': { input: 0.15, output: 0.6 },
  'local:any': { input: 0, output: 0 }
});

/**
 * Per-role AI limits (task §25). A Super Admin may be configured more
 * generously, a public citizen conservatively. Values are enforced server-side.
 */
export const roleLimits = Object.freeze({
  citizen: { perMinute: 8, perDay: 120, maxToolCalls: 3, maxOutputTokens: 700 },
  admin: { perMinute: 30, perDay: 1200, maxToolCalls: 6, maxOutputTokens: 1200 },
  department_head: { perMinute: 20, perDay: 600, maxToolCalls: 5, maxOutputTokens: 1000 },
  department_officer: { perMinute: 18, perDay: 500, maxToolCalls: 5, maxOutputTokens: 1000 },
  officer: { perMinute: 15, perDay: 400, maxToolCalls: 4, maxOutputTokens: 900 },
  field_worker: { perMinute: 12, perDay: 300, maxToolCalls: 4, maxOutputTokens: 800 },
  emergency_department_head: { perMinute: 25, perDay: 900, maxToolCalls: 6, maxOutputTokens: 1100 },
  emergency_department_officer: { perMinute: 18, perDay: 500, maxToolCalls: 5, maxOutputTokens: 1000 },
  emergency_officer: { perMinute: 18, perDay: 500, maxToolCalls: 5, maxOutputTokens: 1000 },
  emergency_field_worker: { perMinute: 12, perDay: 300, maxToolCalls: 4, maxOutputTokens: 800 }
});

export const defaultRoleLimits = Object.freeze({ perMinute: 8, perDay: 120, maxToolCalls: 3, maxOutputTokens: 700 });

const bool = (value, fallback) => {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
};
const int = (value, fallback, min, max) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  const rounded = Math.round(number);
  if (min !== undefined && rounded < min) return min;
  if (max !== undefined && rounded > max) return max;
  return rounded;
};
const list = (value = '') => String(value).split(',').map((item) => item.trim().toLowerCase()).filter(Boolean);

/**
 * Reads the AI configuration from an environment object (defaults to process.env).
 * Never throws: an invalid value falls back to a documented default.
 */
export function readAiConfig(env = process.env) {
  const provider = String(env.AI_PROVIDER || 'gemini').trim().toLowerCase();
  const primary = providerIds.includes(provider) ? provider : 'gemini';
  const fallbacks = list(env.AI_FALLBACK_PROVIDERS || 'civic_rules').filter((id) => providerIds.includes(id));
  const overrides = (() => {
    if (!env.AI_PRICING_OVERRIDES) return {};
    try {
      const parsed = JSON.parse(env.AI_PRICING_OVERRIDES);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch { return {}; }
  })();

  return {
    enabled: bool(env.AI_ENABLED, true),
    provider: primary,
    // The deterministic CivicSync reasoner is always the last resort so the
    // platform never becomes unusable when every external provider is down.
    providerChain: [...new Set([primary, ...fallbacks, 'civic_rules'])],
    model: String(env.AI_MODEL || '').trim(),
    fallbackModel: String(env.AI_FALLBACK_MODEL || '').trim(),
    temperature: Math.min(Math.max(Number(env.AI_TEMPERATURE ?? 0.2) || 0.2, 0), 1),
    maxOutputTokens: int(env.AI_MAX_OUTPUT_TOKENS, 900, 128, 4096),
    timeoutMs: int(env.AI_TIMEOUT_MS, 20000, 2000, 120000),
    maxToolCalls: int(env.AI_MAX_TOOL_CALLS, 4, 0, 8),
    historyMessages: int(env.AI_HISTORY_MESSAGES, 8, 2, 30),
    maxMessageChars: int(env.AI_MAX_MESSAGE_CHARS, 4000, 200, 20000),
    ratePerMinute: int(env.AI_RATE_PER_MINUTE, 12, 1, 600),
    ratePerDay: int(env.AI_RATE_PER_DAY, 400, 1, 100000),
    conversationRetention: int(env.AI_CONVERSATION_RETENTION, 30, 1, 3650),
    confirmationTtlMinutes: int(env.AI_CONFIRMATION_TTL_MINUTES, 15, 1, 240),
    credentials: {
      gemini: String(env.GEMINI_API_KEY || '').trim(),
      groq: String(env.GROQ_API_KEY || '').trim(),
      openrouter: String(env.OPENROUTER_API_KEY || '').trim(),
      local: String(env.AI_LOCAL_API_KEY || '').trim()
    },
    models: {
      gemini: String(env.GEMINI_MODEL || env.AI_MODEL || 'gemini-2.0-flash').trim(),
      groq: String(env.GROQ_MODEL || env.AI_MODEL || 'llama-3.3-70b-versatile').trim(),
      openrouter: String(env.OPENROUTER_MODEL || env.AI_MODEL || 'openai/gpt-4o-mini').trim(),
      local: String(env.AI_LOCAL_MODEL || env.AI_MODEL || 'local-model').trim(),
      civic_rules: 'civicsync-rules-v1'
    },
    endpoints: {
      gemini: String(env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta').trim(),
      groq: String(env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1').trim(),
      openrouter: String(env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1').trim(),
      // Any OpenAI-compatible self-hosted runtime (Ollama, vLLM, llama.cpp, LM Studio).
      local: String(env.AI_LOCAL_BASE_URL || 'http://127.0.0.1:11434/v1').trim()
    },
    pricing: { ...modelPricing, ...overrides }
  };
}

/** Limits for one role, clamped by the global rate configuration. */
export function limitsForRole(role, config = readAiConfig()) {
  const base = roleLimits[role] || defaultRoleLimits;
  return {
    ...base,
    perMinute: Math.min(base.perMinute, config.ratePerMinute),
    perDay: Math.min(base.perDay, config.ratePerDay)
  };
}

/** Estimated spend for a completed request. Reported as an estimate only. */
export function estimateCost({ provider, model, inputTokens = 0, outputTokens = 0, pricing }) {
  const table = pricing || modelPricing;
  const entry = table[`${provider}:${model}`] || table[`${provider}:any`] || null;
  if (!entry) return null;
  const cost = (Number(inputTokens) || 0) / 1e6 * (entry.input || 0) + (Number(outputTokens) || 0) / 1e6 * (entry.output || 0);
  return Math.round(cost * 1e6) / 1e6;
}

/** Health summary for the SPA. Contains no secrets — only presence booleans. */
export function providerReadiness(config = readAiConfig()) {
  return providerIds.map((id) => ({
    id,
    label: providerLabels[id],
    model: config.models[id] || null,
    configured: id === 'civic_rules' || id === 'local' ? true : Boolean(config.credentials[id]),
    requiresKey: id !== 'civic_rules' && id !== 'local'
  }));
}

/** Client-safe configuration (task §5: keys never reach React). */
export function publicAiConfig(config = readAiConfig()) {
  return {
    enabled: config.enabled,
    provider: config.provider,
    providerLabel: providerLabels[config.provider] || config.provider,
    models: { ...config.models },
    streaming: true,
    limits: { perMinute: config.ratePerMinute, perDay: config.ratePerDay, maxToolCalls: config.maxToolCalls, maxMessageChars: config.maxMessageChars },
    providers: providerReadiness(config)
  };
}
