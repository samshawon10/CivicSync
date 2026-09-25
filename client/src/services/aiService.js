import api from './api.js';

/**
 * CivicSync Intelligence API surface.
 *
 * The browser talks ONLY to the CivicSync backend. Model providers (Gemini,
 * Groq, OpenRouter) are reached exclusively through the server-side AI Gateway,
 * so no provider credential is ever present in the client bundle.
 *
 * Authentication is the normal Firebase session cookie/Bearer token handled by
 * the shared axios instance, and the backend independently derives role,
 * department and team — the client never asserts its own permissions.
 */

/** AI surfaces render their own inline error state, so suppress the global modal. */
const AI_CONFIG = { skipGlobalErrorToast: true };

/** Axios hands back the full response; every caller here wants the body. */
const unwrap = (promise) => promise.then((response) => response.data);

/**
 * Normalizes a transport failure into a stable `{ code, message }` shape so the
 * UI can pick a friendly message without inspecting axios internals.
 */
function toAiError(error) {
  if (error?.response?.data?.code) {
    return { code: error.response.data.code, message: error.response.data.message };
  }
  if (error?.code === 'ERR_NETWORK') {
    return { code: 'NETWORK', message: 'AI requires an internet connection.' };
  }
  if (error?.response?.status === 401) {
    return { code: 'UNAUTHENTICATED', message: 'Please sign in again to continue.' };
  }
  return { code: 'DEFAULT', message: error?.response?.data?.message || 'AI is temporarily unavailable.' };
}

export const aiApi = {
  /** Sends one grounded turn. Returns the validated response contract. */
  chat: ({ message, conversationId = null, pageContext = {} } = {}) =>
    unwrap(api.post('/ai/chat', { message, conversationId, pageContext }, AI_CONFIG)),

  capabilities: () => unwrap(api.get('/ai/capabilities', AI_CONFIG)),

  /** Server-side provider readiness. Never contains secrets. */
  health: () => unwrap(api.get('/ai/health', AI_CONFIG)),

  conversations: () => unwrap(api.get('/ai/conversations', AI_CONFIG)),
  conversation: (id) => unwrap(api.get(`/ai/conversations/${id}`, AI_CONFIG)),
  deleteConversation: (id) => unwrap(api.delete(`/ai/conversations/${id}`, AI_CONFIG)),

  pendingConfirmations: () => unwrap(api.get('/ai/pending-confirmations', AI_CONFIG)),

  /**
   * Executes a proposed action. This is UX confirmation only — the backend
   * re-authorizes the actor, role and payload before anything is written.
   */
  confirmAction: (token) => unwrap(api.post(`/ai/confirmations/${token}/confirm`, {}, AI_CONFIG)),
  rejectAction: (token, reason = '') => unwrap(api.post(`/ai/confirmations/${token}/reject`, { reason }, AI_CONFIG)),

  feedback: ({ conversationId, messageIndex, rating, comment = '' }) =>
    unwrap(api.post('/ai/feedback', { conversationId, messageIndex, rating, comment }, AI_CONFIG)),

  toAiError
};

export default aiApi;
