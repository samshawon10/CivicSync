const defaultTargetMinutes = 30;

export const slaStates = Object.freeze(['on_track', 'warning', 'breached', 'resolved', 'unknown']);

function safeDate(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

export function getSlaTargetMinutes(severity, settings = {}) {
  const emergency = settings?.emergency || {};
  const bySeverity = {
    critical: Number(emergency.criticalSlaMinutes),
    high: Number(emergency.highSlaMinutes),
    medium: Number(emergency.mediumSlaMinutes),
    low: Number(emergency.lowSlaMinutes)
  };
  const candidate = bySeverity[severity] || Number(emergency.responseSlaMinutes) || defaultTargetMinutes;
  return Number.isFinite(candidate) && candidate > 0 ? candidate : defaultTargetMinutes;
}

export function evaluateEmergencySla(emergency, settings = {}, now = new Date()) {
  const createdAt = safeDate(emergency?.createdAt);
  if (!createdAt) return { state: 'unknown', targetMinutes: null, dueAt: null, remainingMinutes: null, source: 'missing_created_at' };
  const targetMinutes = getSlaTargetMinutes(emergency.severity, settings);
  const responseAt = safeDate(emergency.dispatchedAt) || safeDate(emergency.acknowledgedAt);
  const resolvedAt = safeDate(emergency.resolvedAt) || safeDate(emergency.closedAt);
  if (resolvedAt) {
    return { state: 'resolved', targetMinutes, dueAt: new Date(createdAt.getTime() + targetMinutes * 60000), remainingMinutes: 0, respondedAt: responseAt, resolvedAt, source: 'stored_milestones' };
  }
  const dueAt = new Date(createdAt.getTime() + targetMinutes * 60000);
  const remainingMinutes = Math.round((dueAt.getTime() - safeDate(now)?.getTime()) / 60000);
  if (responseAt && responseAt.getTime() <= dueAt.getTime()) {
    return { state: 'on_track', targetMinutes, dueAt, remainingMinutes: Math.max(0, Math.round((dueAt.getTime() - responseAt.getTime()) / 60000)), respondedAt: responseAt, source: 'stored_milestones' };
  }
  if (safeDate(now).getTime() > dueAt.getTime()) return { state: 'breached', targetMinutes, dueAt, remainingMinutes, source: 'configured_response_target' };
  if (remainingMinutes <= Math.max(1, Math.ceil(targetMinutes * 0.2))) return { state: 'warning', targetMinutes, dueAt, remainingMinutes, source: 'configured_response_target' };
  return { state: 'on_track', targetMinutes, dueAt, remainingMinutes, source: 'configured_response_target' };
}
