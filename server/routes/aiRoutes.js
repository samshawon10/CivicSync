/**
 * AI Copilot routes (task §12, §14, §22).
 *
 * All endpoints require authentication. The gateway itself performs rate limiting,
 * RBAC scoping, prompt-safety scanning and output grounding, so these handlers stay
 * deliberately thin.
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import {
  chatWithAi,
  listConversations,
  getConversation,
  deleteConversation,
  confirmAiAction,
  rejectAiAction,
  listPendingConfirmations,
  submitAiFeedback,
  getCapabilities,
  getAiHealth
} from '../controllers/aiController.js';
import { isAiError } from '../ai/errors.js';

const router = Router();

router.use(requireAuth);

/** Maps AiError onto its intended HTTP status without leaking provider internals. */
function aiErrorHandler(error, req, res, next) { // eslint-disable-line no-unused-vars
  if (isAiError(error)) {
    return res.status(error.status || 500).json({ success: false, ...error.toPublic() });
  }
  return next(error);
}

// Core assistant
router.post('/chat', chatWithAi);
router.get('/capabilities', getCapabilities);
router.get('/health', getAiHealth);

// Conversation persistence
router.get('/conversations', listConversations);
router.get('/conversations/:id', getConversation);
router.delete('/conversations/:id', deleteConversation);

// Human-in-the-loop confirmations
router.get('/pending-confirmations', listPendingConfirmations);
router.post('/confirmations/:token/confirm', confirmAiAction);
router.post('/confirmations/:token/reject', rejectAiAction);

// Transparency feedback
router.post('/feedback', submitAiFeedback);

router.use(aiErrorHandler);

export default router;
