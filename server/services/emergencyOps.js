import mongoose from 'mongoose';
import User from '../models/User.js';
import Emergency from '../models/Emergency.js';
import Notification from '../models/Notification.js';
import ActivityLog from '../models/ActivityLog.js';
import EmergencyResponseTeam from '../models/EmergencyResponseTeam.js';
import EmergencyResponseAssignment from '../models/EmergencyResponseAssignment.js';
import EmergencyEscalation from '../models/EmergencyEscalation.js';
import { emitEmergencyEvent } from '../realtime/emergencyRealtime.js';
import {
  CASE_ASSIGNMENT, CATEGORY_TO_TYPE, COMMAND_ROLES, EMERGENCY_ROLES, HEAD_ROLE, LEGACY_ASSIGNMENT_STATUS,
  LEGACY_SEVERITY, LEGACY_STATUS, PRIORITIES, PRIORITY_RANK, RESOURCE_HOLDING_STATUSES, SEVERITY_PRIORITY,
  TERMINAL_STATUSES, TRANSITION_RULES, TYPE_TO_CATEGORY, WORKFLOW, opsLabel, priorityWeight, RESPONSE_TYPES, EMERGENCY_TYPES
} from '../config/emergencyOps.js';

export class OpsError extends Error {
  constructor(status, message, details = null) {
    super(message);
    this.name = 'OpsError';
    this.status = status;
    this.details = details;
  }
}

export async function isWorkingFieldParticipant(emergency, actor) {
  if (!actor) return false;
  return Boolean(await EmergencyResponseTeam.exists({
    emergency: emergency._id,
    status: 'FORMED',
    members: { $elemMatch: { user: actor._id, status: 'ACTIVE', fieldWorkStartedAt: { $ne: null } } }
  }));
}

export const statusOf = (emergency) => emergency?.ops?.workflowStatus || WORKFLOW.SUBMITTED;
export const isTerminal = (status) => TERMINAL_STATUSES.includes(status);
export const incidentLabel = (emergency) => emergency?.emergencyId || String(emergency?._id || '');
export const describeIncident = (emergency) => `${incidentLabel(emergency)} — ${emergency?.title || 'Emergency'}`;
export const isEmergencyParticipant = (role) => EMERGENCY_ROLES.includes(role) || role === 'admin';
export const idOf = (value) => (value?._id ? String(value._id) : value ? String(value) : '');

/** The one active Emergency Department Head, or null when the seat is empty. */
export function findActiveHead() {
  return User.findOne({ role: HEAD_ROLE, status: 'active' })
    .select('name email phone photoURL role status departmentName department updatedAt');
}

export async function requiresActiveHead() {
  const head = await findActiveHead();
  if (!head) {
    throw new OpsError(409, 'No active Emergency Head is appointed, so this action cannot proceed. Ask the Super Admin to appoint one.');
  }
  return head;
}

/** True only for the single active Head account (or a Super Admin override). */
export async function hasHeadAuthority(actor) {
  if (!actor) return false;
  if (actor.role === 'admin') return true;
  if (actor.role !== HEAD_ROLE) return false;
  const head = await findActiveHead();
  return Boolean(head && idOf(head) === idOf(actor));
}

export async function assertHeadAuthority(actor) {
  if (!(await hasHeadAuthority(actor))) {
    throw new OpsError(403, 'Only the Emergency Head (or the Super Admin) may perform this action.');
  }
  return true;
}

/** The actor holding the incident at the Emergency Department Officer stage. */
export function isAssignedDepartmentOfficer(emergency, actor) {
  return Boolean(actor && idOf(emergency?.ops?.departmentOfficer) && idOf(emergency.ops.departmentOfficer) === idOf(actor));
}

/** The actor holding the incident at the Emergency Officer (field lead) stage. */
export function isAssignedEmergencyOfficer(emergency, actor) {
  return Boolean(actor && idOf(emergency?.ops?.emergencyOfficer) && idOf(emergency.ops.emergencyOfficer) === idOf(actor));
}

/** Is this actor an active member of a live response team on the incident? */
export async function isFieldParticipant(emergency, actor) {
  if (!actor) return false;
  const team = await EmergencyResponseTeam.exists({
    emergency: emergency._id,
    status: 'FORMED',
    members: { $elemMatch: { user: actor._id, status: { $ne: 'RELEASED' } } }
  });
  return Boolean(team);
}

export async function isActiveFieldParticipant(emergency, actor) {
  if (!actor) return false;
  return Boolean(await EmergencyResponseTeam.exists({
    emergency: emergency._id,
    status: 'FORMED',
    members: { $elemMatch: { user: actor._id, status: 'ACTIVE' } }
  }));
}

export async function assertIncidentAccess(emergency, actor) {
  if (!emergency || !actor) throw new OpsError(404, 'Emergency not found.');
  if (actor.role === 'admin') return true;
  if (actor.role === HEAD_ROLE) {
    if (await hasHeadAuthority(actor)) return true;
    throw new OpsError(403, 'Only the active Emergency Head may view command records.');
  }
  if (actor.role === 'emergency_department_officer' && isAssignedDepartmentOfficer(emergency, actor)) return true;
  if (actor.role === 'emergency_officer' && isAssignedEmergencyOfficer(emergency, actor)) return true;
  if (actor.role === 'emergency_field_worker' && await isFieldParticipant(emergency, actor)) return true;
  throw new OpsError(404, 'Emergency not found.');
}

/** Valid target statuses from the incident's current status (server truth). */
export const nextStatuses = (status) =>
  Object.entries(TRANSITION_RULES).filter(([, rule]) => rule.from.includes(status)).map(([target]) => target);

export const canDriveTransition = (role, targetStatus) => Boolean(TRANSITION_RULES[targetStatus]?.roles?.includes(role));
export const canAssignRole = (actorRole, targetRole) => Boolean(CASE_ASSIGNMENT[actorRole]?.includes(targetRole));
export const assignableRoles = (actorRole) => CASE_ASSIGNMENT[actorRole] || [];

export function fail(request, response, status, message, details = null) {
  response.status(status).json({ success: false, message, ...(details ? { details } : {}) });
}

export async function ensureSingletonHeadIndex() {
  const name = 'uniq_single_active_emergency_head';
  const collection = User.collection;
  const existing = (await collection.indexes().catch(() => [])).find((index) => index.name === name);
  if (existing) return { created: false, name };
  try {
    await collection.createIndex(
      { role: 1, status: 1 },
      { unique: true, name, partialFilterExpression: { role: HEAD_ROLE, status: 'active' } }
    );
    return { created: true, name };
  } catch (error) {
    if (error?.code === 11000 || error?.codeName === 'DuplicateKey' || /duplicate key/i.test(error?.message || '')) {
      const duplicates = await User.countDocuments({ role: HEAD_ROLE, status: 'active' });
      throw new OpsError(409, `The single-Head rule cannot be enforced: ${duplicates} active Emergency Heads exist. Replace all but one, then restart the API.`);
    }
    throw error;
  }
}

const STATUS_STAMPS = Object.freeze({
  [WORKFLOW.ASSIGNED_EO]: ['dispatchedAt'],
  [WORKFLOW.ACCEPTED_EO]: ['ops.acceptedAt', 'acknowledgedAt'],
  [WORKFLOW.TEAM_FORMED]: ['ops.teamFormedAt'],
  [WORKFLOW.EN_ROUTE]: ['ops.enRouteAt', 'enRouteAt'],
  [WORKFLOW.ON_SCENE]: ['ops.onSceneAt', 'arrivalAt'],
  [WORKFLOW.RESPONSE_ACTIVE]: ['ops.responseStartedAt'],
  [WORKFLOW.FIELD_WORK_COMPLETED]: ['ops.workCompletedAt'],
  [WORKFLOW.RESOLVED]: ['ops.resolvedAt', 'resolvedAt'],
  [WORKFLOW.CLOSED]: ['ops.closedAt', 'closedAt'],
  [WORKFLOW.CANCELLED]: ['ops.cancelledAt']
});

export function stampFor(status, now = new Date()) {
  return Object.fromEntries((STATUS_STAMPS[status] || []).map((field) => [field, now]));
}

/** Real-time event name for a status, so dashboards can react precisely. */
const OPS_EVENTS = Object.freeze({
  [WORKFLOW.SUBMITTED]: 'EMERGENCY_SUBMITTED',
  [WORKFLOW.HEAD_REVIEW]: 'EMERGENCY_HEAD_REVIEWED',
  [WORKFLOW.ASSIGNED_EDO]: 'EMERGENCY_ASSIGNED_TO_DEPARTMENT_OFFICER',
  [WORKFLOW.EDO_REVIEW]: 'EMERGENCY_DEPARTMENT_OFFICER_REVIEWING',
  [WORKFLOW.ASSIGNED_EO]: 'EMERGENCY_ASSIGNED_TO_OFFICER',
  [WORKFLOW.ACCEPTED_EO]: 'EMERGENCY_OFFICER_ACCEPTED',
  [WORKFLOW.TEAM_FORMED]: 'EMERGENCY_TEAM_FORMED',
  [WORKFLOW.EN_ROUTE]: 'EMERGENCY_EN_ROUTE',
  [WORKFLOW.ON_SCENE]: 'EMERGENCY_ON_SCENE',
  [WORKFLOW.RESPONSE_ACTIVE]: 'EMERGENCY_RESPONSE_ACTIVE',
  [WORKFLOW.ESCALATED]: 'EMERGENCY_ESCALATED',
  [WORKFLOW.FIELD_WORK_COMPLETED]: 'EMERGENCY_FIELD_WORK_COMPLETED',
  [WORKFLOW.RESOLVED]: 'EMERGENCY_RESOLVED_PENDING_CONFIRMATION',
  [WORKFLOW.CLOSED]: 'EMERGENCY_CLOSED',
  [WORKFLOW.CANCELLED]: 'EMERGENCY_CANCELLED',
  [WORKFLOW.FALSE_REPORT]: 'EMERGENCY_MARKED_FALSE_REPORT'
});
const OPS_EVENT_ALIASES = Object.freeze({
  [WORKFLOW.SUBMITTED]: 'emergencyCreated',
  [WORKFLOW.ASSIGNED_EDO]: 'emergencyAssigned',
  [WORKFLOW.ASSIGNED_EO]: 'emergencyOfficerAssigned',
  [WORKFLOW.TEAM_FORMED]: 'emergencyTeamCreated',
  [WORKFLOW.EN_ROUTE]: 'emergencyStarted',
  [WORKFLOW.RESPONSE_ACTIVE]: 'emergencyStarted',
  [WORKFLOW.ESCALATED]: 'emergencyEscalated',
  [WORKFLOW.FIELD_WORK_COMPLETED]: 'emergencyResponseCompleted',
  [WORKFLOW.CLOSED]: 'emergencyClosed'
});

export function emitOpsUpdate(emergency, { userIds = [], includeCitizen = false, extra = {} } = {}) {
  const status = statusOf(emergency);
  const recipients = [
    idOf(emergency.ops?.departmentOfficer),
    idOf(emergency.ops?.emergencyOfficer),
    idOf(emergency.ops?.activeEscalation?.raisedBy),
    ...userIds.map(idOf),
    ...(includeCitizen ? [idOf(emergency.citizen)] : [])
  ].filter(Boolean);
  const payload = {
    emergencyId: idOf(emergency._id),
    reference: incidentLabel(emergency),
    title: emergency.title,
    workflowStatus: status,
    priority: emergency.ops?.priority || '',
    departmentOfficer: idOf(emergency.ops?.departmentOfficer) || null,
    emergencyOfficer: idOf(emergency.ops?.emergencyOfficer) || null,
    at: new Date().toISOString(),
    ...extra
  };
  const event = OPS_EVENTS[status] || 'EMERGENCY_OPS_UPDATED';
  emitEmergencyEvent(event, payload, { userIds: recipients, roles: [HEAD_ROLE] });
  if (OPS_EVENT_ALIASES[status]) emitEmergencyEvent(OPS_EVENT_ALIASES[status], payload, { userIds: recipients, roles: [HEAD_ROLE] });
  emitEmergencyEvent('EMERGENCY_OPS_UPDATED', payload, { userIds: recipients, roles: EMERGENCY_ROLES });
  return payload;
}

/** Operational notification (in-app). Never sent to a missing or duplicate id. */
export async function notifyUsers(userIds, message, { emergency = null, kind = 'emergency' } = {}) {
  const recipients = [...new Set(userIds.map(idOf).filter(Boolean))];
  if (!recipients.length) return 0;
  const docs = recipients.map((recipient) => ({
    recipient,
    relatedType: 'emergency',
    relatedId: emergency?._id || null,
    message: String(message).slice(0, 300),
    type: kind
  }));
  try {
    await Notification.insertMany(docs, { ordered: false });
    emitEmergencyEvent('emergencyNotificationCreated', { emergencyId: idOf(emergency?._id), count: docs.length }, { userIds: recipients });
  } catch (error) {
    // A notification problem must never fail the operational action itself.
    if (error?.code !== 11000) console.error('Emergency notification failed:', error.message);
  }
  return recipients.length;
}

/** Audit trail for the incident: one ActivityLog row per workflow action. */
export async function auditAction(actor, action, emergency, { description = '', metadata = {}, result = 'success' } = {}) {
  try {

    await ActivityLog.create({
      admin: actor._id,
      actorRole: actor.role || '',
      action,
      targetType: 'emergency',
      targetId: emergency._id,
      targetName: incidentLabel(emergency),
      description: String(description).slice(0, 500),
      metadata,
      result
    });
  } catch (error) {
    console.error('Emergency audit write failed:', error.message);
  }
}

export async function applyTransition({ emergency, to, actor, note = '', extraSet = {}, allowFrom = null, requireFrom = null }) {
  const rule = TRANSITION_RULES[to];
  if (!rule) throw new OpsError(409, `Unknown emergency workflow status "${to}".`);
  const from = statusOf(emergency);
  if (isTerminal(from)) throw new OpsError(409, 'This incident is already closed out, so its status cannot change.');
  if (requireFrom && !requireFrom.includes(from)) {
    throw new OpsError(409, `This action needs the incident to be ${requireFrom.map(opsLabel).join(' or ')}, but it is ${opsLabel(from)}.`);
  }
  if (!rule.from.includes(from)) {
    throw new OpsError(409, `Cannot move the incident from ${opsLabel(from)} to ${opsLabel(to)}.`);
  }
  if (!canDriveTransition(actor.role, to)) {
    throw new OpsError(403, `A ${opsLabel(actor.role)} cannot move an incident to ${opsLabel(to)}.`);
  }
  const now = new Date();
  const updated = await Emergency.findOneAndUpdate(
    { _id: emergency._id, 'ops.workflowStatus': { $in: allowFrom || rule.from } },
    {
      $set: { 'ops.workflowStatus': to, status: LEGACY_STATUS[to] || 'received', ...stampFor(to, now), ...extraSet },
      $push: { activity: { action: `ops_${to.toLowerCase()}`, actorRole: actor.role || '', timestamp: now, note: String(note).slice(0, 500) } }
    },
    { new: true }
  );
  if (!updated) throw new OpsError(409, 'This incident changed while you were working on it. Reload and try again.');
  await syncAssignments(updated);
  return updated;
}

/** Keep the legacy assignment records in step with the operations status. */
export async function syncAssignments(emergency) {
  const status = LEGACY_ASSIGNMENT_STATUS[statusOf(emergency)] || 'assigned';
  const now = new Date();
  const set = { status };
  if (status === 'accepted') set.acceptedAt = emergency.ops?.acceptedAt || now;
  if (['on_scene', 'responding'].includes(status)) set.arrivedAt = emergency.ops?.onSceneAt || now;
  if (['completed', 'cancelled'].includes(status)) set.completedAt = now;
  await EmergencyResponseAssignment.updateMany(
    { emergency: emergency._id, status: { $nin: ['completed', 'cancelled'] } },
    { $set: set }
  );
}

export async function initializeOps(emergency, actor = null) {
  if (statusOf(emergency) !== WORKFLOW.SUBMITTED) return emergency;
  const type = CATEGORY_TO_TYPE[emergency.category] || 'OTHER';
  const priority = SEVERITY_PRIORITY[emergency.severity] || 'HIGH';
  const head = await findActiveHead();
  const updated = await Emergency.findOneAndUpdate(
    { _id: emergency._id },
    {
      $set: {
        'ops.workflowStatus': WORKFLOW.SUBMITTED,
        'ops.emergencyType': type,
        'ops.priority': priority,
        'ops.responseTypes': [],
        'ops.reviewed': false,
        'ops.completionPercent': 0,
        'ops.progress': [],
        'ops.blockers': [],
        'ops.instructions': [],
        'ops.priorityHistory': [{
          priority,
          changedBy: actor?._id || null,
          changedByRole: actor?.role || 'citizen',
          reason: 'Priority inherited from the submitted report.',
          at: new Date()
        }],
        emergencyHead: head?._id || null
      }
    },
    { new: true }
  );
  if (updated) {
    await auditAction({ _id: actor?._id || emergency.citizen, role: actor?.role || 'citizen' }, 'emergency_ops_received', updated, {
      description: `Incident received by the Emergency Department as ${opsLabel(WORKFLOW.SUBMITTED)}.`,
      metadata: { workflowStatus: WORKFLOW.SUBMITTED, priority, emergencyType: type }
    });
    emitEmergencyEvent('emergencyCreated', { emergencyId: idOf(updated._id), reference: incidentLabel(updated) }, { roles: [HEAD_ROLE] });
  }
  return updated || emergency;
}

const person = (value) => (value && value.name
  ? { _id: idOf(value), name: value.name, email: value.email || '', phone: value.phone || '', role: value.role || '', photoURL: value.photoURL || '' }
  : null);

/** The shape every emergency dashboard reads. One payload, no fabrication. */
export function presentEmergency(emergency, { includeCitizen = false, teams = [], escalations = [] } = {}) {
  const ops = emergency.ops || {};
  const status = statusOf(emergency);
  return {
    _id: idOf(emergency._id),
    reference: incidentLabel(emergency),
    title: emergency.title,
    description: emergency.description || '',
    category: emergency.category,
    subcategory: emergency.subcategory || '',
    source: emergency.source,
    discreet: Boolean(emergency.discreet),
    visibility: emergency.visibility,
    location: {
      address: emergency.location?.address || '',
      landmark: emergency.location?.landmark || '',
      latitude: emergency.location?.latitude ?? null,
      longitude: emergency.location?.longitude ?? null
    },
    citizen: includeCitizen
      ? { _id: idOf(emergency.citizen), name: emergency.citizenName, phone: emergency.citizenPhone || '', email: emergency.citizenEmail || '' }
      : { _id: idOf(emergency.citizen), name: emergency.citizenName, phone: '', email: '' },
    personDetails: includeCitizen ? (emergency.personDetails || null) : null,
    sosContacts: includeCitizen ? (emergency.sosContacts || []) : [],
    legacyStatus: emergency.status,
    severity: emergency.severity,
    workflowStatus: status,
    workflowLabel: opsLabel(status),
    priority: ops.priority || SEVERITY_PRIORITY[emergency.severity] || 'MEDIUM',
    emergencyType: ops.emergencyType || CATEGORY_TO_TYPE[emergency.category] || 'OTHER',
    responseTypes: ops.responseTypes || [],
    reviewed: Boolean(ops.reviewed),
    reviewNotes: ops.reviewNotes || '',
    reviewedAt: ops.reviewedAt || null,
    departmentOfficer: person(ops.departmentOfficer),
    emergencyOfficer: person(ops.emergencyOfficer),
    head: person(emergency.emergencyHead),
    completionPercent: ops.completionPercent || 0,
    timestamps: {
      receivedAt: emergency.createdAt,
      dispatchedAt: emergency.dispatchedAt || null,
      acceptedAt: ops.acceptedAt || null,
      teamFormedAt: ops.teamFormedAt || null,
      enRouteAt: ops.enRouteAt || null,
      onSceneAt: ops.onSceneAt || null,
      responseStartedAt: ops.responseStartedAt || null,
      workCompletedAt: ops.workCompletedAt || null,
      resolvedAt: ops.resolvedAt || null,
      closedAt: ops.closedAt || null,
      cancelledAt: ops.cancelledAt || null
    },
    progress: (ops.progress || []).slice(-40).reverse(),
    blockers: (ops.blockers || []).slice(-20).reverse(),
    evidence: emergency.evidence || [],
    instructions: (ops.instructions || []).slice(-40).reverse(),
    priorityHistory: (ops.priorityHistory || []).slice(-20).reverse(),
    resolutionNotes: ops.resolutionNotes || '',
    closingNotes: ops.closingNotes || '',
    cancellationReason: ops.cancellationReason || '',
    falseReportReason: ops.falseReportReason || '',
    activeEscalation: ops.activeEscalation?.id
      ? {
        _id: idOf(ops.activeEscalation.id),
        level: ops.activeEscalation.level,
        reason: ops.activeEscalation.reason,
        previousStatus: ops.activeEscalation.previousStatus,
        raisedBy: idOf(ops.activeEscalation.raisedBy),
        raisedAt: ops.activeEscalation.raisedAt
      }
      : null,
    nextStatuses: nextStatuses(status),
    teams: teams.map((team) => ({
      _id: idOf(team._id),
      teamCode: team.teamCode,
      kind: team.kind,
      title: team.title,
      responseType: team.responseType || '',
      status: team.status,
      officer: idOf(team.officer),
      createdAt: team.createdAt,
      members: (team.members || []).map((member) => ({
        _id: idOf(member._id),
        user: idOf(member.user),
        name: member.name,
        role: member.role,
        status: member.status,
        joinedAt: member.joinedAt,
        fieldWorkCompletedAt: member.fieldWorkCompletedAt || null
      }))
    })),
    escalations: escalations.map((item) => ({
      _id: idOf(item._id),
      level: item.level,
      targetRole: item.targetRole,
      reason: item.reason,
      status: item.status,
      previousStatus: item.previousStatus,
      resolution: item.resolution || '',
      raisedBy: idOf(item.raisedBy),
      raisedAt: item.createdAt
    })),
    createdAt: emergency.createdAt,
    updatedAt: emergency.updatedAt
  };
}

export async function assignableStaff(actor, { role = '' } = {}) {
  const allowed = assignableRoles(actor.role);
  if (!allowed.length) {
    throw new OpsError(403, 'Your role cannot assign emergency staff.');
  }
  const wanted = role ? [role].filter((value) => allowed.includes(value)) : allowed;
  if (!wanted.length) {
    throw new OpsError(403, `A ${opsLabel(actor.role)} may only assign ${allowed.map(opsLabel).join(' or ')}.`);
  }
  const users = await User.find({ role: { $in: wanted }, status: 'active', availability: 'available' })
    .select('name role status availability activeTask activeEmergencyTeam email phone departmentName updatedAt')
    .sort({ availability: 1, name: 1 });
  return annotateStaff(users);
}

export async function annotateStaff(users) {
  const ids = users.map((user) => user._id);
  if (!ids.length) return [];
  const heldIncidents = await Emergency.find({
    $or: [{ 'ops.departmentOfficer': { $in: ids } }, { 'ops.emergencyOfficer': { $in: ids } }],
    'ops.workflowStatus': { $nin: [...TERMINAL_STATUSES, WORKFLOW.RESOLVED] }
  }).select('emergencyId title ops.workflowStatus ops.priority ops.departmentOfficer ops.emergencyOfficer');
  const teamIds = users.map((user) => user.activeEmergencyTeam).filter(Boolean);
  const teams = teamIds.length
    ? await EmergencyResponseTeam.find({ _id: { $in: teamIds }, status: 'FORMED' }).select('teamCode title emergency officer')
    : [];
  return users.map((user) => {
    const incident = heldIncidents.find((item) =>
      idOf(item.ops?.departmentOfficer) === idOf(user) || idOf(item.ops?.emergencyOfficer) === idOf(user));
    const team = teams.find((item) => idOf(item._id) === idOf(user.activeEmergencyTeam));
    return {
      _id: idOf(user._id),
      name: user.name,
      role: user.role,
      email: user.email || '',
      phone: user.phone || '',
      status: user.status,
      availability: user.availability,
      departmentName: user.departmentName || '',
      currentIncident: incident
        ? { _id: idOf(incident._id), reference: incident.emergencyId, title: incident.title, workflowStatus: incident.ops?.workflowStatus || '' }
        : null,
      currentTeam: team
        ? { _id: idOf(team._id), teamCode: team.teamCode, title: team.title, reference: team.emergency ? idOf(team.emergency) : null }
        : null,
      busy: user.availability === 'busy' || Boolean(incident)
    };
  });
}

export function escalationTargetFor(actorRole, emergency) {
  if (actorRole === 'emergency_field_worker') {
    return emergency?.ops?.emergencyOfficer
      ? { level: 'OFFICER', role: 'emergency_officer', userId: idOf(emergency.ops.emergencyOfficer) }
      : { level: 'DEPARTMENT_OFFICER', role: 'emergency_department_officer', userId: idOf(emergency?.ops?.departmentOfficer) };
  }
  if (actorRole === 'emergency_officer') {
    return { level: 'DEPARTMENT_OFFICER', role: 'emergency_department_officer', userId: idOf(emergency?.ops?.departmentOfficer) };
  }
  return { level: 'HEAD', role: HEAD_ROLE, userId: null };
}

/** The roles allowed to resolve an escalation raised at `level`. */
export function escalationResolvers(level) {
  if (level === 'OFFICER') return ['emergency_officer', 'emergency_department_officer', HEAD_ROLE, 'admin'];
  if (level === 'DEPARTMENT_OFFICER') return ['emergency_department_officer', HEAD_ROLE, 'admin'];
  return [HEAD_ROLE, 'admin'];
}

export async function raiseEscalation({ emergency, actor, reason }) {
  if (!reason || !String(reason).trim()) throw new OpsError(400, 'A reason is required to escalate an incident.');
  if (actor.role === HEAD_ROLE) await assertHeadAuthority(actor);
  else if (actor.role !== 'admin') {
    const assigned = actor.role === 'emergency_department_officer'
      ? isAssignedDepartmentOfficer(emergency, actor)
      : actor.role === 'emergency_officer'
        ? isAssignedEmergencyOfficer(emergency, actor)
        : actor.role === 'emergency_field_worker' && await isActiveFieldParticipant(emergency, actor);
    if (!assigned) throw new OpsError(403, 'You are not assigned to this emergency.');
  }
  const current = statusOf(emergency);
  if (isTerminal(current)) throw new OpsError(409, 'A closed incident cannot be escalated.');
  const target = escalationTargetFor(actor.role, emergency);
  const escalation = await EmergencyEscalation.create({
    emergency: emergency._id,
    raisedBy: actor._id,
    raisedByRole: actor.role || '',
    level: target.level,
    targetRole: target.role,
    targetUser: mongoose.Types.ObjectId.isValid(target.userId || '') ? new mongoose.Types.ObjectId(target.userId) : null,
    reason: String(reason).trim().slice(0, 600),
    previousStatus: current === WORKFLOW.ESCALATED
      ? (emergency.ops?.activeEscalation?.previousStatus || WORKFLOW.RESPONSE_ACTIVE)
      : current
  });

  const head = await findActiveHead();
  const now = new Date();
  const updated = await Emergency.findOneAndUpdate(
    { _id: emergency._id },
    {
      $set: {
        'ops.workflowStatus': WORKFLOW.ESCALATED,
        status: LEGACY_STATUS[WORKFLOW.ESCALATED],
        'ops.activeEscalation': {
          id: escalation._id,
          level: target.level,
          previousStatus: escalation.previousStatus,
          raisedBy: actor._id,
          raisedAt: now,
          reason: escalation.reason
        }
      },
      $push: { activity: { action: 'escalated', actorRole: actor.role || '', timestamp: now, note: escalation.reason } }
    },
    { new: true }
  );
  if (!updated) throw new OpsError(409, 'This incident changed while you were working on it. Reload and try again.');

  const message = `${incidentLabel(updated)} escalated to the ${opsLabel(target.role)}: ${escalation.reason}`;
  await notifyUsers([target.userId, idOf(head)].filter(Boolean), message, { emergency: updated });
  await auditAction(actor, 'emergency_escalated', updated, {
    description: message,
    metadata: { level: target.level, targetRole: target.role, previousStatus: escalation.previousStatus }
  });
  emitOpsUpdate(updated, { userIds: [target.userId].filter(Boolean), extra: { escalationLevel: target.level, reason: escalation.reason } });
  return { emergency: updated, escalation, target };
}

/** Close the live escalation and resume the exact work that was interrupted. */
export async function resolveEscalation({ emergency, actor, escalation, resolution, resumeStatus }) {
  if (!resolution || !String(resolution).trim()) throw new OpsError(400, 'Explain how the escalation was resolved.');
  if (!escalationResolvers(escalation.level).includes(actor.role)) {
    throw new OpsError(403, `This escalation was raised to the ${opsLabel(escalation.targetRole || escalation.level)}, so a ${opsLabel(actor.role)} cannot close it.`);
  }
  if (actor.role === HEAD_ROLE) await assertHeadAuthority(actor);
  else if (actor.role === 'emergency_department_officer' && !isAssignedDepartmentOfficer(emergency, actor)) {
    throw new OpsError(403, 'Only the assigned Emergency Department Officer may resolve this escalation.');
  } else if (actor.role === 'emergency_officer' && !isAssignedEmergencyOfficer(emergency, actor)) {
    throw new OpsError(403, 'Only the assigned Emergency Officer may resolve this escalation.');
  }
  const status = statusOf(emergency);
  const target = resumeStatus || escalation.previousStatus;
  const resumed = status === WORKFLOW.ESCALATED && target && target !== WORKFLOW.ESCALATED
    ? await applyTransition({
      emergency,
      to: target,
      actor,
      note: `Escalation resolved: ${resolution}`,
      requireFrom: [WORKFLOW.ESCALATED]
    })
    : emergency;

  await EmergencyEscalation.updateOne(
    { _id: escalation._id, status: 'OPEN' },
    { $set: { status: 'RESOLVED', resolution: String(resolution).trim().slice(0, 600), resolvedBy: actor._id, resolvedAt: new Date(), resumedAt: target } }
  );
  const cleared = await Emergency.findOneAndUpdate(
    { _id: emergency._id, 'ops.activeEscalation.id': escalation._id },
    { $set: { 'ops.activeEscalation': { id: null, level: '', previousStatus: '', raisedBy: null, raisedAt: null, reason: '' } } },
    { new: true }
  );
  const final = cleared || resumed;
  await auditAction(actor, 'emergency_escalation_resolved', final, {
    description: `${incidentLabel(final)} escalation resolved: ${resolution}`,
    metadata: { level: escalation.level, resumedAt: target }
  });
  await notifyUsers([idOf(escalation.raisedBy)], `${incidentLabel(final)}: your escalation was handled — ${resolution}`, { emergency: final });
  emitOpsUpdate(final, { userIds: [idOf(escalation.raisedBy)], extra: { escalationResolved: true } });
  return final;
}

export async function reviewEmergencyByHead({ emergencyId, notes = '', actor }) {
  await assertHeadAuthority(actor);
  const emergency = await Emergency.findById(emergencyId);
  if (!emergency) throw new OpsError(404, 'Emergency not found.');

  const updated = await applyTransition({
    emergency,
    to: WORKFLOW.HEAD_REVIEW,
    actor,
    note: notes || 'Reviewed by Emergency Department Head',
    allowFrom: [WORKFLOW.SUBMITTED, WORKFLOW.HEAD_REVIEW]
  });

  await auditAction(actor, 'emergency_reviewed', updated, {
    description: `Incident reviewed by Head: ${notes || 'Acknowledged'}`,
    metadata: { reviewNotes: notes }
  });

  await notifyUsers([idOf(updated.ops?.departmentOfficer)], `Emergency ${incidentLabel(updated)} was reviewed by the Emergency Head.`, { emergency: updated });
  emitOpsUpdate(updated);
  return updated;
}

export async function classifyAndPrioritize({ emergencyId, emergencyType, priority, notes = '', actor }) {
  await assertHeadAuthority(actor);
  const emergency = await Emergency.findById(emergencyId);
  if (!emergency) throw new OpsError(404, 'Emergency not found.');
  if (isTerminal(statusOf(emergency))) throw new OpsError(409, 'Closed emergencies cannot be reclassified.');

  if (emergencyType && !EMERGENCY_TYPES.includes(emergencyType)) {
    throw new OpsError(400, `Invalid emergency type "${emergencyType}".`);
  }
  if (priority && !PRIORITIES.includes(priority)) {
    throw new OpsError(400, `Invalid priority "${priority}".`);
  }

  const prevType = emergency.ops?.emergencyType || 'OTHER';
  const prevPriority = emergency.ops?.priority || 'MEDIUM';

  const type = emergencyType || prevType;
  const prio = priority || prevPriority;

  emergency.ops.emergencyType = type;
  emergency.ops.priority = prio;
  emergency.category = TYPE_TO_CATEGORY[type] || emergency.category;
  emergency.severity = LEGACY_SEVERITY[prio] || emergency.severity;
  emergency.priority = prio.toLowerCase();

  if (!emergency.ops.priorityHistory) emergency.ops.priorityHistory = [];
  emergency.ops.priorityHistory.push({
    priority: prio,
    changedBy: actor._id,
    at: new Date(),
    changedByRole: actor.role,
    reason: notes || 'Classified by Emergency Head'
  });

  await emergency.save();

  await auditAction(actor, 'emergency_classified', emergency, {
    description: `Classified as ${type} (${prio}): ${notes || 'Updated'}`,
    metadata: { previousType: prevType, newType: type, previousPriority: prevPriority, newPriority: prio }
  });

  emitOpsUpdate(emergency);
  if (prevPriority !== prio) emitEmergencyEvent('emergencyPriorityChanged', { emergencyId: emergency._id, previousPriority: prevPriority, priority: prio }, { roles: [HEAD_ROLE] });
  if (prevPriority !== prio || prevType !== type) {
    await notifyUsers([idOf(emergency.ops?.departmentOfficer), idOf(emergency.ops?.emergencyOfficer)], `Emergency ${incidentLabel(emergency)} was reclassified as ${prio} ${type}.`, { emergency });
  }
  return emergency;
}

export async function assignDepartmentOfficer({ emergencyId, edoId, actor }) {
  await assertHeadAuthority(actor);
  const emergency = await Emergency.findById(emergencyId);
  if (!emergency) throw new OpsError(404, 'Emergency not found.');

  const edo = await User.findOne({ _id: edoId, role: 'emergency_department_officer', status: 'active', availability: 'available' });
  if (!edo) throw new OpsError(404, 'Active Emergency Department Officer not found.');

  const updated = await applyTransition({
    emergency,
    to: WORKFLOW.ASSIGNED_EDO,
    actor,
    note: `Assigned to Department Officer ${edo.name}`,
    extraSet: {
      'ops.departmentOfficer': edo._id,
      'ops.assignedToEDOAt': new Date()
    },
    allowFrom: [WORKFLOW.SUBMITTED, WORKFLOW.HEAD_REVIEW, WORKFLOW.ASSIGNED_EDO, WORKFLOW.EDO_REVIEW]
  });

  await auditAction(actor, 'emergency_department_officer_assigned', updated, {
    description: `Assigned to EDO ${edo.name} (${edo.email})`,
    metadata: { edoId: edo._id, edoName: edo.name }
  });

  await notifyUsers([idOf(edo._id)], `You have been assigned to coordinate emergency ${incidentLabel(updated)}.`, { emergency: updated });
  emitEmergencyEvent('emergencyAssigned', { emergencyId: updated._id, officerId: edo._id, role: 'emergency_department_officer' });
  emitOpsUpdate(updated, { userIds: [idOf(edo._id)] });

  return updated;
}

export async function reviewEmergencyByEDO({ emergencyId, notes = '', actor }) {
  const emergency = await Emergency.findById(emergencyId);
  if (!emergency) throw new OpsError(404, 'Emergency not found.');

  if (actor.role !== 'admin' && String(emergency.ops?.departmentOfficer) !== String(actor._id)) {
    throw new OpsError(403, 'Only the assigned Emergency Department Officer may review this emergency.');
  }

  emergency.ops.reviewed = true;
  await emergency.save();

  let updated = emergency;
  if (statusOf(emergency) === WORKFLOW.ASSIGNED_EDO) {
    updated = await applyTransition({
      emergency,
      to: WORKFLOW.EDO_REVIEW,
      actor,
      note: notes || 'Reviewed by Department Officer',
      allowFrom: [WORKFLOW.ASSIGNED_EDO, WORKFLOW.EDO_REVIEW]
    });
  }

  await auditAction(actor, 'emergency_reviewed', updated, {
    description: `EDO reviewed incident: ${notes || 'Acknowledged'}`,
    metadata: { reviewNotes: notes }
  });

  await notifyUsers([idOf(updated.ops?.emergencyOfficer)], `Emergency ${incidentLabel(updated)} was reviewed by the Emergency Department Officer.`, { emergency: updated });
  emitOpsUpdate(updated);
  return updated;
}

export async function assignEmergencyOfficer({ emergencyId, eoId, actor }) {
  if (actor.role === 'emergency_department_head') {
    throw new OpsError(403, 'Head cannot assign Emergency Officers directly. Dispatches must flow through Department Officers.');
  }
  if (actor.role !== 'emergency_department_officer' && actor.role !== 'admin') {
    throw new OpsError(403, 'Only Emergency Department Officers may assign Emergency Officers.');
  }

  const emergency = await Emergency.findById(emergencyId);
  if (!emergency) throw new OpsError(404, 'Emergency not found.');

  if (actor.role !== 'admin' && String(emergency.ops?.departmentOfficer) !== String(actor._id)) {
    throw new OpsError(403, 'You are not the assigned Department Officer for this emergency.');
  }

  const eo = await User.findOne({ _id: eoId, role: 'emergency_officer', status: 'active', availability: 'available' });
  if (!eo) throw new OpsError(404, 'Active Emergency Officer not found.');

  const updated = await applyTransition({
    emergency,
    to: WORKFLOW.ASSIGNED_EO,
    actor,
    note: `Assigned to Tactical Officer ${eo.name}`,
    extraSet: {
      'ops.emergencyOfficer': eo._id,
      'ops.assignedToEOAt': new Date()
    },
    allowFrom: [WORKFLOW.ASSIGNED_EDO, WORKFLOW.EDO_REVIEW, WORKFLOW.ASSIGNED_EO]
  });

  await auditAction(actor, 'emergency_officer_assigned', updated, {
    description: `Assigned to EO ${eo.name}`,
    metadata: { eoId: eo._id, eoName: eo.name }
  });

  await notifyUsers([idOf(eo._id)], `You have been assigned as lead officer for emergency ${incidentLabel(updated)}.`, { emergency: updated });
  emitEmergencyEvent('emergencyAssigned', { emergencyId: updated._id, officerId: eo._id, role: 'emergency_officer' });
  emitOpsUpdate(updated, { userIds: [idOf(eo._id), idOf(emergency.ops?.departmentOfficer)] });

  return updated;
}

export async function acceptEmergencyByOfficer({ emergencyId, actor }) {
  const emergency = await Emergency.findById(emergencyId);
  if (!emergency) throw new OpsError(404, 'Emergency not found.');

  if (actor.role !== 'admin' && String(emergency.ops?.emergencyOfficer) !== String(actor._id)) {
    throw new OpsError(403, 'Only the assigned Emergency Officer may accept this emergency.');
  }

  const updated = await applyTransition({
    emergency,
    to: WORKFLOW.ACCEPTED_EO,
    actor,
    note: 'Accepted by Emergency Officer',
    extraSet: { 'ops.acceptedAt': new Date() },
    allowFrom: [WORKFLOW.ASSIGNED_EO, WORKFLOW.ACCEPTED_EO]
  });

  await auditAction(actor, 'emergency_officer_accepted', updated, {
    description: `Accepted by Tactical Officer ${actor.name}`
  });

  emitOpsUpdate(updated, { userIds: [idOf(emergency.ops?.departmentOfficer)] });
  return updated;
}

export async function createTaskTeam({ emergencyId, title, kind = 'TASK', responseType = 'OTHER', fieldWorkerIds = [], notes = '', actor }) {
  if (actor.role === 'emergency_department_head' || actor.role === 'emergency_department_officer') {
    throw new OpsError(403, 'Only Emergency Officers may form response teams.');
  }
  if (actor.role !== 'emergency_officer' && actor.role !== 'admin') {
    throw new OpsError(403, 'Only Emergency Officers may form response teams.');
  }

  const emergency = await Emergency.findById(emergencyId);
  if (!emergency) throw new OpsError(404, 'Emergency not found.');

  if (actor.role !== 'admin' && String(emergency.ops?.emergencyOfficer) !== String(actor._id)) {
    throw new OpsError(403, 'Only the assigned Emergency Officer may form response teams for this incident.');
  }
  if (![WORKFLOW.ACCEPTED_EO, WORKFLOW.TEAM_FORMED].includes(statusOf(emergency))) {
    throw new OpsError(409, 'Accept the emergency before forming response teams.');
  }

  const teamCode = `TEAM-${Date.now().toString(36).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;

  const normalizeResponseType = (type) => {
    if (RESPONSE_TYPES.includes(type)) return type;
    const upper = String(type || '').toUpperCase();
    if (upper.includes('FIRE')) return 'FIRE_RESPONSE';
    if (upper.includes('MEDIC')) return 'MEDICAL_RESPONSE';
    if (upper.includes('SECUR') || upper.includes('CRIME')) return 'SECURITY_RESPONSE';
    if (upper.includes('RESCUE') || upper.includes('ACCIDENT') || upper.includes('DISASTER')) return 'RESCUE_RESPONSE';
    return 'MULTI_AGENCY_RESPONSE';
  };

  const team = new EmergencyResponseTeam({
    teamCode,
    title: title || `Response Unit ${teamCode}`,
    kind: 'TASK',
    responseType: normalizeResponseType(responseType || emergency.ops?.emergencyType),
    officer: actor._id,
    emergency: emergency._id,
    status: 'FORMED',
    notes,
    members: []
  });

  const bookedWorkerIds = [];
  try {
    for (const wid of fieldWorkerIds) {
      const worker = await User.findOne({ _id: wid, role: 'emergency_field_worker', status: 'active' });
      if (!worker) throw new OpsError(404, `Worker ${wid} not found or inactive.`);

      const booked = await User.findOneAndUpdate(
        { _id: wid, role: 'emergency_field_worker', status: 'active', availability: 'available', activeEmergencyTeam: null },
        { $set: { availability: 'busy', activeEmergencyTeam: team._id, availabilityChangedAt: new Date() } },
        { new: true }
      );

      if (!booked) {
        throw new OpsError(409, `Field worker ${worker.name} is already busy or booked on another team.`);
      }

      bookedWorkerIds.push(wid);
      team.members.push({
        user: worker._id,
        name: worker.name,
        role: worker.role,
        status: 'ACTIVE',
        joinedAt: new Date()
      });
    }
    await team.save();
  } catch (err) {
    if (bookedWorkerIds.length > 0) {
      await User.updateMany(
        { _id: { $in: bookedWorkerIds }, activeEmergencyTeam: team._id },
        { $set: { availability: 'available', activeEmergencyTeam: null } }
      );
    }
    throw err;
  }

  await EmergencyResponseAssignment.create({
    emergency: emergency._id,
    team: team._id,
    emergencyOfficer: actor._id,
    fieldWorkers: bookedWorkerIds,
    responseType: team.responseType,
    status: 'assigned',
    assignedAt: new Date()
  });

  let updatedEmergency = emergency;
  if ([WORKFLOW.ACCEPTED_EO, WORKFLOW.ASSIGNED_EO].includes(statusOf(emergency))) {
    updatedEmergency = await applyTransition({
      emergency,
      to: WORKFLOW.TEAM_FORMED,
      actor,
      note: `Team ${teamCode} formed with ${bookedWorkerIds.length} worker(s).`,
      allowFrom: [WORKFLOW.ASSIGNED_EO, WORKFLOW.ACCEPTED_EO, WORKFLOW.TEAM_FORMED]
    });
  }

  await auditAction(actor, 'emergency_response_team_formed', updatedEmergency, {
    description: `Response Team ${teamCode} created with ${bookedWorkerIds.length} worker(s).`,
    metadata: { teamId: team._id, teamCode, workerCount: bookedWorkerIds.length }
  });

  if (bookedWorkerIds.length > 0) {
    await notifyUsers(bookedWorkerIds, `You have been deployed to Response Team ${teamCode} for emergency ${incidentLabel(updatedEmergency)}.`, { emergency: updatedEmergency });
  }

  emitEmergencyEvent('emergencyTeamFormed', { emergencyId: updatedEmergency._id, teamId: team._id });
  emitOpsUpdate(updatedEmergency, { userIds: [...bookedWorkerIds, idOf(emergency.ops?.departmentOfficer)] });

  return { team, emergency: updatedEmergency };
}

export async function createRosterTeam({ title, kind = 'ROSTER', responseType = 'OTHER', fieldWorkerIds = [], actor }) {
  if (actor.role !== 'emergency_officer' && actor.role !== 'admin') {
    throw new OpsError(403, 'Only Emergency Officers may create standing roster teams.');
  }

  const teamCode = `ROSTER-${Date.now().toString(36).toUpperCase()}`;
  const team = new EmergencyResponseTeam({
    teamCode,
    title: title || `Standing Unit ${teamCode}`,
    kind: 'ROSTER',
    responseType,
    officer: actor._id,
    status: 'FORMED',
    members: []
  });

  const workerIds = [...new Set(fieldWorkerIds.map(String))];
  if (workerIds.length !== fieldWorkerIds.length || workerIds.some((id) => !mongoose.Types.ObjectId.isValid(id))) {
    throw new OpsError(400, 'Select valid, unique field worker IDs for the roster.');
  }
  const workers = await User.find({ _id: { $in: workerIds }, role: 'emergency_field_worker', status: 'active' }).select('name role');
  if (workers.length !== workerIds.length) throw new OpsError(400, 'One or more roster field workers are unavailable.');
  team.members.push(...workers.map((worker) => ({
    user: worker._id,
    name: worker.name,
    role: worker.role,
    status: 'ACTIVE',
    joinedAt: new Date()
  })));

  await team.save();
  return team;
}

export async function attachRosterTeam({ emergencyId, rosterTeamId, actor }) {
  const emergency = await Emergency.findById(emergencyId);
  if (!emergency) throw new OpsError(404, 'Emergency not found.');

  if (actor.role !== 'admin' && String(emergency.ops?.emergencyOfficer) !== String(actor._id)) {
    throw new OpsError(403, 'Only the assigned Emergency Officer may attach teams.');
  }

  const roster = await EmergencyResponseTeam.findOne({ _id: rosterTeamId, kind: 'ROSTER' });
  if (!roster) throw new OpsError(404, 'Roster team not found.');
  if (actor.role !== 'admin' && idOf(roster.officer) !== idOf(actor)) throw new OpsError(403, 'You may only deploy your own roster teams.');

  const workerIds = roster.members.map((m) => m.user);
  return createTaskTeam({
    emergencyId: emergency._id,
    title: `Deployment: ${roster.title}`,
    responseType: roster.responseType,
    fieldWorkerIds: workerIds,
    notes: `Deployed from standing roster ${roster.teamCode}`,
    actor
  });
}

export async function addWorkerToTeam({ emergencyId, teamId, workerId, actor }) {
  const emergency = await Emergency.findById(emergencyId);
  if (!emergency) throw new OpsError(404, 'Emergency not found.');

  if (actor.role !== 'emergency_officer' && actor.role !== 'admin') {
    throw new OpsError(403, 'Only Emergency Officers may assign field workers.');
  }
  if (actor.role !== 'admin' && !isAssignedEmergencyOfficer(emergency, actor)) {
    throw new OpsError(403, 'Only the assigned Emergency Officer may assign workers to this emergency.');
  }

  const team = await EmergencyResponseTeam.findOne({ _id: teamId, emergency: emergency._id, status: 'FORMED' });
  if (!team) throw new OpsError(404, 'Response team not found.');

  const worker = await User.findOne({ _id: workerId, role: 'emergency_field_worker', status: 'active' });
  if (!worker) throw new OpsError(404, 'Emergency field worker not found.');

  const existingMember = team.members.find((m) => String(m.user) === String(workerId) && m.status !== 'RELEASED');
  if (existingMember) throw new OpsError(409, 'Worker is already an active member of this response team.');

  const booked = await User.findOneAndUpdate(
    { _id: workerId, role: 'emergency_field_worker', status: 'active', availability: 'available', activeEmergencyTeam: null },
    { $set: { availability: 'busy', activeEmergencyTeam: team._id, availabilityChangedAt: new Date() } },
    { new: true }
  );
  if (!booked) {
    throw new OpsError(409, 'Worker is no longer available. Please refresh and select another worker.');
  }

  const member = team.members.create({
    user: worker._id,
    name: worker.name,
    role: worker.role,
    status: 'ACTIVE',
    joinedAt: new Date()
  });
  team.members.push(member);
  try {
    await team.save();
    await EmergencyResponseAssignment.updateOne(
      { emergency: emergency._id, team: team._id },
      { $addToSet: { fieldWorkers: worker._id } }
    );
  } catch (error) {
    await EmergencyResponseTeam.updateOne(
      { _id: team._id },
      { $pull: { members: { _id: member._id } } }
    );
    await User.updateOne(
      { _id: worker._id, activeEmergencyTeam: team._id },
      { $set: { availability: 'available', activeEmergencyTeam: null, availabilityChangedAt: new Date() } }
    );
    throw error;
  }

  await auditAction(actor, 'emergency_worker_assigned', emergency, {
    description: `Worker ${worker.name} assigned to team ${team.teamCode}.`,
    metadata: { teamId: team._id, workerId: worker._id, workerName: worker.name }
  });

  await notifyUsers([idOf(worker._id)], `You have been assigned to team ${team.teamCode} for emergency ${incidentLabel(emergency)}.`, { emergency });
  emitEmergencyEvent('emergencyWorkerAssigned', { emergencyId: emergency._id, teamId: team._id, workerId: worker._id });
  emitOpsUpdate(emergency, { userIds: [idOf(worker._id)] });

  return { team, worker: booked };
}

export async function updateFieldWorkerAssignment({ emergencyId, step, actor }) {
  if (actor.role !== 'emergency_field_worker') throw new OpsError(403, 'Only an Emergency Field Worker may update their field assignment.');
  if (!['accept', 'start'].includes(step)) throw new OpsError(400, 'Invalid field assignment action.');
  const team = await EmergencyResponseTeam.findOne({
    emergency: emergencyId,
    status: 'FORMED',
    members: { $elemMatch: { user: actor._id, status: 'ACTIVE' } }
  });
  if (!team) throw new OpsError(403, 'You do not have an active assignment for this emergency.');
  const emergency = await Emergency.findById(emergencyId);
  if (!emergency) throw new OpsError(404, 'Emergency not found.');
  if (step === 'start' && ![WORKFLOW.EN_ROUTE, WORKFLOW.ON_SCENE, WORKFLOW.RESPONSE_ACTIVE].includes(statusOf(emergency))) {
    throw new OpsError(409, 'Wait for the Emergency Officer to start the response before beginning field work.');
  }
  const now = new Date();
  const stateFilter = step === 'accept'
    ? { acceptedAt: null }
    : { acceptedAt: { $ne: null }, fieldWorkStartedAt: null };
  const stateUpdate = step === 'accept'
    ? { 'members.$.acceptedAt': now }
    : { 'members.$.fieldWorkStartedAt': now };
  const updatedTeam = await EmergencyResponseTeam.findOneAndUpdate({
    _id: team._id,
    members: { $elemMatch: { user: actor._id, status: 'ACTIVE', ...stateFilter } }
  }, { $set: stateUpdate }, { new: true });
  if (!updatedTeam) throw new OpsError(409, step === 'accept' ? 'This assignment has already been accepted.' : 'Accept the assignment before starting field work.');
  const member = updatedTeam.members.find((entry) => String(entry.user) === String(actor._id) && entry.status === 'ACTIVE');
  await auditAction(actor, step === 'accept' ? 'emergency_field_assignment_accepted' : 'emergency_field_work_started', emergency, {
    description: `${actor.name} ${step === 'accept' ? 'accepted the field assignment' : 'started field work'} for ${incidentLabel(emergency)}.`,
    metadata: { teamId: idOf(updatedTeam._id), step }
  });
  const recipients = [idOf(emergency.ops?.emergencyOfficer), idOf(emergency.ops?.departmentOfficer)];
  await notifyUsers(recipients, `${actor.name} ${step === 'accept' ? 'accepted the assignment' : 'started field work'} for emergency ${incidentLabel(emergency)}.`, { emergency });
  if (step === 'start') emitEmergencyEvent('emergencyStarted', { emergencyId: emergency._id, teamId: updatedTeam._id, workerId: actor._id, step }, { userIds: recipients });
  emitOpsUpdate(emergency, { userIds: [idOf(actor._id)] });
  return { team: updatedTeam, member, emergency };
}

export async function releaseWorkerFromTeam({ emergencyId, teamId, workerId, reason = '', actor }) {
  const emergency = await Emergency.findById(emergencyId);
  if (!emergency) throw new OpsError(404, 'Emergency not found.');

  if (actor.role !== 'emergency_officer' && actor.role !== 'admin') {
    throw new OpsError(403, 'Only Emergency Officers may release field workers.');
  }
  if (actor.role !== 'admin' && !isAssignedEmergencyOfficer(emergency, actor)) {
    throw new OpsError(403, 'Only the assigned Emergency Officer may release workers from this emergency.');
  }

  const team = await EmergencyResponseTeam.findOne({ _id: teamId, emergency: emergency._id });
  if (!team) throw new OpsError(404, 'Response team not found.');

  const member = team.members.find((m) => String(m.user) === String(workerId) && m.status !== 'RELEASED');
  if (!member) throw new OpsError(404, 'Worker is not an active member of this team.');

  member.status = 'RELEASED';
  member.releasedAt = new Date();
  member.releaseReason = String(reason || 'Released by officer').trim().slice(0, 300);
  await team.save();

  const otherTeam = await EmergencyResponseTeam.exists({
    _id: { $ne: team._id },
    status: 'FORMED',
    'members.user': workerId,
    'members.status': { $ne: 'RELEASED' }
  });

  if (!otherTeam) {
    await User.updateOne(
      { _id: workerId, activeEmergencyTeam: team._id },
      { $set: { availability: 'available', activeEmergencyTeam: null, availabilityChangedAt: new Date() } }
    );
  }

  await EmergencyResponseAssignment.updateOne(
    { emergency: emergency._id, team: team._id },
    { $pull: { fieldWorkers: workerId } }
  );

  await auditAction(actor, 'emergency_worker_released', emergency, {
    description: `Worker ${member.name} released from team ${team.teamCode}.`,
    metadata: { teamId: team._id, workerId, reason }
  });

  await notifyUsers([idOf(workerId)], `You have been released from response team ${team.teamCode}.`, { emergency });
  emitEmergencyEvent('emergencyWorkerReleased', { emergencyId: emergency._id, teamId: team._id, workerId });
  emitOpsUpdate(emergency, { userIds: [idOf(workerId)] });

  return { team, releasedWorkerId: workerId };
}

export async function releaseAllEmergencyResources(emergencyId, reason = 'Emergency closed') {
  const teams = await EmergencyResponseTeam.find({ emergency: emergencyId, status: 'FORMED' });
  for (const team of teams) {
    const activeMemberIds = team.members
      .filter((m) => m.status !== 'RELEASED')
      .map((m) => m.user);

    for (const member of team.members) {
      if (member.status !== 'RELEASED') {
        member.status = 'RELEASED';
        member.releasedAt = new Date();
        member.releaseReason = reason;
      }
    }
    team.status = 'DISBANDED';
    await team.save();

    if (activeMemberIds.length > 0) {
      await User.updateMany(
        { _id: { $in: activeMemberIds }, activeEmergencyTeam: team._id },
        { $set: { availability: 'available', activeEmergencyTeam: null, availabilityChangedAt: new Date() } }
      );
      for (const workerId of activeMemberIds) {
        await notifyUsers([idOf(workerId)], `You have been released from response team ${team.teamCode}: ${reason}.`, { emergency: { _id: emergencyId } });
        emitEmergencyEvent('emergencyWorkerReleased', { emergencyId, teamId: team._id, workerId });
      }
    }
  }
}

export async function startResponse({ emergencyId, step = 'active', notes = '', actor }) {
  const emergency = await Emergency.findById(emergencyId);
  if (!emergency) throw new OpsError(404, 'Emergency not found.');
  if (actor.role !== 'admin' && (actor.role !== 'emergency_officer' || !isAssignedEmergencyOfficer(emergency, actor))) {
    throw new OpsError(403, 'Only the assigned Emergency Officer may start or update the response.');
  }
  if (step !== 'active' && step !== 'en_route' && step !== 'on_scene') {
    throw new OpsError(400, 'Invalid response step.');
  }

  const target = step === 'en_route'
    ? WORKFLOW.EN_ROUTE
    : step === 'on_scene'
      ? WORKFLOW.ON_SCENE
      : WORKFLOW.RESPONSE_ACTIVE;

  const updated = await applyTransition({
    emergency,
    to: target,
    actor,
    note: notes || `Response status advanced to ${opsLabel(target)}`,
    allowFrom: [WORKFLOW.ACCEPTED_EO, WORKFLOW.TEAM_FORMED, WORKFLOW.EN_ROUTE, WORKFLOW.ON_SCENE, WORKFLOW.RESPONSE_ACTIVE]
  });

  await auditAction(actor, `emergency_${target.toLowerCase()}`, updated, {
    description: `Tactical status changed to ${target}`
  });

  emitOpsUpdate(updated);
  return updated;
}

export async function updateProgress({ emergencyId, percentage, note = '', actor }) {
  const emergency = await Emergency.findById(emergencyId);
  if (!emergency) throw new OpsError(404, 'Emergency not found.');
  if (!['emergency_officer', 'emergency_field_worker', 'admin'].includes(actor.role)) {
    throw new OpsError(403, 'Only the assigned Emergency Officer or a member of its response team may update progress.');
  }
  const isAssignedOfficer = actor.role === 'admin' || isAssignedEmergencyOfficer(emergency, actor);
  if (!isAssignedOfficer && !(actor.role === 'emergency_field_worker' && await isWorkingFieldParticipant(emergency, actor))) {
    throw new OpsError(403, 'You are not assigned to this emergency.');
  }
  const pct = Number(percentage);
  if (![25, 50, 75, 100].includes(pct)) throw new OpsError(400, 'Progress must be 25%, 50%, 75%, or 100%.');
  if (![WORKFLOW.TEAM_FORMED, WORKFLOW.EN_ROUTE, WORKFLOW.ON_SCENE, WORKFLOW.RESPONSE_ACTIVE, WORKFLOW.ESCALATED].includes(statusOf(emergency))) {
    throw new OpsError(409, 'Progress can only be updated after the response team is formed.');
  }
  if (pct < Number(emergency.ops?.completionPercent || 0)) throw new OpsError(409, 'Progress cannot move backwards.');
  const progressNote = String(note || '').trim().slice(0, 500);
  const progressEntry = { percent: pct, text: progressNote, by: actor._id, byRole: actor.role, at: new Date() };
  emergency.ops.progress.push(progressEntry);
  emergency.ops.completionPercent = pct;

  await emergency.save();

  await auditAction(actor, 'emergency_progress_updated', emergency, {
    description: `Progress updated to ${pct}%: ${progressNote || 'Updated'}`,
    metadata: { percentage: pct, note: progressNote }
  });

  await notifyUsers([idOf(emergency.ops?.emergencyOfficer), idOf(emergency.ops?.departmentOfficer)], `Progress on emergency ${incidentLabel(emergency)} was updated to ${pct}%.`, { emergency });
  emitEmergencyEvent('emergencyProgressUpdated', { emergencyId: emergency._id, percentage: pct }, { userIds: [idOf(emergency.ops?.emergencyOfficer), idOf(emergency.ops?.departmentOfficer)] });
  emitOpsUpdate(emergency);
  return emergency;
}

export async function reportBlocker({ emergencyId, kind = 'OTHER', description, severity = 'MEDIUM', requiredResource = '', actor }) {
  if (!description || !String(description).trim()) throw new OpsError(400, 'Description of blocker is required.');
  const emergency = await Emergency.findById(emergencyId);
  if (!emergency) throw new OpsError(404, 'Emergency not found.');
  if (isTerminal(statusOf(emergency))) throw new OpsError(409, 'Closed emergencies cannot accept new blockers.');
  if (actor.role !== 'admin' && actor.role !== HEAD_ROLE) {
    const owner = actor.role === 'emergency_department_officer'
      ? isAssignedDepartmentOfficer(emergency, actor)
      : actor.role === 'emergency_officer'
        ? isAssignedEmergencyOfficer(emergency, actor)
        : actor.role === 'emergency_field_worker' && await isWorkingFieldParticipant(emergency, actor);
    if (!owner) throw new OpsError(403, 'You are not assigned to this emergency.');
  }
  if (!['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(String(severity).toUpperCase())) throw new OpsError(400, 'Invalid blocker severity.');

  if (!emergency.ops.blockers) emergency.ops.blockers = [];
  const blocker = {
    kind: String(kind).toUpperCase(),
    text: String(description).trim().slice(0, 500),
    severity: String(severity).toUpperCase(),
    requiredResource: String(requiredResource || '').trim().slice(0, 200),
    raisedBy: actor._id,
    raisedByRole: actor.role,
    reportedAt: new Date(),
    raisedAt: new Date(),
    resolvedAt: null
  };
  emergency.ops.blockers.push(blocker);
  await emergency.save();

  await auditAction(actor, 'emergency_blocker_raised', emergency, {
    description: `Blocker reported [${kind}]: ${description}`,
    metadata: { kind, description }
  });

  const recipients = [idOf(emergency.ops?.emergencyOfficer), idOf(emergency.ops?.departmentOfficer)];
  if (String(severity).toUpperCase() === 'CRITICAL') {
    const head = await findActiveHead();
    if (head) recipients.push(idOf(head._id));
  }
  const roles = [HEAD_ROLE];
  await notifyUsers(recipients, `A ${severity} blocker was reported for emergency ${incidentLabel(emergency)}.`, { emergency });
  emitEmergencyEvent('emergencyBlocked', { emergencyId: emergency._id, severity }, { userIds: recipients, roles });
  emitOpsUpdate(emergency, { extra: { blockerReported: true } });
  return emergency;
}

export async function resolveBlocker({ emergencyId, blockerIndex, resolution, actor }) {
  if (!resolution || !String(resolution).trim()) throw new OpsError(400, 'Resolution explanation is required.');
  const emergency = await Emergency.findById(emergencyId);
  if (!emergency) throw new OpsError(404, 'Emergency not found.');
  if (actor.role === HEAD_ROLE) await assertHeadAuthority(actor);
  else if (actor.role !== 'admin' && !(actor.role === 'emergency_department_officer' && isAssignedDepartmentOfficer(emergency, actor))) {
    throw new OpsError(403, 'Only the assigned Emergency Department Officer or active Emergency Head may resolve this blocker.');
  }

  const idx = Number(blockerIndex);
  if (!emergency.ops.blockers || !emergency.ops.blockers[idx]) {
    throw new OpsError(404, 'Blocker entry not found.');
  }

  const blocker = emergency.ops.blockers[idx];
  blocker.resolvedAt = new Date();
  blocker.resolvedBy = actor._id;
  blocker.resolution = String(resolution).trim().slice(0, 500);

  await emergency.save();

  await auditAction(actor, 'emergency_blocker_resolved', emergency, {
    description: `Blocker [${blocker.kind}] resolved: ${resolution}`,
    metadata: { resolution }
  });

  emitOpsUpdate(emergency, { extra: { blockerResolved: true } });
  return emergency;
}

export async function fieldWorkerComplete({ emergencyId, notes = '', actor }) {
  if (actor.role !== 'emergency_field_worker' && actor.role !== 'admin') {
    throw new OpsError(403, 'Only Emergency Field Workers may mark their field work complete.');
  }

  const emergency = await Emergency.findById(emergencyId);
  if (!emergency) throw new OpsError(404, 'Emergency not found.');

  const teams = await EmergencyResponseTeam.find({ emergency: emergency._id, status: 'FORMED' });
  let found = false;
  for (const team of teams) {
    const member = team.members.find((m) => String(m.user) === String(actor._id) && m.status === 'ACTIVE');
    if (member) {
      if (!member.acceptedAt || !member.fieldWorkStartedAt) throw new OpsError(409, 'Accept and start your field work before completing it.');
      member.status = 'FIELD_WORK_COMPLETED';
      member.fieldWorkCompletedAt = new Date();
      member.completionNotes = String(notes || '').trim().slice(0, 500);
      emergency.ops.progress.push({
        percent: 100,
        text: String(notes || 'Field work completed').trim().slice(0, 500),
        by: actor._id,
        byRole: actor.role,
        team: team._id,
        at: new Date()
      });
      emergency.ops.completionPercent = 100;
      await team.save();
      found = true;
    }
  }
  if (!found) throw new OpsError(403, 'You do not have active field work assigned to this emergency.');
  await emergency.save();

  await auditAction(actor, 'emergency_field_work_completed', emergency, {
    description: `Field worker ${actor.name} completed assigned tasks: ${notes || 'Done'}`,
    metadata: { notes }
  });

  await notifyUsers([idOf(emergency.ops?.emergencyOfficer), idOf(emergency.ops?.departmentOfficer)], `Field work was completed for emergency ${incidentLabel(emergency)}.`, { emergency });
  emitEmergencyEvent('emergencyProgressUpdated', { emergencyId: emergency._id, workerId: actor._id, fieldWorkCompleted: true }, { userIds: [idOf(emergency.ops?.emergencyOfficer), idOf(emergency.ops?.departmentOfficer)] });
  emitOpsUpdate(emergency, { userIds: [idOf(emergency.ops?.emergencyOfficer)] });
  return { emergency, success: true };
}

export async function officerCompleteResponse({ emergencyId, notes = '', actor }) {
  if (actor.role !== 'emergency_officer' && actor.role !== 'admin') throw new OpsError(403, 'Only the assigned Emergency Officer may complete the response.');

  const emergency = await Emergency.findById(emergencyId);
  if (!emergency) throw new OpsError(404, 'Emergency not found.');
  if (actor.role !== 'admin' && !isAssignedEmergencyOfficer(emergency, actor)) throw new OpsError(403, 'Only the assigned Emergency Officer may complete this response.');
  const teams = await EmergencyResponseTeam.find({ emergency: emergency._id, kind: 'TASK', status: 'FORMED' });
  const incomplete = teams.flatMap((team) => team.members.filter((member) => member.status === 'ACTIVE').map((member) => member.name));
  if (incomplete.length) throw new OpsError(409, 'Every assigned field worker must complete field work before the response can be completed.', { workers: incomplete });

  const updated = await applyTransition({
    emergency,
    to: WORKFLOW.FIELD_WORK_COMPLETED,
    actor,
    note: notes || 'Response operations completed by officer',
    allowFrom: [WORKFLOW.TEAM_FORMED, WORKFLOW.EN_ROUTE, WORKFLOW.ON_SCENE, WORKFLOW.RESPONSE_ACTIVE, WORKFLOW.ESCALATED, WORKFLOW.FIELD_WORK_COMPLETED]
  });

  await auditAction(actor, 'emergency_field_work_completed', updated, {
    description: `Tactical operations completed: ${notes || 'Verified'}`,
    metadata: { notes }
  });

  await notifyUsers([idOf(updated.ops?.departmentOfficer)], `Emergency ${incidentLabel(updated)} response is ready for Department Officer review.`, { emergency: updated });
  emitOpsUpdate(updated, { userIds: [idOf(emergency.ops?.departmentOfficer)] });
  return updated;
}

export async function reviewResponseCompletion({ emergencyId, notes = '', actor }) {
  if (actor.role !== 'emergency_department_officer' && actor.role !== 'admin') throw new OpsError(403, 'Only the assigned Emergency Department Officer may review response completion.');
  const emergency = await Emergency.findById(emergencyId);
  if (!emergency) throw new OpsError(404, 'Emergency not found.');
  if (actor.role !== 'admin' && !isAssignedDepartmentOfficer(emergency, actor)) throw new OpsError(403, 'Only the assigned Emergency Department Officer may review this response.');
  const updated = await applyTransition({
    emergency,
    to: WORKFLOW.RESOLVED,
    actor,
    note: notes || 'Response completion reviewed by Department Officer',
    allowFrom: [WORKFLOW.FIELD_WORK_COMPLETED]
  });
  await auditAction(actor, 'emergency_response_reviewed', updated, { description: `Response completion reviewed: ${notes || 'Approved'}` });
  const head = await findActiveHead();
  await notifyUsers([idOf(head?._id)], `Emergency ${incidentLabel(updated)} response has been reviewed and is ready for closure.`, { emergency: updated });
  emitOpsUpdate(updated, { userIds: [idOf(updated.ops?.departmentOfficer), idOf(updated.ops?.emergencyOfficer)] });
  return updated;
}

export async function headCloseEmergency({ emergencyId, notes = '', actor }) {
  await assertHeadAuthority(actor);
  const emergency = await Emergency.findById(emergencyId);
  if (!emergency) throw new OpsError(404, 'Emergency not found.');

  const updated = await applyTransition({
    emergency,
    to: WORKFLOW.CLOSED,
    actor,
    note: notes || 'Incident officially closed out by Emergency Head',
    allowFrom: [WORKFLOW.RESOLVED]
  });
  await releaseAllEmergencyResources(updated._id, 'Incident closed by Emergency Head');

  await auditAction(actor, 'emergency_closed', updated, {
    description: `Incident officially closed: ${notes || 'All clear'}`
  });

  await notifyUsers([idOf(updated.citizen), idOf(updated.ops?.departmentOfficer), idOf(updated.ops?.emergencyOfficer)], `Emergency ${incidentLabel(updated)} has been closed.`, { emergency: updated });
  emitOpsUpdate(updated);
  return updated;
}

export async function headCancelEmergency({ emergencyId, reason, actor }) {
  await assertHeadAuthority(actor);
  if (!reason || !String(reason).trim()) throw new OpsError(400, 'A cancellation reason is required.');
  const emergency = await Emergency.findById(emergencyId);
  if (!emergency) throw new OpsError(404, 'Emergency not found.');
  const updated = await applyTransition({
    emergency,
    to: WORKFLOW.CANCELLED,
    actor,
    note: String(reason).trim().slice(0, 600)
  });
  await releaseAllEmergencyResources(updated._id, 'Emergency cancelled by Head');
  await auditAction(actor, 'emergency_cancelled', updated, {
    description: `Emergency cancelled: ${String(reason).trim().slice(0, 500)}`
  });
  await notifyUsers([idOf(updated.ops?.departmentOfficer), idOf(updated.ops?.emergencyOfficer), idOf(updated.citizen)], `Emergency ${incidentLabel(updated)} was cancelled.`, { emergency: updated });
  emitOpsUpdate(updated);
  return updated;
}

export async function addInstruction({ emergencyId, text, actor }) {
  if (!text || !String(text).trim()) throw new OpsError(400, 'Instruction text is required.');
  const emergency = await Emergency.findById(emergencyId);
  if (!emergency) throw new OpsError(404, 'Emergency not found.');
  if (actor.role === HEAD_ROLE) await assertHeadAuthority(actor);
  else if (actor.role !== 'admin') {
    const assigned = actor.role === 'emergency_department_officer'
      ? isAssignedDepartmentOfficer(emergency, actor)
      : actor.role === 'emergency_officer' && isAssignedEmergencyOfficer(emergency, actor);
    if (!assigned) throw new OpsError(403, 'Only the assigned Emergency Department Officer or Emergency Officer may issue instructions.');
  }

  if (!emergency.ops.instructions) emergency.ops.instructions = [];
  const entry = {
    text: String(text).trim().slice(0, 1000),
    by: actor._id,
    byRole: actor.role,
    at: new Date()
  };
  emergency.ops.instructions.push(entry);
  await emergency.save();

  await auditAction(actor, 'emergency_instructions_added', emergency, {
    description: `Directive issued by ${opsLabel(actor.role)}: ${text}`,
    metadata: { text }
  });

  await notifyUsers([idOf(emergency.ops?.departmentOfficer), idOf(emergency.ops?.emergencyOfficer)], `A new directive was added to emergency ${incidentLabel(emergency)}.`, { emergency });
  emitOpsUpdate(emergency);
  return emergency;
}

export async function getHeadDashboardData({ actor }) {
  await assertHeadAuthority(actor);

  const [
    total,
    active,
    critical,
    high,
    medium,
    low,
    escalated,
    inProgress,
    completed,
    blocked
  ] = await Promise.all([
    Emergency.countDocuments(),
    Emergency.countDocuments({ 'ops.workflowStatus': { $nin: TERMINAL_STATUSES } }),
    Emergency.countDocuments({ 'ops.priority': 'CRITICAL', 'ops.workflowStatus': { $nin: TERMINAL_STATUSES } }),
    Emergency.countDocuments({ 'ops.priority': 'HIGH', 'ops.workflowStatus': { $nin: TERMINAL_STATUSES } }),
    Emergency.countDocuments({ 'ops.priority': 'MEDIUM', 'ops.workflowStatus': { $nin: TERMINAL_STATUSES } }),
    Emergency.countDocuments({ 'ops.priority': 'LOW', 'ops.workflowStatus': { $nin: TERMINAL_STATUSES } }),
    Emergency.countDocuments({ 'ops.workflowStatus': WORKFLOW.ESCALATED }),
    Emergency.countDocuments({ 'ops.workflowStatus': { $in: [WORKFLOW.EN_ROUTE, WORKFLOW.ON_SCENE, WORKFLOW.RESPONSE_ACTIVE] } }),
    Emergency.countDocuments({ 'ops.workflowStatus': { $in: [WORKFLOW.FIELD_WORK_COMPLETED, WORKFLOW.RESOLVED, WORKFLOW.CLOSED] } }),
    Emergency.countDocuments({ 'ops.blockers': { $elemMatch: { resolvedAt: null } }, 'ops.workflowStatus': { $nin: TERMINAL_STATUSES } })
  ]);

  const [
    edoAvailable, edoBusy, edoOffDuty, edoOnLeave,
    eoAvailable, eoBusy, eoOffDuty, eoOnLeave,
    fwAvailable, fwBusy, fwOffDuty, fwOnLeave,
    edoUnavailable, eoUnavailable, fwUnavailable,
    activeTeams, activeTasks
  ] = await Promise.all([
    User.countDocuments({ role: 'emergency_department_officer', status: 'active', availability: 'available' }),
    User.countDocuments({ role: 'emergency_department_officer', status: 'active', availability: 'busy' }),
    User.countDocuments({ role: 'emergency_department_officer', status: 'active', availability: 'off_duty' }),
    User.countDocuments({ role: 'emergency_department_officer', status: 'active', availability: 'on_leave' }),

    User.countDocuments({ role: 'emergency_officer', status: 'active', availability: 'available' }),
    User.countDocuments({ role: 'emergency_officer', status: 'active', availability: 'busy' }),
    User.countDocuments({ role: 'emergency_officer', status: 'active', availability: 'off_duty' }),
    User.countDocuments({ role: 'emergency_officer', status: 'active', availability: 'on_leave' }),

    User.countDocuments({ role: 'emergency_field_worker', status: 'active', availability: 'available' }),
    User.countDocuments({ role: 'emergency_field_worker', status: 'active', availability: 'busy' }),
    User.countDocuments({ role: 'emergency_field_worker', status: 'active', availability: 'off_duty' }),
    User.countDocuments({ role: 'emergency_field_worker', status: 'active', availability: 'on_leave' }),

    User.countDocuments({ role: 'emergency_department_officer', status: 'active', availability: 'unavailable' }),
    User.countDocuments({ role: 'emergency_officer', status: 'active', availability: 'unavailable' }),
    User.countDocuments({ role: 'emergency_field_worker', status: 'active', availability: 'unavailable' }),

    EmergencyResponseTeam.countDocuments({ status: 'FORMED', kind: 'TASK' }),
    Emergency.countDocuments({ 'ops.workflowStatus': { $in: [WORKFLOW.TEAM_FORMED, WORKFLOW.EN_ROUTE, WORKFLOW.ON_SCENE, WORKFLOW.RESPONSE_ACTIVE] } })
  ]);

  const resourceOverview = {
    departmentOfficers: { available: edoAvailable, busy: edoBusy, off_duty: edoOffDuty, on_leave: edoOnLeave, unavailable: edoUnavailable },
    emergencyOfficers: { available: eoAvailable, busy: eoBusy, off_duty: eoOffDuty, on_leave: eoOnLeave, unavailable: eoUnavailable },
    fieldWorkers: { available: fwAvailable, busy: fwBusy, off_duty: fwOffDuty, on_leave: fwOnLeave, unavailable: fwUnavailable },
    activeTeams,
    activeTasks
  };

  const criticalIncidents = await Emergency.find({
    'ops.priority': 'CRITICAL',
    'ops.workflowStatus': { $nin: TERMINAL_STATUSES }
  })
    .populate('ops.departmentOfficer', 'name email phone')
    .populate('ops.emergencyOfficer', 'name email phone')
    .sort({ createdAt: -1 })
    .limit(10);

  const escalatedIncidents = await Emergency.find({
    'ops.workflowStatus': WORKFLOW.ESCALATED
  })
    .populate('ops.departmentOfficer', 'name email phone')
    .populate('ops.emergencyOfficer', 'name email phone')
    .populate('ops.activeEscalation.raisedBy', 'name email role')
    .sort({ updatedAt: -1 })
    .limit(10);

  const recentActivity = await ActivityLog.find({ targetType: 'emergency' })
    .populate('admin', 'name email role photoURL')
    .sort({ createdAt: -1 })
    .limit(20);

  const mapIncidents = await Emergency.find({
    'ops.workflowStatus': { $nin: TERMINAL_STATUSES },
    'location.latitude': { $ne: null },
    'location.longitude': { $ne: null }
  })
    .populate('ops.departmentOfficer', 'name')
    .populate('ops.emergencyOfficer', 'name')
    .select('emergencyId title category ops location createdAt')
    .limit(100);

  const teamsCountMap = {};
  const activeTeamsList = await EmergencyResponseTeam.find({
    status: 'FORMED',
    emergency: { $in: mapIncidents.map((i) => i._id) }
  }).select('emergency');
  for (const t of activeTeamsList) {
    const k = String(t.emergency);
    teamsCountMap[k] = (teamsCountMap[k] || 0) + 1;
  }

  const liveMap = mapIncidents.map((inc) => ({
    _id: idOf(inc._id),
    emergencyId: inc.emergencyId,
    title: inc.title,
    emergencyType: inc.ops?.emergencyType || CATEGORY_TO_TYPE[inc.category] || 'OTHER',
    category: inc.category,
    priority: inc.ops?.priority || SEVERITY_PRIORITY[inc.severity] || 'MEDIUM',
    workflowStatus: inc.ops?.workflowStatus || WORKFLOW.SUBMITTED,
    location: inc.location,
    assignedEDO: inc.ops?.departmentOfficer?.name || null,
    assignedEO: inc.ops?.emergencyOfficer?.name || null,
    teamsCount: teamsCountMap[String(inc._id)] || 0,
    createdAt: inc.createdAt
  }));

  return {
    stats: {
      total,
      active,
      critical,
      high,
      medium,
      low,
      escalated,
      inProgress,
      completed,
      blocked
    },
    resources: resourceOverview,
    criticalIncidents: criticalIncidents.map((inc) => presentEmergency(inc)),
    escalatedIncidents: escalatedIncidents.map((inc) => presentEmergency(inc)),
    recentActivity: recentActivity.map((log) => ({
      _id: idOf(log._id),
      action: log.action,
      actor: log.admin ? { _id: idOf(log.admin._id), name: log.admin.name, role: log.actorRole } : null,
      targetName: log.targetName,
      description: log.description,
      createdAt: log.createdAt
    })),
    liveMap
  };
}

export async function getEDODashboardData({ actor }) {
  if (actor.role !== 'emergency_department_officer' && actor.role !== 'admin') {
    throw new OpsError(403, 'Emergency Department Officer access required.');
  }

  const filter = actor.role === 'admin' ? {} : { 'ops.departmentOfficer': actor._id };

  const [
    myTotal,
    pendingReview,
    waitingForEO,
    active,
    critical,
    high,
    escalated,
    blocked,
    completed
  ] = await Promise.all([
    Emergency.countDocuments(filter),
    Emergency.countDocuments({ ...filter, 'ops.reviewed': false, 'ops.workflowStatus': { $nin: TERMINAL_STATUSES } }),
    Emergency.countDocuments({ ...filter, 'ops.emergencyOfficer': null, 'ops.workflowStatus': { $nin: TERMINAL_STATUSES } }),
    Emergency.countDocuments({ ...filter, 'ops.workflowStatus': { $in: [WORKFLOW.TEAM_FORMED, WORKFLOW.EN_ROUTE, WORKFLOW.ON_SCENE, WORKFLOW.RESPONSE_ACTIVE, WORKFLOW.ESCALATED] } }),
    Emergency.countDocuments({ ...filter, 'ops.priority': 'CRITICAL', 'ops.workflowStatus': { $nin: TERMINAL_STATUSES } }),
    Emergency.countDocuments({ ...filter, 'ops.priority': 'HIGH', 'ops.workflowStatus': { $nin: TERMINAL_STATUSES } }),
    Emergency.countDocuments({ ...filter, 'ops.workflowStatus': WORKFLOW.ESCALATED }),
    Emergency.countDocuments({ ...filter, 'ops.blockers': { $elemMatch: { resolvedAt: null } }, 'ops.workflowStatus': { $nin: TERMINAL_STATUSES } }),
    Emergency.countDocuments({ ...filter, 'ops.workflowStatus': { $in: [WORKFLOW.FIELD_WORK_COMPLETED, WORKFLOW.RESOLVED, WORKFLOW.CLOSED] } })
  ]);

  const officers = await User.find({ role: 'emergency_officer', status: 'active' })
    .select('name email phone availability updatedAt');
  const officerIds = officers.map((o) => o._id);

  const activeOfficerIncidents = await Emergency.find({
    'ops.emergencyOfficer': { $in: officerIds },
    'ops.workflowStatus': { $nin: TERMINAL_STATUSES }
  }).select('emergencyId title ops.workflowStatus ops.priority ops.emergencyOfficer updatedAt');

  const resourceMonitoring = {
    officers: {
      available: officers.filter((o) => o.availability === 'available').length,
      busy: officers.filter((o) => o.availability === 'busy').length,
      off_duty: officers.filter((o) => o.availability === 'off_duty').length,
      on_leave: officers.filter((o) => o.availability === 'on_leave').length
    },
    workload: officers.map((officer) => {
      const held = activeOfficerIncidents.filter((inc) => String(inc.ops?.emergencyOfficer) === String(officer._id));
      return {
        _id: idOf(officer._id),
        name: officer.name,
        email: officer.email,
        phone: officer.phone,
        availability: officer.availability,
        activeEmergencies: held.length,
        currentStatus: officer.availability,
        lastUpdate: officer.updatedAt,
        incidents: held.map((h) => ({ _id: idOf(h._id), reference: h.emergencyId, title: h.title, status: h.ops?.workflowStatus }))
      };
    })
  };

  return {
    stats: {
      myEmergencies: myTotal,
      pendingReview,
      waitingForEmergencyOfficer: waitingForEO,
      active,
      critical,
      highPriority: high,
      escalated,
      blocked,
      completed
    },
    resourceMonitoring
  };
}

export async function getEODashboardData({ actor }) {
  if (actor.role !== 'emergency_officer' && actor.role !== 'admin') {
    throw new OpsError(403, 'Emergency Officer access required.');
  }

  const filter = actor.role === 'admin' ? {} : { 'ops.emergencyOfficer': actor._id };

  const [
    myTotal,
    pendingAcceptance,
    activeResponses,
    critical,
    high,
    blocked,
    escalated,
    completed
  ] = await Promise.all([
    Emergency.countDocuments(filter),
    Emergency.countDocuments({ ...filter, 'ops.workflowStatus': WORKFLOW.ASSIGNED_EO }),
    Emergency.countDocuments({ ...filter, 'ops.workflowStatus': { $in: [WORKFLOW.ACCEPTED_EO, WORKFLOW.TEAM_FORMED, WORKFLOW.EN_ROUTE, WORKFLOW.ON_SCENE, WORKFLOW.RESPONSE_ACTIVE] } }),
    Emergency.countDocuments({ ...filter, 'ops.priority': 'CRITICAL', 'ops.workflowStatus': { $nin: TERMINAL_STATUSES } }),
    Emergency.countDocuments({ ...filter, 'ops.priority': 'HIGH', 'ops.workflowStatus': { $nin: TERMINAL_STATUSES } }),
    Emergency.countDocuments({ ...filter, 'ops.blockers': { $elemMatch: { resolvedAt: null } }, 'ops.workflowStatus': { $nin: TERMINAL_STATUSES } }),
    Emergency.countDocuments({ ...filter, 'ops.workflowStatus': WORKFLOW.ESCALATED }),
    Emergency.countDocuments({ ...filter, 'ops.workflowStatus': { $in: [WORKFLOW.FIELD_WORK_COMPLETED, WORKFLOW.RESOLVED, WORKFLOW.CLOSED] } })
  ]);

  const [availableFieldWorkers, busyFieldWorkers, activeTeams] = await Promise.all([
    User.countDocuments({ role: 'emergency_field_worker', status: 'active', availability: 'available' }),
    User.countDocuments({ role: 'emergency_field_worker', status: 'active', availability: 'busy' }),
    EmergencyResponseTeam.countDocuments({ officer: actor._id, status: 'FORMED' })
  ]);

  return {
    stats: {
      myEmergencies: myTotal,
      pendingAcceptance,
      activeResponses,
      critical,
      highPriority: high,
      blocked,
      escalated,
      completed
    },
    resources: {
      availableFieldWorkers,
      busyFieldWorkers,
      activeTeams
    }
  };
}

export async function getFieldWorkerDashboardData({ actor }) {
  if (actor.role !== 'emergency_field_worker' && actor.role !== 'admin') {
    throw new OpsError(403, 'Emergency Field Worker access required.');
  }

  const activeTeam = await EmergencyResponseTeam.findOne({
    status: 'FORMED',
    members: { $elemMatch: { user: actor._id, status: { $ne: 'RELEASED' } } }
  }).populate('officer', 'name email phone');

  let activeEmergency = null;
  let memberRecord = null;

  if (activeTeam && activeTeam.emergency) {
    const em = await Emergency.findById(activeTeam.emergency)
      .populate('ops.emergencyOfficer', 'name email phone')
      .populate('ops.departmentOfficer', 'name email phone');

    if (em && !TERMINAL_STATUSES.includes(statusOf(em))) {
      const teams = await EmergencyResponseTeam.find({ emergency: em._id, status: 'FORMED' });
      activeEmergency = presentEmergency(em, { teams });
      memberRecord = activeTeam.members.find((m) => String(m.user) === String(actor._id));
    }
  }

  const historyTeams = await EmergencyResponseTeam.find({
    'members.user': actor._id,
    $or: [{ status: 'DISBANDED' }, { 'members.status': 'FIELD_WORK_COMPLETED' }]
  }).limit(10).sort({ updatedAt: -1 });

  return {
    hasActiveAssignment: Boolean(activeEmergency),
    activeEmergency,
    activeTeam: activeTeam ? {
      _id: idOf(activeTeam._id),
      teamCode: activeTeam.teamCode,
      title: activeTeam.title,
      responseType: activeTeam.responseType,
      officer: activeTeam.officer ? {
        _id: idOf(activeTeam.officer._id),
        name: activeTeam.officer.name,
        email: activeTeam.officer.email,
        phone: activeTeam.officer.phone
      } : null,
      memberStatus: memberRecord?.status || 'ACTIVE',
      joinedAt: memberRecord?.joinedAt || null,
      acceptedAt: memberRecord?.acceptedAt || null,
      fieldWorkStartedAt: memberRecord?.fieldWorkStartedAt || null,
      fieldWorkCompletedAt: memberRecord?.fieldWorkCompletedAt || null
    } : null,
    recentCompletedCount: historyTeams.length
  };
}

export async function listOpsIncidents(actor, {
  roleScope = '',
  status = '',
  priority = '',
  emergencyType = '',
  search = '',
  dateFrom = '',
  dateTo = '',
  page = 1,
  limit = 20,
  sort = 'newest'
} = {}) {
  const filter = {};

  if (actor.role === HEAD_ROLE) await assertHeadAuthority(actor);
  if (actor.role === 'emergency_department_officer') {
    filter['ops.departmentOfficer'] = actor._id;
  } else if (actor.role === 'emergency_officer') {
    filter['ops.emergencyOfficer'] = actor._id;
  } else if (actor.role === 'emergency_field_worker') {
    const teams = await EmergencyResponseTeam.find({
      status: 'FORMED',
      members: { $elemMatch: { user: actor._id, status: { $ne: 'RELEASED' } } }
    }).select('emergency');
    const emergencyIds = teams.map((t) => t.emergency).filter(Boolean);
    filter._id = { $in: emergencyIds };
  } else if (roleScope === 'department_officer') {
    filter['ops.departmentOfficer'] = actor._id;
  } else if (roleScope === 'officer') {
    filter['ops.emergencyOfficer'] = actor._id;
  }

  if (status) {
    if (WORKFLOW_STATUSES.includes(status)) {
      filter['ops.workflowStatus'] = status;
    } else if (status === 'active') {
      filter['ops.workflowStatus'] = { $nin: TERMINAL_STATUSES };
    } else if (status === 'completed') {
      filter['ops.workflowStatus'] = { $in: [WORKFLOW.FIELD_WORK_COMPLETED, WORKFLOW.RESOLVED, WORKFLOW.CLOSED] };
    }
  }

  if (priority && PRIORITIES.includes(priority)) {
    filter['ops.priority'] = priority;
  }

  if (emergencyType && EMERGENCY_TYPES.includes(emergencyType)) {
    filter['ops.emergencyType'] = emergencyType;
  }

  if (search && String(search).trim()) {
    const pattern = new RegExp(String(search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [
      { emergencyId: pattern },
      { title: pattern },
      { 'location.address': pattern }
    ];
  }
  if (dateFrom || dateTo) {
    const createdAt = {};
    if (dateFrom) {
      const start = new Date(`${dateFrom}T00:00:00.000Z`);
      if (Number.isNaN(start.getTime())) throw new OpsError(400, 'Invalid start date filter.');
      createdAt.$gte = start;
    }
    if (dateTo) {
      const end = new Date(`${dateTo}T00:00:00.000Z`);
      if (Number.isNaN(end.getTime())) throw new OpsError(400, 'Invalid end date filter.');
      end.setUTCDate(end.getUTCDate() + 1);
      createdAt.$lt = end;
    }
    filter.createdAt = createdAt;
  }

  const p = Math.max(1, Number(page) || 1);
  const l = Math.min(100, Math.max(1, Number(limit) || 20));
  const skip = (p - 1) * l;

  const sortRule = sort === 'priority'
    ? { 'ops.priority': 1, createdAt: -1 }
    : sort === 'oldest'
      ? { createdAt: 1 }
      : { createdAt: -1 };

  const [total, docs] = await Promise.all([
    Emergency.countDocuments(filter),
    Emergency.find(filter)
      .populate('ops.departmentOfficer', 'name email phone')
      .populate('ops.emergencyOfficer', 'name email phone')
      .populate('emergencyHead', 'name email')
      .sort(sortRule)
      .skip(skip)
      .limit(l)
  ]);

  const teams = await EmergencyResponseTeam.find({
    emergency: { $in: docs.map((d) => d._id) },
    status: 'FORMED'
  }).select('emergency teamCode title kind responseType members status');

  const teamsByEmergency = {};
  for (const t of teams) {
    const k = String(t.emergency);
    if (!teamsByEmergency[k]) teamsByEmergency[k] = [];
    teamsByEmergency[k].push(t);
  }

  const items = docs.map((doc) =>
    presentEmergency(doc, {
      includeCitizen: [HEAD_ROLE, 'admin', 'emergency_department_officer'].includes(actor.role),
      teams: teamsByEmergency[String(doc._id)] || []
    })
  );

  return {
    total,
    page: p,
    limit: l,
    totalPages: Math.ceil(total / l) || 1,
    items
  };
}
