
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
