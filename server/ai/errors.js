/**
 * CivicSync AI Gateway — error vocabulary.
 *
 * Every failure inside the AI platform is expressed as an AiError with a stable
 * `code`, so the gateway can degrade gracefully (see gateway/modelRouter.js) and
 * the controller can return an honest message without leaking provider detail.
 *
 * Codes are intentionally coarse: they describe what CivicSync can *observe*,
 * never what it assumes (no fabricated provider internals).
 */
export const AI_ERROR_CODES = Object.freeze({
  // Request / caller problems (4xx)
  AI_DISABLED: { status: 503, message: 'CivicSync Intelligence is currently disabled by the platform administrator.' },
  BAD_REQUEST: { status: 400, message: 'The AI request is not valid.' },
  MESSAGE_TOO_LONG: { status: 413, message: 'That message is too long for CivicSync Intelligence. Shorten it and try again.' },
  RATE_LIMITED: { status: 429, message: 'You have reached your CivicSync Intelligence limit. Please try again later.' },
  NOT_AUTHORIZED: { status: 403, message: 'You are not authorized to use that CivicSync Intelligence capability.' },
  ROLE_NOT_PERMITTED: { status: 403, message: 'Your CivicSync role is not permitted to perform that action.' },
  INVALID_STATE: { status: 409, message: 'That action is no longer in a state that can be processed.' },
  INVALID_CONFIRMATION: { status: 400, message: 'A valid action confirmation token is required.' },
  INVALID_TOOL: { status: 400, message: 'That CivicSync capability is not available.' },
  INVALID_TOOL_INPUT: { status: 400, message: 'The AI requested a CivicSync capability with invalid input, so it was rejected.' },
  ACTION_NOT_PERMITTED: { status: 403, message: 'That CivicSync action is not permitted.' },
  CONFIRMATION_EXPIRED: { status: 404, message: 'That confirmation request was not found, has expired, or was already processed.' },
  INVALID_ACTION: { status: 400, message: 'That CivicSync action is not available.' },
  ACTION_CONFIRMATION_REQUIRED: { status: 409, message: 'This action must be confirmed by a human before it can be executed.' },
  CONFIRMATION_NOT_FOUND: { status: 404, message: 'That confirmation request is no longer valid.' },
  CONFIRMATION_STALE: { status: 409, message: 'That confirmation expired. Ask CivicSync Intelligence again.' },
  RESOURCE_NOT_FOUND: { status: 404, message: 'CivicSync could not find that record, or you are not authorized to view it.' },

  // Provider problems (degradable)
  PROVIDER_NOT_CONFIGURED: { status: 503, message: 'No AI provider is configured for CivicSync.' },
  PROVIDER_TIMEOUT: { status: 504, message: 'The AI reasoning service timed out.' },
  PROVIDER_UNAVAILABLE: { status: 503, message: 'The AI reasoning service is unavailable.' },
  PROVIDER_QUOTA: { status: 429, message: 'The AI reasoning service quota was exceeded.' },
  PROVIDER_REJECTED: { status: 400, message: 'The AI reasoning service rejected the request.' },
  PROVIDER_INVALID_RESPONSE: { status: 502, message: 'The AI reasoning service returned an unusable response.' },

  // Platform problems
  DATABASE_UNAVAILABLE: { status: 503, message: 'CivicSync data is temporarily unavailable.' },
  INTERNAL: { status: 500, message: 'CivicSync Intelligence hit an internal problem.' }
});

/** True when the caller could succeed by simply retrying (used by the router). */
export const RETRYABLE_CODES = Object.freeze(new Set(['PROVIDER_TIMEOUT', 'PROVIDER_UNAVAILABLE', 'PROVIDER_QUOTA', 'INTERNAL']));

export class AiError extends Error {
  constructor(code, { message, details, cause } = {}) {
    const entry = AI_ERROR_CODES[code] || AI_ERROR_CODES.INTERNAL;
    super(message || entry.message);
    this.name = 'AiError';
    this.code = AI_ERROR_CODES[code] ? code : 'INTERNAL';
    this.status = entry.status;
    this.details = details || null;
    this.retryable = RETRYABLE_CODES.has(this.code);
    if (cause) this.cause = cause;
  }

  /** HTTP-safe projection: never exposes provider payloads or secrets to clients. */
  toPublic() {
    return { code: this.code, message: this.message, status: this.status };
  }
}

export function isAiError(value) {
  return value instanceof AiError || Boolean(value && value.name === 'AiError' && value.code);
}

/** Wraps any thrown value as an AiError so the gateway only handles one shape. */
export function toAiError(error, fallbackCode = 'INTERNAL') {
  if (isAiError(error)) return error;
  return new AiError(fallbackCode, { message: undefined, cause: error });
}
