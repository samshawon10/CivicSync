import api from './api.js';

/** AI surfaces render their own inline error state, so suppress the global modal. */
const AI_CONFIG = { skipGlobalErrorToast: true };

/** Axios hands back the full response; every caller here wants the body. */
const unwrap = (promise) => promise.then((response) => response.data);

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

  confirmAction: (token) => unwrap(api.post(`/ai/confirmations/${token}/confirm`, {}, AI_CONFIG)),
  rejectAction: (token, reason = '') => unwrap(api.post(`/ai/confirmations/${token}/reject`, { reason }, AI_CONFIG)),

  feedback: ({ conversationId, messageIndex, rating, comment = '' }) =>
    unwrap(api.post('/ai/feedback', { conversationId, messageIndex, rating, comment }, AI_CONFIG)),

  toAiError
};

export default aiApi;
