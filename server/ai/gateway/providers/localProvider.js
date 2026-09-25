/**
 * Future self-hosted / local model provider (task §24, §42).
 *
 * Anything that speaks the OpenAI chat-completions protocol works without a
 * code change: Ollama (`http://127.0.0.1:11434/v1`), vLLM, llama.cpp server,
 * LM Studio, LocalAI or a private gateway. An API key is optional, which is why
 * this provider is always considered "configured" — availability is discovered
 * at request time and reported honestly through provider health.
 */
import { createOpenAiCompatibleProvider } from './openAiCompatible.js';

export function createLocalProvider({ apiKey = '', model, baseUrl, timeoutMs }) {
  return createOpenAiCompatibleProvider({
    id: 'local',
    label: 'Self-hosted local model',
    apiKey,
    model: model || 'local-model',
    baseUrl: baseUrl || 'http://127.0.0.1:11434/v1',
    timeoutMs
  });
}
export default createLocalProvider;
