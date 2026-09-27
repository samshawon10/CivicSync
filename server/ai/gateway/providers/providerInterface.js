
import { AiError } from '../../errors.js';

export const PROVIDER_REQUIRED_METHODS = Object.freeze(['descriptor', 'isConfigured', 'chat']);

/** Fails fast when a provider implementation does not honour the contract. */
export function assertProviderContract(provider) {
  if (!provider || typeof provider !== 'object') throw new AiError('PROVIDER_NOT_CONFIGURED', { message: 'AI provider implementation is missing.' });
  for (const method of PROVIDER_REQUIRED_METHODS) {
    if (typeof provider[method] !== 'function') throw new AiError('PROVIDER_NOT_CONFIGURED', { message: `AI provider "${provider?.id || 'unknown'}" does not implement ${method}().` });
  }
  const descriptor = provider.descriptor();
  if (!descriptor?.id) throw new AiError('PROVIDER_NOT_CONFIGURED', { message: 'AI provider descriptor is missing an id.' });
  return provider;
}

/** Builds the provider-agnostic message list. System rules are always first. */
export function buildMessages({ system, messages = [] }) {
  const normalized = messages
    .filter((message) => message && typeof message.content === 'string' && message.content.trim())
    .map((message) => ({ role: message.role === 'assistant' ? 'assistant' : 'user', content: message.content }));
  return [{ role: 'system', content: String(system || '').trim() }, ...normalized];
}

/** Flattens the message list into a single prompt (used by text-only runtimes). */
export function flattenPrompt(messages = []) {
  return messages.map((message) => (message.role === 'system' ? `[SYSTEM]\n${message.content}` : message.role === 'assistant' ? `[CIVIC_SYNC]\n${message.content}` : `[USER]\n${message.content}`)).join('\n\n');
}

export function extractJsonObject(text) {
  const value = String(text || '');
  const start = value.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < value.length; index += 1) {
    const char = value[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') { inString = true; continue; }
    if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        const candidate = value.slice(start, index + 1);
        try { return JSON.parse(candidate); } catch { return null; }
      }
    }
  }
  return null;
}

/** Decision shapes the model may return inside the JSON contract. */
export const DECISION_TYPES = Object.freeze(['answer', 'tool_request', 'action_confirmation', 'insufficient_data']);

export function parseDecision(text, { allowPlainText = true } = {}) {
  const raw = String(text || '').trim();
  if (!raw) throw new AiError('PROVIDER_INVALID_RESPONSE', { message: 'The AI reasoning service returned an empty response.' });
  const parsed = extractJsonObject(raw);
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const type = DECISION_TYPES.includes(parsed.type) ? parsed.type : null;
    if (!type) throw new AiError('PROVIDER_INVALID_RESPONSE', { message: `Unsupported AI decision type: ${String(parsed.type).slice(0, 40)}` });
    return { ...parsed, type };
  }
  if (!allowPlainText) throw new AiError('PROVIDER_INVALID_RESPONSE', { message: 'The AI reasoning service did not return structured output.' });
  return { type: 'answer', message: raw };
}

export function normalizeProviderError(error, providerId = 'provider') {
  if (error?.name === 'AbortError' || error?.code === 'AI_TIMEOUT') {
    return new AiError('PROVIDER_TIMEOUT', { message: `${providerId} did not respond in time.`, cause: error });
  }
  const status = Number(error?.status || error?.response?.status || 0);
  if (status === 401 || status === 403) return new AiError('PROVIDER_NOT_CONFIGURED', { message: `${providerId} credentials were rejected.`, cause: error });
  if (status === 402 || status === 429) return new AiError('PROVIDER_QUOTA', { message: `${providerId} quota or rate limit reached.`, cause: error });
  if (status === 400 || status === 404 || status === 422) return new AiError('PROVIDER_REJECTED', { message: `${providerId} rejected the request.`, cause: error });
  if (status >= 500) return new AiError('PROVIDER_UNAVAILABLE', { message: `${providerId} is unavailable.`, cause: error });
  if (error instanceof AiError) return error;
  return new AiError('PROVIDER_UNAVAILABLE', { message: `${providerId} could not be reached.`, cause: error });
}

/** Runs an async operation with a hard timeout, so no provider can hang a request. */
export async function withTimeout(executor, timeoutMs, providerId = 'provider') {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1000, Number(timeoutMs) || 20000));
  try {
    return await executor(controller.signal);
  } catch (error) {
    if (controller.signal.aborted) throw new AiError('PROVIDER_TIMEOUT', { message: `${providerId} did not respond in time.`, cause: error });
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
