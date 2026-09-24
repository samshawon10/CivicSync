/**
 * Operational SLA configuration per priority
 * Response SLA: time to review & assign (minutes)
 * Arrival SLA: time for field worker to travel & arrive (minutes)
 * Resolution SLA: time to complete resolution (minutes)
 */
export const departmentSlaTargets = Object.freeze({
  urgent: { response: 15, arrival: 45, resolution: 180 },
  high: { response: 30, arrival: 90, resolution: 360 },
  medium: { response: 60, arrival: 240, resolution: 1440 }, // 24 hours
  low: { response: 120, arrival: 480, resolution: 2880 } // 48 hours
});

export function calculateDepartmentSla(report) {
  if (!report) return null;
  const createdAt = report.createdAt ? new Date(report.createdAt) : new Date();
  const priority = report.priority || 'medium';
  const targets = departmentSlaTargets[priority] || departmentSlaTargets.medium;
  const now = new Date();

  // Deadlines
  const responseDueAt = report.sla?.responseDueAt || new Date(createdAt.getTime() + targets.response * 60000);
  const arrivalDueAt = report.sla?.arrivalDueAt || new Date(createdAt.getTime() + targets.arrival * 60000);
  const resolutionDueAt = report.dueAt || report.sla?.resolutionDueAt || new Date(createdAt.getTime() + targets.resolution * 60000);

  // Status checks
  const isAssigned = ['assigned', 'in_progress', 'under_review', 'completed', 'closed'].includes(report.status);
  const hasArrived = report.sla?.arrivedAt != null;
  const isResolved = ['completed', 'closed'].includes(report.status);

  // Evaluate Resolution status
  let resolutionStatus = 'safe';
  const remainingResolutionMs = resolutionDueAt.getTime() - now.getTime();
  if (isResolved) {
    resolutionStatus = 'completed';
  } else if (remainingResolutionMs < 0) {
    resolutionStatus = 'breached';
  } else if (remainingResolutionMs < 30 * 60000) {
    resolutionStatus = 'warning';
  }

  // Evaluate Response status
  let responseStatus = 'safe';
  const remainingResponseMs = responseDueAt.getTime() - now.getTime();
  if (isAssigned) {
    responseStatus = 'met';
  } else if (remainingResponseMs < 0) {
    responseStatus = 'breached';
  } else if (remainingResponseMs < 10 * 60000) {
    responseStatus = 'warning';
  }

  // Evaluate Arrival status
  let arrivalStatus = 'safe';
  const remainingArrivalMs = arrivalDueAt.getTime() - now.getTime();
  if (hasArrived) {
    arrivalStatus = 'met';
  } else if (remainingArrivalMs < 0) {
    arrivalStatus = 'breached';
  } else if (remainingArrivalMs < 15 * 60000) {
    arrivalStatus = 'warning';
  }

  return {
    priority,
    response: {
      dueAt: responseDueAt,
      status: responseStatus,
      remainingMinutes: Math.round(remainingResponseMs / 60000),
      isBreached: responseStatus === 'breached'
    },
    arrival: {
      dueAt: arrivalDueAt,
      status: arrivalStatus,
      remainingMinutes: Math.round(remainingArrivalMs / 60000),
      isBreached: arrivalStatus === 'breached'
    },
    resolution: {
      dueAt: resolutionDueAt,
      status: resolutionStatus,
      remainingMinutes: Math.round(remainingResolutionMs / 60000),
      isBreached: resolutionStatus === 'breached'
    },
    overallStatus: [responseStatus, arrivalStatus, resolutionStatus].includes('breached')
      ? 'breached'
      : [responseStatus, arrivalStatus, resolutionStatus].includes('warning')
      ? 'warning'
      : 'safe'
  };
}
