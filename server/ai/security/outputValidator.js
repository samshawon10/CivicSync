/**
 * Output validation (task §12, §14).
 *
 * The model's output is never forwarded to the SPA as-is. Every response is
 * rebuilt into CivicSync's structured contract, with:
 *   - a closed set of response types,
 *   - citations restricted to records that were actually retrieved and authorized,
 *   - suggested actions restricted to registered capabilities,
 *   - an identifier check that flags any case/emergency reference the model
 *     produced that does not exist in the verified data it was given.
 *
 * That last check is the platform's hallucination tripwire: CivicSync would
 * rather add an honest warning than present an invented case number as fact.
 */

export const RESPONSE_TYPES = Object.freeze(['answer', 'action_confirmation', 'insufficient_data', 'error']);

/** The exact sentence CivicSync uses when it has no verified data (task §14). */
export const INSUFFICIENT_DATA_MESSAGE = "I don't have enough verified CivicSync information to answer that. I can search your authorized cases, services, alerts or emergency records if you tell me what to look for.";

export const GROUNDING_NOTICE = 'Some references in this answer could not be matched to your authorized CivicSync records. Verify them before acting on this.';

export const MAX_MESSAGE_CHARS = 6000;

/** Identifier-like tokens a model likes to invent. */
const IDENTIFIER_PATTERNS = Object.freeze([
  /\b(?:CASE|EM)-\d{2,8}\b/g,
  /\b[A-Z]{2,5}-\d{3,8}\b/g
]);

const asText = (value, max = MAX_MESSAGE_CHARS) => String(value ?? '').replace(/```[a-z]*\n?/gi, '').replace(/```/g, '').trim().slice(0, max);

/** Pulls identifier-like tokens out of a message. */
export function identifiersIn(message) {
  const text = String(message || '');
  const found = new Set();
  for (const pattern of IDENTIFIER_PATTERNS) {
    for (const match of text.match(pattern) || []) found.add(match.replace(/\s+/g, ''));
  }
  return [...found];
}

/**
 * Compares identifiers used in the message against everything CivicSync
 * actually verified (tool results + context). Anything unknown is reported so
 * the response can carry an honest grounding warning.
 */
export function unverifiedIdentifiers(message, verifiedPayload) {
  const haystack = JSON.stringify(verifiedPayload ?? {}).toUpperCase();
  return identifiersIn(message).filter((token) => !haystack.includes(token.toUpperCase()));
}

/** Normalizes one citation; invalid entries are dropped rather than trusted. */
function normalizeCitation(citation) {
  if (!citation || typeof citation !== 'object') return null;
  const id = citation.id ? String(citation.id).slice(0, 80) : '';
  const label = asText(citation.label, 160);
  if (!label) return null;
  const type = asText(citation.type, 40) || 'record';
  const path = typeof citation.path === 'string' && citation.path.startsWith('/') ? citation.path.slice(0, 200) : undefined;
  return { type, id, label, ...(path ? { path } : {}) };
}

function baseResponse({ type, message, meta = {}, issues = [], extra = {} }) {
  return {
    type: RESPONSE_TYPES.includes(type) ? type : 'answer',
    message,
    citations: [],
    suggestedActions: [],
    requiresConfirmation: false,
    provider: meta.provider || null,
    model: meta.model || null,
    degraded: Boolean(meta.degraded),
    issues,
    ...extra
  };
}

/** Standard "no verified data" response (used by tools and the gateway). */
export function insufficientDataResponse(meta = {}, message) {
  return baseResponse({ type: 'insufficient_data', message: message || INSUFFICIENT_DATA_MESSAGE, meta });
}

/** Honest degradation message (task §30) — never blames the user's data. */
export function degradedResponse(message, meta = {}) {
  return baseResponse({
    type: 'error',
    message: message || 'AI reasoning is temporarily unavailable. Your CivicSync data and all normal platform functions are still available.',
    meta,
    issues: ['degraded']
  });
}

/**
 * Validates and rebuilds a model decision into the client contract.
 *
 * @param {object} args
 * @param {object} args.decision            parsed model decision (providerInterface.parseDecision)
 * @param {Array}  args.availableCitations  citations CivicSync can actually vouch for
 * @param {Function} args.validateAction    (name, payload) => { ok, message } from actions/actionRegistry.js
 * @param {object} args.verifiedData        every record the model was shown
 * @param {boolean} args.hasVerifiedData    whether any authorized record was retrieved
 * @param {{provider: string, model: string, degraded?: boolean}} args.meta
 */
export function validateAiResponse({ decision = {}, availableCitations = [], validateAction, verifiedData, hasVerifiedData = false, meta = {} }) {
  const issues = [];
  const allowedCitations = availableCitations.map(normalizeCitation).filter(Boolean);
  const requestedType = RESPONSE_TYPES.includes(decision.type) ? decision.type : 'answer';

  // A CivicSync data question with no authorized data can never be answered
  // from general knowledge (task §14).
  if ((requestedType === 'answer' || requestedType === 'insufficient_data') && !hasVerifiedData && decision.grounding !== 'general_knowledge') {
    return {
      response: baseResponse({
        type: 'insufficient_data',
        message: requestedType === 'insufficient_data' && asText(decision.message) ? asText(decision.message) : INSUFFICIENT_DATA_MESSAGE,
        meta,
        issues: ['no_verified_data']
      }),
      issues: ['no_verified_data']
    };
  }

  if (requestedType === 'action_confirmation') {
    const name = asText(decision.action?.name, 80);
    const payload = decision.action?.payload && typeof decision.action.payload === 'object' ? decision.action.payload : {};
    const verdict = typeof validateAction === 'function' ? validateAction(name, payload) : { ok: false, message: 'No action registry is available.' };
    if (!verdict?.ok) {
      issues.push(verdict?.message || 'invalid_action');
      return { response: baseResponse({ type: 'insufficient_data', message: verdict?.message || 'That CivicSync action is not available.', meta, issues }), issues };
    }
    return {
      response: baseResponse({
        type: 'action_confirmation',
        message: asText(decision.message) || `CivicSync Intelligence prepared "${verdict.action.label}".`,
        meta,
        issues,
        extra: {
          action: { name: verdict.action.name, label: verdict.action.label, risk: verdict.action.risk, payload, explanation: asText(decision.action?.explanation, 400), path: verdict.action.path || undefined },
          requiresConfirmation: true
        }
      }),
      issues
    };
  }

  const message = asText(decision.message);
  if (!message) {
    issues.push('empty_message');
    return { response: baseResponse({ type: 'insufficient_data', message: INSUFFICIENT_DATA_MESSAGE, meta, issues }), issues };
  }

  // Citations are intersected with what CivicSync can vouch for.
  const seen = new Set();
  const citations = [];
  for (const citation of Array.isArray(decision.citations) ? decision.citations : []) {
    const normalized = normalizeCitation(citation);
    if (!normalized) continue;
    const match = allowedCitations.find((item) => item.id === normalized.id && item.type === normalized.type)
      || allowedCitations.find((item) => item.id && item.id === normalized.id)
      || allowedCitations.find((item) => item.label.toLowerCase() === normalized.label.toLowerCase());
    if (!match) { issues.push('dropped_unverified_citation'); continue; }
    if (seen.has(`${match.type}:${match.id}`)) continue;
    seen.add(`${match.type}:${match.id}`);
    citations.push(match);
  }

  const unverified = hasVerifiedData ? unverifiedIdentifiers(message, verifiedData) : identifiersIn(message);
  if (unverified.length) issues.push('unverified_identifier');

  const suggestedActions = (Array.isArray(decision.suggestedActions) ? decision.suggestedActions : [])
    .slice(0, 5)
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const label = asText(item.label, 80);
      if (!label) return null;
      if (item.action) {
        const verdict = typeof validateAction === 'function' ? validateAction(asText(item.action, 80), item.payload || {}) : { ok: false };
        // A suggestion referencing an unregistered capability is dropped.
        if (!verdict?.ok) return null;
        return { label, action: verdict.action.name, payload: item.payload && typeof item.payload === 'object' ? item.payload : {}, risk: verdict.action.risk, requiresConfirmation: true };
      }
      return { label, prompt: asText(item.prompt, 400) };
    })
    .filter(Boolean);

  return {
    response: baseResponse({
      type: requestedType,
      message: unverified.length ? `${GROUNDING_NOTICE}\n\n${message}` : message,
      meta,
      issues,
      extra: {
        citations,
        suggestedActions,
        requiresConfirmation: false,
        grounding: unverified.length ? { verified: false, unverifiedIdentifiers: unverified } : { verified: true, unverifiedIdentifiers: [] },
        disclaimers: Array.isArray(decision.disclaimers) ? decision.disclaimers.map((item) => asText(item, 200)).filter(Boolean).slice(0, 3) : []
      }
    }),
    issues
  };
}
