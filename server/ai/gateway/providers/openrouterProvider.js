
import { createOpenAiCompatibleProvider } from './openAiCompatible.js';

export function createOpenRouterProvider({ apiKey, model, baseUrl, timeoutMs }) {
  return createOpenAiCompatibleProvider({
    id: 'openrouter',
    label: 'OpenRouter',
    apiKey,
    model,
    baseUrl: baseUrl || 'https://openrouter.ai/api/v1',
    timeoutMs,
    headers: { 'HTTP-Referer': process.env.CLIENT_URL || 'http://localhost:5173', 'X-Title': 'CivicSync Intelligence' }
  });
}
export default createOpenRouterProvider;
