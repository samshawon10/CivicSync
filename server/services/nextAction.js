const reportActions = {
  pending: { action: 'Review and verify case', responsibleRole: 'department_officer', reason: 'The submitted case has not been verified.' },
  verified: { action: 'Assign an officer', responsibleRole: 'department_head', reason: 'The case is verified but has no operational owner.' },
  assigned: { action: 'Begin field work', responsibleRole: 'field_worker', reason: 'The case is assigned and awaiting work.' },
  in_progress: { action: 'Submit completion report', responsibleRole: 'field_worker', reason: 'Work is underway and needs a completion update.' },
  under_review: { action: 'Review completion report', responsibleRole: 'department_head', reason: 'A submitted completion report is awaiting review.' },
  completed: { action: 'Confirm resolution', responsibleRole: 'citizen', reason: 'Work is marked complete and is awaiting citizen confirmation.' }
};

const emergencyActions = {
  reported: { action: 'Acknowledge and assess incident', responsibleRole: 'emergency_department_head', reason: 'The incident is awaiting command review.' },
  received: { action: 'Assess and classify incident', responsibleRole: 'emergency_department_head', reason: 'The incident has been received but not classified.' },
  assessing: { action: 'Complete incident assessment', responsibleRole: 'emergency_department_head', reason: 'Command assessment is still in progress.' },
  verified: { action: 'Assign a response team', responsibleRole: 'emergency_department_head', reason: 'The incident is verified and needs a response assignment.' },
  dispatched: { action: 'Accept assignment and depart', responsibleRole: 'emergency_officer', reason: 'A response team has been dispatched.' },
  en_route: { action: 'Confirm arrival on scene', responsibleRole: 'emergency_field_worker', reason: 'Responders are traveling to the incident.' },
  on_scene: { action: 'Update response progress', responsibleRole: 'emergency_officer', reason: 'Responders have arrived and need to report progress.' },
  responding: { action: 'Complete response and report outcome', responsibleRole: 'emergency_officer', reason: 'The response is active and requires an outcome.' },
  requires_backup: { action: 'Coordinate backup response', responsibleRole: 'emergency_department_head', reason: 'The incident has an outstanding backup request.' },
  escalated: { action: 'Review escalated incident', responsibleRole: 'emergency_department_head', reason: 'The incident requires command follow-up.' },
  resolved: { action: 'Close resolved incident', responsibleRole: 'emergency_department_head', reason: 'The incident is resolved and awaiting command closure.' }
};

function asId(value) {
  const id = value?._id ?? value;
  return id == null ? null : String(id);
}

function decorate(action, deadline, priority) {
  if (!action) return null;
  return { ...action, responsibleUser: action.responsibleUser || null, deadline: deadline || null, priority: priority || null };
}

export function getReportNextAction(report) {
  if (report?.escalation?.isEscalated && !report.escalation.resolvedAt) {
    return decorate(
      { action: 'Review SLA / Critical Escalation', responsibleRole: 'department_head', reason: report.escalation.reason || 'Case has been escalated.' },
      report.dueAt,
      report.priority
    );
  }

  if (report?.activeTask && typeof report.activeTask === 'object') {
    const task = report.activeTask;
    if (task.status === 'assigned') {
      return decorate(
        { action: 'Accept Assigned Task', responsibleRole: 'field_worker', responsibleUser: asId(task.assignedWorker), reason: 'Task dispatched to field worker' },
        task.targetDueAt || report.dueAt,
        report.priority
      );
    }
    if (task.status === 'accepted') {
      return decorate(
        { action: 'Start Travel to Site', responsibleRole: 'field_worker', responsibleUser: asId(task.assignedWorker), reason: 'Task accepted; worker ready to depart' },
        task.targetDueAt || report.dueAt,
        report.priority
      );
    }
    if (task.status === 'traveling') {
      return decorate(
        { action: 'Confirm Arrival on Site', responsibleRole: 'field_worker', responsibleUser: asId(task.assignedWorker), reason: 'Worker is en route to site' },
        task.targetDueAt || report.dueAt,
        report.priority
      );
    }
    if (task.status === 'arrived') {
      return decorate(
        { action: 'Start Field Work', responsibleRole: 'field_worker', responsibleUser: asId(task.assignedWorker), reason: 'Worker arrived at location' },
        task.targetDueAt || report.dueAt,
        report.priority
      );
    }
    if (task.status === 'in_progress') {
      return decorate(
        { action: 'Upload Evidence & Complete Task', responsibleRole: 'field_worker', responsibleUser: asId(task.assignedWorker), reason: 'Work underway at location' },
        task.targetDueAt || report.dueAt,
        report.priority
      );
    }
    if (task.status === 'blocked') {
      return decorate(
        { action: 'Resolve Blocked Field Task', responsibleRole: 'department_officer', reason: `Worker reported block: ${task.blockedInfo?.reason || 'unspecified'}` },
        task.targetDueAt || report.dueAt,
        report.priority
      );
    }
  }

  const action = reportActions[report?.status];
  if (!action) return null;
  const responsibleUser = report.status === 'assigned' || report.status === 'in_progress'
    ? asId(report.assignedFieldWorker) || asId(report.assignedOfficer)
    : report.status === 'completed' ? asId(report.createdBy) : null;
  return decorate({ ...action, responsibleUser }, report.dueAt, report.priority);
}

export function getEmergencyNextAction(emergency, sla = emergency?.sla) {
  const activeAssignments = emergency?.responseAssignments?.filter((assignment) => !['completed', 'cancelled'].includes(assignment.status)) || [];
  const currentAssignment = activeAssignments.find((assignment) => assignment.status === 'assigned')
    || activeAssignments.find((assignment) => assignment.status === 'accepted')
    || activeAssignments.find((assignment) => assignment.status === 'en_route')
    || activeAssignments.find((assignment) => ['on_scene', 'responding'].includes(assignment.status));

  let action;
  if (currentAssignment) {
    const assignmentActions = {
      assigned: { action: 'Accept response assignment', responsibleRole: 'emergency_officer', responsibleUser: asId(currentAssignment.emergencyOfficer), reason: 'A response assignment is waiting for acknowledgement.' },
      accepted: { action: 'Depart for incident', responsibleRole: 'emergency_officer', responsibleUser: asId(currentAssignment.emergencyOfficer), reason: 'The response assignment is accepted and awaiting departure.' },
      en_route: { action: 'Confirm arrival on scene', responsibleRole: 'emergency_field_worker', responsibleUser: asId(currentAssignment.fieldWorkers?.[0]), reason: 'Responders are traveling to the incident.' },
      on_scene: { action: 'Update response progress', responsibleRole: 'emergency_officer', responsibleUser: asId(currentAssignment.emergencyOfficer), reason: 'Responders have arrived and need to report progress.' },
      responding: { action: 'Complete response and report outcome', responsibleRole: 'emergency_officer', responsibleUser: asId(currentAssignment.emergencyOfficer), reason: 'The response is active and requires an outcome.' }
    };
    action = assignmentActions[currentAssignment.status];
  } else {
    action = emergencyActions[emergency?.status];
  }

  return decorate(action, sla?.dueAt, emergency?.severity);
}
