import test from 'node:test';
import assert from 'node:assert/strict';
import { canCitizenReopenReport, canCitizenResolveReport, canReviewReportCompletion, canTransitionReport, isTerminalReportStatus, reportStatusTransitions } from './reportLifecycle.js';

test('report lifecycle accepts only the configured forward path', () => {
  assert.equal(canTransitionReport('pending', 'verified'), true);
  assert.equal(canTransitionReport('assigned', 'in_progress'), true);
  assert.equal(canTransitionReport('under_review', 'completed'), true);
  assert.equal(canTransitionReport('completed', 'closed'), true);
  assert.equal(canTransitionReport('pending', 'closed'), false);
  assert.equal(canTransitionReport('closed', 'in_progress'), false);
  assert.deepEqual(Object.keys(reportStatusTransitions), ['pending', 'verified', 'assigned', 'in_progress', 'under_review', 'completed', 'closed']);
});

test('citizen resolution verification is limited to resolved-like states', () => {
  assert.equal(canCitizenResolveReport('completed'), true);
  assert.equal(canCitizenResolveReport('closed'), true);
  assert.equal(canCitizenResolveReport('in_progress'), false);
  assert.equal(canCitizenReopenReport('completed'), true);
  assert.equal(canCitizenReopenReport('closed'), false);
  assert.equal(canCitizenReopenReport('in_progress'), false);
  assert.equal(canReviewReportCompletion('completed', 'submitted', 'approved'), true);
  assert.equal(canReviewReportCompletion('completed', 'approved', 'approved'), false);
  assert.equal(canReviewReportCompletion('in_progress', 'submitted', 'approved'), false);
  assert.equal(canReviewReportCompletion('completed', 'submitted', 'approved'), true);
  assert.equal(canReviewReportCompletion('completed', 'submitted', 'rejected'), true);
  assert.equal(canReviewReportCompletion('completed', 'submitted', 'invalid'), false);
  assert.equal(isTerminalReportStatus('closed'), true);
  assert.equal(isTerminalReportStatus('completed'), false);
});
