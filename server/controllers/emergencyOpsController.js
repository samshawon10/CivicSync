import mongoose from 'mongoose';
import Emergency from '../models/Emergency.js';
import EmergencyResponseTeam from '../models/EmergencyResponseTeam.js';
import EmergencyEscalation from '../models/EmergencyEscalation.js';
import ActivityLog from '../models/ActivityLog.js';
import User from '../models/User.js';
import {
  OpsError,
  assertHeadAuthority,
  assignDepartmentOfficer,
  assignEmergencyOfficer,
  assignableStaff,
  assertIncidentAccess,
  attachRosterTeam,
  addInstruction,
  addWorkerToTeam,
  classifyAndPrioritize,
  createRosterTeam,
  createTaskTeam,
  fieldWorkerComplete,
  getEDODashboardData,
  getEODashboardData,
  getFieldWorkerDashboardData,
  getHeadDashboardData,
  headCloseEmergency,
  headCancelEmergency,
  listOpsIncidents,
  officerCompleteResponse,
  presentEmergency,
  raiseEscalation,
  releaseWorkerFromTeam,
  reportBlocker as reportBlockerService,
  resolveBlocker as resolveBlockerService,
  resolveEscalation as resolveEscalationService,
  reviewEmergencyByEDO,
  reviewEmergencyByHead,
  reviewResponseCompletion,
  startResponse as startResponseService,
  updateProgress as updateProgressService,
  acceptEmergencyByOfficer,
  updateFieldWorkerAssignment,
  statusOf
} from '../services/emergencyOps.js';

function handleOpsError(err, res, next) {
  if (err instanceof OpsError || err?.name === 'OpsError') {
    return res.status(err.status || 400).json({ success: false, message: err.message, details: err.details });
  }
  next(err);
}

export async function headDashboard(req, res, next) {
  try {
    const data = await getHeadDashboardData({ actor: req.user });
    res.json({ success: true, ...data });
  } catch (err) {
    handleOpsError(err, res, next);
  }
}

export async function edoDashboard(req, res, next) {
  try {
    const data = await getEDODashboardData({ actor: req.user });
    res.json({ success: true, ...data });
  } catch (err) {
    handleOpsError(err, res, next);
  }
}

export async function eoDashboard(req, res, next) {
  try {
    const data = await getEODashboardData({ actor: req.user });
    res.json({ success: true, ...data });
  } catch (err) {
    handleOpsError(err, res, next);
  }
}

export async function fieldWorkerDashboard(req, res, next) {
  try {
    const data = await getFieldWorkerDashboardData({ actor: req.user });
    res.json({ success: true, ...data });
  } catch (err) {
    handleOpsError(err, res, next);
  }
}

export async function listIncidents(req, res, next) {
  try {
    const result = await listOpsIncidents(req.user, req.query);
    res.json({ success: true, ...result });
  } catch (err) {
    handleOpsError(err, res, next);
  }
}

export async function getIncident(req, res, next) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ success: false, message: 'Emergency not found.' });
    }
    const emergency = await Emergency.findById(req.params.id)
      .populate('citizen', 'name email phone')
      .populate('emergencyHead', 'name email phone')
      .populate('ops.departmentOfficer', 'name email phone photoURL')
      .populate('ops.emergencyOfficer', 'name email phone photoURL')
      .populate('ops.activeEscalation.raisedBy', 'name email role phone')
      .populate('ops.instructions.by', 'name role email')
      .populate('ops.progress.by', 'name role')
      .populate('ops.blockers.raisedBy', 'name role');

    if (!emergency) {
      return res.status(404).json({ success: false, message: 'Emergency not found.' });
    }
    await assertIncidentAccess(emergency, req.user);

    const [teams, escalations, auditTrail] = await Promise.all([
      EmergencyResponseTeam.find({ emergency: emergency._id, status: { $ne: 'DISBANDED' } })
        .populate('officer', 'name email phone')
        .populate('members.user', 'name email phone availability photoURL'),
      EmergencyEscalation.find({ emergency: emergency._id })
        .populate('raisedBy', 'name role email phone')
        .populate('resolvedBy', 'name role email phone')
        .sort({ createdAt: -1 }),
      ActivityLog.find({ targetType: 'emergency', targetId: emergency._id })
        .populate('admin', 'name role')
        .sort({ createdAt: -1 })
        .limit(50)
    ]);

    const presented = presentEmergency(emergency, {
      includeCitizen: ['emergency_department_head', 'admin', 'emergency_department_officer'].includes(req.user.role),
      teams,
      escalations
    });
    presented.evidence = emergency.evidence || [];
    presented.auditTrail = auditTrail.map((log) => ({
      _id: String(log._id),
      action: log.action,
      description: log.description,
      actor: log.admin ? { name: log.admin.name, role: log.actorRole || log.admin.role } : null,
      createdAt: log.createdAt
    }));
    if (req.user.role === 'emergency_field_worker') {
      const activeTeam = teams.find((team) => team.members.some((member) => String(member.user?._id || member.user) === String(req.user._id) && member.status !== 'RELEASED'));
      if (activeTeam) {
        const member = activeTeam.members.find((entry) => String(entry.user?._id || entry.user) === String(req.user._id) && entry.status === 'ACTIVE');
        presented.activeTeam = {
          _id: String(activeTeam._id),
          title: activeTeam.title,
          teamCode: activeTeam.teamCode,
          memberStatus: member.status,
          acceptedAt: member.acceptedAt || null,
          fieldWorkStartedAt: member.fieldWorkStartedAt || null,
          fieldWorkCompletedAt: member.fieldWorkCompletedAt || null
        };
      }
    }

    res.json({ success: true, emergency: presented });
  } catch (err) {
    handleOpsError(err, res, next);
  }
}

export async function reviewHead(req, res, next) {
  try {
    const emergency = await reviewEmergencyByHead({
      emergencyId: req.params.id,
      notes: req.body?.notes,
      actor: req.user
    });
    res.json({ success: true, emergency });
  } catch (err) {
    handleOpsError(err, res, next);
  }
}

export async function classify(req, res, next) {
  try {
    const emergency = await classifyAndPrioritize({
      emergencyId: req.params.id,
      emergencyType: req.body?.emergencyType,
      priority: req.body?.priority,
      notes: req.body?.notes,
      actor: req.user
    });
    res.json({ success: true, emergency });
  } catch (err) {
    handleOpsError(err, res, next);
  }
}

export async function assignEDO(req, res, next) {
  try {
    const emergency = await assignDepartmentOfficer({
      emergencyId: req.params.id,
      edoId: req.body?.edoId,
      actor: req.user
    });
    res.json({ success: true, emergency });
  } catch (err) {
    handleOpsError(err, res, next);
  }
}

export async function reviewEDO(req, res, next) {
  try {
    const emergency = await reviewEmergencyByEDO({
      emergencyId: req.params.id,
      notes: req.body?.notes,
      actor: req.user
    });
    res.json({ success: true, emergency });
  } catch (err) {
    handleOpsError(err, res, next);
  }
}

export async function assignEO(req, res, next) {
  try {
    const emergency = await assignEmergencyOfficer({
      emergencyId: req.params.id,
      eoId: req.body?.eoId,
      actor: req.user
    });
    res.json({ success: true, emergency });
  } catch (err) {
    handleOpsError(err, res, next);
  }
}

export async function acceptIncident(req, res, next) {
  try {
    const emergency = await acceptEmergencyByOfficer({
      emergencyId: req.params.id,
      actor: req.user
    });
    res.json({ success: true, emergency });
  } catch (err) {
    handleOpsError(err, res, next);
  }
}

export async function createTeam(req, res, next) {
  try {
    const { team, emergency } = await createTaskTeam({
      emergencyId: req.params.id,
      title: req.body?.title,
      kind: req.body?.kind,
      responseType: req.body?.responseType,
      fieldWorkerIds: req.body?.fieldWorkerIds || [],
      notes: req.body?.notes,
      actor: req.user
    });
    res.status(201).json({ success: true, team, emergency });
  } catch (err) {
    handleOpsError(err, res, next);
  }
}

export async function createRoster(req, res, next) {
  try {
    const team = await createRosterTeam({
      title: req.body?.title,
      kind: 'ROSTER',
      responseType: req.body?.responseType,
      fieldWorkerIds: req.body?.fieldWorkerIds || [],
      actor: req.user
    });
    res.status(201).json({ success: true, team });
  } catch (err) {
    handleOpsError(err, res, next);
  }
}

export async function attachRoster(req, res, next) {
  try {
    const result = await attachRosterTeam({
      emergencyId: req.params.id,
      rosterTeamId: req.body?.rosterTeamId,
      actor: req.user
    });
    res.json({ success: true, ...result });
  } catch (err) {
    handleOpsError(err, res, next);
  }
}

export async function addTeamWorker(req, res, next) {
  try {
    const result = await addWorkerToTeam({
      emergencyId: req.params.id,
      teamId: req.params.teamId,
      workerId: req.body?.workerId,
      actor: req.user
    });
    res.json({ success: true, ...result });
  } catch (err) {
    handleOpsError(err, res, next);
  }
}

export async function releaseTeamWorker(req, res, next) {
  try {
    const result = await releaseWorkerFromTeam({
      emergencyId: req.params.id,
      teamId: req.params.teamId,
      workerId: req.params.workerId,
      reason: req.body?.reason,
      actor: req.user
    });
    res.json({ success: true, ...result });
  } catch (err) {
    handleOpsError(err, res, next);
  }
}

export async function startResponse(req, res, next) {
  try {
    const emergency = await startResponseService({
      emergencyId: req.params.id,
      step: req.body?.step || 'active',
      notes: req.body?.notes,
      actor: req.user
    });
    res.json({ success: true, emergency });
  } catch (err) {
    handleOpsError(err, res, next);
  }
}

export async function updateProgress(req, res, next) {
  try {
    const emergency = await updateProgressService({
      emergencyId: req.params.id,
      percentage: req.body?.percentage,
      note: req.body?.note,
      actor: req.user
    });
    res.json({ success: true, emergency });
  } catch (err) {
    handleOpsError(err, res, next);
  }
}

export async function reportBlocker(req, res, next) {
  try {
    const emergency = await reportBlockerService({
      emergencyId: req.params.id,
      kind: req.body?.kind,
      description: req.body?.description,
      severity: req.body?.severity,
      requiredResource: req.body?.requiredResource,
      actor: req.user
    });
    res.json({ success: true, emergency });
  } catch (err) {
    handleOpsError(err, res, next);
  }
}

export async function resolveBlocker(req, res, next) {
  try {
    const emergency = await resolveBlockerService({
      emergencyId: req.params.id,
      blockerIndex: req.params.blockerIndex,
      resolution: req.body?.resolution,
      actor: req.user
    });
    res.json({ success: true, emergency });
  } catch (err) {
    handleOpsError(err, res, next);
  }
}

export async function escalate(req, res, next) {
  try {
    const emergency = await Emergency.findById(req.params.id);
    if (!emergency) return res.status(404).json({ success: false, message: 'Emergency not found.' });

    const result = await raiseEscalation({
      emergency,
      actor: req.user,
      reason: req.body?.reason
    });
    res.json({ success: true, ...result });
  } catch (err) {
    handleOpsError(err, res, next);
  }
}

export async function resolveEscalation(req, res, next) {
  try {
    const emergency = await Emergency.findById(req.params.id);
    if (!emergency) return res.status(404).json({ success: false, message: 'Emergency not found.' });

    const escalation = await EmergencyEscalation.findById(req.params.escalationId);
    if (!escalation) return res.status(404).json({ success: false, message: 'Escalation record not found.' });

    const result = await resolveEscalationService({
      emergency,
      actor: req.user,
      escalation,
      resolution: req.body?.resolution,
      resumeStatus: req.body?.resumeStatus
    });
    res.json({ success: true, emergency: result });
  } catch (err) {
    handleOpsError(err, res, next);
  }
}

export async function workerComplete(req, res, next) {
  try {
    const result = await fieldWorkerComplete({
      emergencyId: req.params.id,
      notes: req.body?.notes,
      actor: req.user
    });
    res.json({ success: true, ...result });
  } catch (err) {
    handleOpsError(err, res, next);
  }
}

export async function updateFieldAssignment(req, res, next) {
  try {
    const result = await updateFieldWorkerAssignment({
      emergencyId: req.params.id,
      step: req.body?.step,
      actor: req.user
    });
    res.json({ success: true, ...result });
  } catch (err) {
    handleOpsError(err, res, next);
  }
}

export async function completeResponse(req, res, next) {
  try {
    const emergency = await officerCompleteResponse({
      emergencyId: req.params.id,
      notes: req.body?.notes,
      actor: req.user
    });
    res.json({ success: true, emergency });
  } catch (err) {
    handleOpsError(err, res, next);
  }
}

export async function reviewCompletion(req, res, next) {
  try {
    const emergency = await reviewResponseCompletion({
      emergencyId: req.params.id,
      notes: req.body?.notes,
      actor: req.user
    });
    res.json({ success: true, emergency });
  } catch (err) {
    handleOpsError(err, res, next);
  }
}

export async function closeIncident(req, res, next) {
  try {
    const emergency = await headCloseEmergency({
      emergencyId: req.params.id,
      notes: req.body?.notes,
      actor: req.user
    });
    res.json({ success: true, emergency });
  } catch (err) {
    handleOpsError(err, res, next);
  }
}

export async function cancelIncident(req, res, next) {
  try {
    const emergency = await headCancelEmergency({
      emergencyId: req.params.id,
      reason: req.body?.reason,
      actor: req.user
    });
    res.json({ success: true, emergency });
  } catch (err) {
    handleOpsError(err, res, next);
  }
}

export async function addDirective(req, res, next) {
  try {
    const emergency = await addInstruction({
      emergencyId: req.params.id,
      text: req.body?.text,
      actor: req.user
    });
    res.json({ success: true, emergency });
  } catch (err) {
    handleOpsError(err, res, next);
  }
}

export async function listStaff(req, res, next) {
  try {
    const staff = await assignableStaff(req.user, { role: req.query.role });
    res.json({ success: true, staff });
  } catch (err) {
    handleOpsError(err, res, next);
  }
}

export async function listRosters(req, res, next) {
  try {
    const filter = { kind: 'ROSTER', status: 'FORMED' };
    if (req.user.role !== 'admin') filter.officer = req.user._id;
    const rosters = await EmergencyResponseTeam.find(filter)
      .populate('officer', 'name email phone')
      .populate('members.user', 'name role availability');
    res.json({ success: true, rosters });
  } catch (err) {
    handleOpsError(err, res, next);
  }
}
