/**
 * Rate Limiter for AI platform (task §25).
 *
 * Implements sliding-window rate limits per user & per role.
 * Tracks per-minute and per-day request budgets.
 */

import { limitsForRole, readAiConfig } from '../config/aiConfig.js';
import { AiError } from '../errors.js';
import { auditAi, AI_AUDIT_ACTIONS } from '../security/audit.js';

// In-memory sliding windows: userId -> { minuteRequests: [timestamps], dayRequests: [timestamps] }
const rateBuckets = new Map();

// Periodic cleanup every 10 minutes to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  const oneDayAgo = now - 24 * 60 * 60 * 1000;
  for (const [userId, bucket] of rateBuckets.entries()) {
    bucket.dayRequests = bucket.dayRequests.filter((ts) => ts > oneDayAgo);
    if (!bucket.dayRequests.length) {
      rateBuckets.delete(userId);
    }
  }
}, 10 * 60 * 1000).unref();

/**
 * Checks and records rate limit for a user request.
 * Throws AiError('RATE_LIMITED') if exceeded.
 */
export async function enforceRateLimits(user) {
  if (!user?._id) return;

  const now = Date.now();
  const oneMinuteAgo = now - 60 * 1000;
  const oneDayAgo = now - 24 * 60 * 60 * 1000;

  const limits = limitsForRole(user.role);

  let bucket = rateBuckets.get(String(user._id));
  if (!bucket) {
    bucket = { minuteRequests: [], dayRequests: [] };
    rateBuckets.set(String(user._id), bucket);
  }

  // Filter expired timestamps
  bucket.minuteRequests = bucket.minuteRequests.filter((ts) => ts > oneMinuteAgo);
  bucket.dayRequests = bucket.dayRequests.filter((ts) => ts > oneDayAgo);

  if (bucket.minuteRequests.length >= limits.perMinute) {
    await auditAi({
      user,
      action: AI_AUDIT_ACTIONS.rateLimited,
      targetType: 'system',
      targetId: user._id,
      targetName: 'Rate limit per minute',
      description: `User exceeded minute quota (${bucket.minuteRequests.length}/${limits.perMinute})`,
      metadata: { limit: limits.perMinute, period: '1m' },
      result: 'failure'
    });
    throw new AiError('RATE_LIMITED', {
      message: `You have reached your CivicSync Intelligence limit of ${limits.perMinute} requests per minute. Please pause and try again in a moment.`
    });
  }

  if (bucket.dayRequests.length >= limits.perDay) {
    await auditAi({
      user,
      action: AI_AUDIT_ACTIONS.rateLimited,
      targetType: 'system',
      targetId: user._id,
      targetName: 'Rate limit per day',
      description: `User exceeded daily quota (${bucket.dayRequests.length}/${limits.perDay})`,
      metadata: { limit: limits.perDay, period: '24h' },
      result: 'failure'
    });
    throw new AiError('RATE_LIMITED', {
      message: `You have reached your daily CivicSync Intelligence quota of ${limits.perDay} requests. Quota resets tomorrow.`
    });
  }

  bucket.minuteRequests.push(now);
  bucket.dayRequests.push(now);
}
