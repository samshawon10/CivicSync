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
  return status === 'completed' && currentVerificationStatus === 'submitted' && ['approved', 'rejected'].includes(requestedVerificationStatus);
}
