/**
 * CivicSync Deterministic Rule Engine Provider.
 *
 * Implements the Provider Interface (gateway/providers/providerInterface.js)
 * without calling any external LLM APIs.
 *
 * This guarantees:
 *  1. CivicSync AI platform works out of the box even with zero API keys.
 *  2. Offline / air-gapped / provider outage fallback safety.
 *  3. Deterministic civic classification and advice grounded directly in
 *     CivicSync database context and civic intelligence rules.
 */

import { analyzeCivicQuery, CIVIC_ADVISORY_DISCLAIMER } from '../../../services/civicIntelligenceRules.js';

export function createCivicRulesProvider() {
  const modelId = 'civicsync-rules-v1';

  return {
    id: 'civic_rules',
    descriptor() {
      return {
        id: 'civic_rules',
        label: 'CivicSync deterministic reasoning (rules engine)',
        model: modelId,
        capabilities: {
          streaming: false,
          json: true,
          toolCalling: false,
          transport: 'deterministic_rules'
        }
      };
    },
    isConfigured() {
      return true;
    },
    async chat({ system, messages = [] }) {
      // Find the user's latest query
      const userMessage = [...messages].reverse().find((m) => m.role === 'user' || m.content)?.content || '';
      
      // Clean tags like <untrusted_data source="user_message">...</untrusted_data>
      const cleanQuery = String(userMessage)
        .replace(/<untrusted_data[^>]*>/gi, '')
        .replace(/<\/untrusted_data>/gi, '')
        .trim();

      const analysis = analyzeCivicQuery(cleanQuery);

      let responseText = '';
      if (analysis.matched) {
        responseText = `Based on CivicSync verified guidelines, this issue pertains to ${analysis.suggestedDepartment} (${analysis.suggestedCategory}).\n\n` +
          `Guidance: ${analysis.guidance || 'You can submit an official report or search for corresponding civic services.'}\n\n` +
          `${CIVIC_ADVISORY_DISCLAIMER}`;
      } else {
        responseText = `I have analyzed your request regarding civic operations. ` +
          `For precise resolution, please verify your authorized cases or search the Civic Service directory.\n\n` +
          `${CIVIC_ADVISORY_DISCLAIMER}`;
      }

      const structured = JSON.stringify({
        type: 'answer',
        message: responseText,
        citations: [],
        suggestedActions: [
          { label: 'Submit Civic Report', prompt: 'I want to submit a report for this issue' },
          { label: 'Check Nearby Services', prompt: 'Show civic services in my area' }
        ],
        disclaimers: [CIVIC_ADVISORY_DISCLAIMER]
      });

      return {
        text: structured,
        usage: { inputTokens: 50, outputTokens: 80 },
        model: modelId,
        provider: 'civic_rules'
      };
    },
    async stream({ system, messages = [], onDelta }) {
      const result = await this.chat({ system, messages });
      if (typeof onDelta === 'function') {
        onDelta(result.text);
      }
      return result;
    }
  };
}

export default createCivicRulesProvider;
