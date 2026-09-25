/**
 * Shared implementation for OpenAI-compatible chat-completions endpoints
 * (Groq, OpenRouter, and any future self-hosted runtime such as Ollama, vLLM,
 * llama.cpp or LM Studio).
 *
 * CivicSync never talks to a provider SDK: one thin `fetch` wrapper keeps the
 * dependency surface at zero (the project ships no HTTP client) and gives every
 * provider identical timeout, error-mapping and token-accounting behaviour.
 */
import { buildMessages, normalizeProviderError, withTimeout } from './providerInterface.js';

/** Reads usage defensively — providers differ on casing and optional fields. */
function readUsage(payload = {}) {
  const usage = payload.usage || {};
  return {
    inputTokens: Number(usage.prompt_tokens ?? usage.input_tokens ?? 0) || 0,
    outputTokens: Number(usage.completion_tokens ?? usage.output_tokens ?? 0) || 0
  };
}

/** Accepts either a plain string body or an SSE stream and returns the first choice text. */
function readChoice(payload = {}) {
  const choice = Array.isArray(payload.choices) ? payload.choices[0] : null;
  const content = choice?.message?.content ?? choice?.delta?.content ?? '';
  if (Array.isArray(content)) return content.map((part) => part?.text || '').join('');
  return String(content || '');
}

/**
 * Creates an OpenAI-compatible provider.
 * @param {{ id: string, label: string, baseUrl: string, apiKey: string, model: string, timeoutMs?: number, headers?: object }} options
 */
export function createOpenAiCompatibleProvider({ id, label, baseUrl, apiKey, model, timeoutMs = 20000, headers = {} }) {
  const endpoint = () => `${String(baseUrl || '').replace(/\/+$/, '')}/chat/completions`;

  async function request(payload, signal) {
    const response = await fetch(endpoint(), {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        ...headers
      },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      const error = new Error(`${id} responded ${response.status}`);
      error.status = response.status;
      error.detail = detail.slice(0, 400);
      throw error;
    }
    return response;
  }

  return {
    id,
    descriptor() {
      return { id, label, model, capabilities: { streaming: true, json: true, toolCalling: false, transport: 'openai_compatible' } };
    },
    isConfigured() {
      // A self-hosted runtime may legitimately run without a key.
      return Boolean(baseUrl) && (Boolean(apiKey) || id === 'local');
    },
    async chat({ system, messages, temperature = 0.2, maxTokens = 900, signal }) {
      try {
        const body = {
          model,
          messages: buildMessages({ system, messages }),
          temperature,
          max_tokens: maxTokens,
          stream: false
        };
        return await withTimeout(async (timeoutSignal) => {
          const response = await request(body, signal || timeoutSignal);
          const payload = await response.json().catch(() => null);
          if (!payload) throw Object.assign(new Error('malformed payload'), { status: 502 });
          return { text: readChoice(payload), usage: readUsage(payload), model: payload.model || model, provider: id };
        }, timeoutMs, id);
      } catch (error) {
        throw normalizeProviderError(error, label || id);
      }
    },
    async stream({ system, messages, temperature = 0.2, maxTokens = 900, onDelta, signal }) {
      try {
        const body = {
          model,
          messages: buildMessages({ system, messages }),
          temperature,
          max_tokens: maxTokens,
          stream: true
        };
        return await withTimeout(async (timeoutSignal) => {
          const response = await request(body, signal || timeoutSignal);
          const reader = response.body?.getReader?.();
          if (!reader) {
            // Runtime without web streams: fall back to a single-shot answer.
            const payload = await response.json().catch(() => null);
            const text = readChoice(payload || {});
            if (text) onDelta?.(text);
            return { text, usage: readUsage(payload || {}), model, provider: id };
          }
          const decoder = new TextDecoder();
          let buffer = '';
          let text = '';
          let usage = { inputTokens: 0, outputTokens: 0 };
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed.startsWith('data:')) continue;
              const data = trimmed.slice(5).trim();
              if (!data || data === '[DONE]') continue;
              try {
                const chunk = JSON.parse(data);
                if (chunk.usage) usage = readUsage(chunk);
                const delta = readChoice(chunk);
                if (delta) { text += delta; onDelta?.(delta); }
              } catch { /* partial frame — the next read completes it */ }
            }
          }
          return { text, usage, model, provider: id };
        }, timeoutMs, id);
      } catch (error) {
        throw normalizeProviderError(error, label || id);
      }
    }
  };
}
