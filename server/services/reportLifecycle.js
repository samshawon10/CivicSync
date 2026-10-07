export const reportStatusTransitions = Object.freeze({
  pending: ['verified'],
  verified: ['assigned'],
  assigned: ['in_progress'],
  in_progress: ['under_review'],
  under_review: ['completed'],
  completed: ['closed'],
  closed: []
});

export function canTransitionReport(from, to) {
  return Boolean(reportStatusTransitions[from]?.includes(to));
}

export function isTerminalReportStatus(status) {
  return status === 'closed';
}

export function canCitizenResolveReport(status) {
  return status === 'completed' || status === 'closed';
}

export function canCitizenReopenReport(status) {
  return status === 'completed';
}

export function canReviewReportCompletion(status, currentVerificationStatus, requestedVerificationStatus) {
  if (!['completed', 'under_review'].includes(status) || !['submitted', 'verified'].includes(currentVerificationStatus)) return false;
  // The Department Officer verifies first; the Department Head then resolves.
  if (requestedVerificationStatus === 'verified') return currentVerificationStatus === 'submitted';
  if (requestedVerificationStatus === 'approved') return currentVerificationStatus === 'verified';
  return ['approved', 'rejected'].includes(requestedVerificationStatus);
}

/** Stage a completion decision moves the case to. */
export function completionStageFor(verificationStatus) {
  return { verified: 'VERIFIED', approved: 'RESOLVED', rejected: 'IN_PROGRESS' }[verificationStatus] || '';
}
