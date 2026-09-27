
import { createOpenAiCompatibleProvider } from './openAiCompatible.js';

export function createGroqProvider({ apiKey, model, baseUrl, timeoutMs }) {
  return createOpenAiCompatibleProvider({
    id: 'groq',
    label: 'Groq',
    apiKey,
    model,
    baseUrl: baseUrl || 'https://api.groq.com/openai/v1',
    timeoutMs
  });
}
export default createGroqProvider;
