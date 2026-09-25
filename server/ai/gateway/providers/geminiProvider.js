/**
 * Google Gemini provider (REST, no SDK).
 *
 * Gemini is the default external reasoning engine, but nothing in CivicSync
 * imports Gemini outside this file: the gateway only sees the Provider
 * Interface (gateway/providers/providerInterface.js).
 */
import { buildMessages, normalizeProviderError, withTimeout } from './providerInterface.js';

const toGeminiContents = (messages = []) => messages
  .filter((message) => message.role !== 'system')
  .map((message) => ({ role: message.role === 'assistant' ? 'model' : 'user', parts: [{ text: String(message.content || '') }] }));

function readCandidate(payload = {}) {
  const parts = payload?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';
  return parts.map((part) => part?.text || '').join('');
}
function readUsage(payload = {}) {
  const usage = payload?.usageMetadata || {};
  return { inputTokens: Number(usage.promptTokenCount || 0) || 0, outputTokens: Number(usage.candidatesTokenCount || 0) || 0 };
}
function blockedReason(payload = {}) {
  return payload?.promptFeedback?.blockReason || payload?.candidates?.[0]?.finishReason || '';
}

/**
 * @param {{ apiKey: string, model: string, baseUrl: string, timeoutMs?: number }} options
 */
export function createGeminiProvider({ apiKey, model, baseUrl, timeoutMs = 20000 }) {
  const base = String(baseUrl || 'https://generativelanguage.googleapis.com/v1beta').replace(/\/+$/, '');
  const body = (system, messages, temperature, maxTokens) => ({
    systemInstruction: { parts: [{ text: String(system || '') }] },
    contents: toGeminiContents(buildMessages({ system, messages })),
    generationConfig: { temperature, maxOutputTokens: maxTokens, responseMimeType: 'application/json' }
  });

  async function call(method, payload, signal) {
    const response = await fetch(`${base}/models/${encodeURIComponent(model)}:${method}?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const error = new Error(`gemini responded ${response.status}`);
      error.status = response.status;
      error.detail = await response.text().catch(() => '');
      throw error;
    }
    return response;
  }

  return {
    id: 'gemini',
    descriptor() {
      return { id: 'gemini', label: 'Google Gemini', model, capabilities: { streaming: true, json: true, toolCalling: false, transport: 'gemini_rest' } };
    },
    isConfigured() {
      return Boolean(apiKey && model);
    },
    async chat({ system, messages, temperature = 0.2, maxTokens = 900, signal }) {
      try {
        return await withTimeout(async (timeoutSignal) => {
          const response = await call('generateContent', body(system, messages, temperature, maxTokens), signal || timeoutSignal);
          const payload = await response.json().catch(() => null);
          if (!payload) throw Object.assign(new Error('malformed payload'), { status: 502 });
          if (!payload.candidates && blockedReason(payload)) throw Object.assign(new Error('blocked'), { status: 400 });
          return { text: readCandidate(payload), usage: readUsage(payload), model, provider: 'gemini' };
        }, timeoutMs, 'Gemini');
      } catch (error) {
        throw normalizeProviderError(error, 'Gemini');
      }
    },
    async stream({ system, messages, temperature = 0.2, maxTokens = 900, onDelta, signal }) {
      try {
        return await withTimeout(async (timeoutSignal) => {
          const response = await call('streamGenerateContent', body(system, messages, temperature, maxTokens), signal || timeoutSignal);
          const reader = response.body?.getReader?.();
          if (!reader) {
            const payload = await response.json().catch(() => null);
            const text = readCandidate(payload || {});
            if (text) onDelta?.(text);
            return { text, usage: readUsage(payload || {}), model, provider: 'gemini' };
          }
          // `alt=sse` is requested so frames arrive as `data: {...}` lines.
          const decoder = new TextDecoder();
          let buffer = '';
          let text = '';
          let usage = { inputTokens: 0, outputTokens: 0 };
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const frames = buffer.split('\n');
            buffer = frames.pop() || '';
            for (const frame of frames) {
              const trimmed = frame.trim();
              if (!trimmed.startsWith('data:')) continue;
              const data = trimmed.slice(5).trim();
              if (!data || data === '[DONE]') continue;
              try {
                const chunk = JSON.parse(data);
                if (chunk.usageMetadata) usage = readUsage(chunk);
                const delta = readCandidate(chunk);
                if (delta) { text += delta; onDelta?.(delta); }
              } catch { /* partial frame */ }
            }
          }
          return { text, usage, model, provider: 'gemini' };
        }, timeoutMs, 'Gemini');
      } catch (error) {
        throw normalizeProviderError(error, 'Gemini');
      }
    }
  };
}
