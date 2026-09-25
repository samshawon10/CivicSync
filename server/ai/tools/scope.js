/**
 * AI data scoping.
 *
 * The AI layer must obey exactly the same visibility rules as the screens. This
 * module mirrors the existing server rules rather than re-inventing them:
 *   - controllers/reportController.js     -> canViewReport / staffRoles
 *   - controllers/departmentController.js -> canAccessReport / scopedFilter
 *   - controllers/emergencyController.js  -> participant / commandAccess
 *
 * Unknown scope always means "no rows", never "all rows" — the same contract as
 * services/civicSearch.js.
 */
import EmergencyResponseAssignment from '../../models/EmergencyResponseAssignment.js';
import { emergencyRoleGroups } from '../../config/emergencyOptions.js';
import { redactEmergencyForViewer, redactUserForViewer } from '../security/redaction.js';

export const civicStaffRoles = Object.freeze(['department_head', 'department_officer', 'officer', 'field_worker']);
export const emergencyCommandRoles = emergencyRoleGroups.command;
export const emergencyStaffRoles = emergencyRoleGroups.allStaff;
export const managerRoles = Object.freeze(['admin', 'department_head', 'department_officer']);

export const sameId = (value, id) => {
  const resolved = value?._id || value;
  return Boolean(resolved && id && String(resolved) === String(id));
};

export const departmentNameFor = (user) => user?.departmentName || user?.department?.name || '';
export const isAdmin = (user) => user?.role === 'admin';
export const isEmergencyCommand = (user) => emergencyCommandRoles.includes(user?.role);

/** Mirrors `canViewReport` in controllers/reportController.js. */
export function canViewReport(user, report) {
  if (!user || !report) return false;
  if (isAdmin(user)) return true;
  if (user.role === 'citizen') return sameId(report.createdBy, user._id);
  if (!civicStaffRoles.includes(user.role)) return false;
  if (report.departmentName !== departmentNameFor(user)) return false;
  if (['department_head', 'department_officer'].includes(user.role)) return true;
  return sameId(report.assignedOfficer, user._id) || sameId(report.assignedFieldWorker, user._id);
}

/** Mongo filter for listing cases (null = no usable scope). */
export function reportScopeFilter(user) {
  if (!user) return null;
  if (isAdmin(user)) return {};
  if (user.role === 'citizen') return { createdBy: user._id };
  const departmentName = departmentNameFor(user);
  if (!civicStaffRoles.includes(user.role) || !departmentName) return null;
  const filter = { departmentName };
  if (['officer', 'field_worker'].includes(user.role)) {
    filter.$or = [{ assignedOfficer: user._id }, { assignedFieldWorker: user._id }];
  }
  return filter;
}

/** Mirrors `participant` in controllers/emergencyController.js. */
export function isEmergencyParticipant(emergency, userId) {
  if (!emergency || !userId) return false;
  if (sameId(emergency.citizen, userId) || sameId(emergency.emergencyHead, userId)) return true;
  return (emergency.responseAssignments || []).some((assignment) => sameId(assignment?.emergencyOfficer, userId) || (assignment?.fieldWorkers || []).some((worker) => sameId(worker, userId)));
}

/** Command sees every incident; everyone else only their own participation. */
export function canViewEmergency(user, emergency) {
  if (!user || !emergency) return false;
  if (isEmergencyCommand(user)) return true;
  return isEmergencyParticipant(emergency, user._id);
}

/** Async: resolves the incidents a responder/field worker is dispatched to. */
export async function emergencyScopeFilter(user) {
  if (!user) return null;
  if (isEmergencyCommand(user)) return {};
  if (!emergencyStaffRoles.includes(user.role)) return { citizen: user._id };
  const assignmentIds = await EmergencyResponseAssignment
    .find({ $or: [{ emergencyOfficer: user._id }, { fieldWorkers: user._id }] })
    .distinct('_id');
  return { $or: [{ citizen: user._id }, { emergencyHead: user._id }, { responseAssignments: { $in: assignmentIds } }] };
}

/**
 * AI data scoping (part 2) — compact, redacted projections for prompts.
 * See `scope.js` header for the full contract.
 */

/** Compact case projection. Never includes another citizen's identity. */
export function caseSummary(report, { detail = false, viewer = null } = {}) {
  if (!report) return null;
  const owner = report.createdBy && typeof report.createdBy === 'object' ? redactUserForViewer(report.createdBy, viewer) : undefined;
  const base = {
    reference: `CASE-${String(report._id).slice(-6).toUpperCase()}`,
    id: String(report._id),
    title: report.title,
    category: report.category,
    department: report.departmentName,
    priority: report.priority,
    status: report.status,
    createdAt: report.createdAt,
    updatedAt: report.updatedAt,
    dueAt: report.dueAt || null,
    escalated: Boolean(report.escalation?.isEscalated && !report.escalation?.resolvedAt),
    escalationReason: report.escalation?.isEscalated ? report.escalation.reason || '' : '',
    assignedOfficer: report.assignedOfficer?.name || null,
    assignedFieldWorker: report.assignedFieldWorker?.name || null,
    assignedTeam: report.assignedTeam?.name || null,
    teamStatus: report.assignedTeam?.status || null,
    sla: report.sla || null,
    nextAction: report.nextAction || null
  };
  if (owner) base.citizen = { name: owner.name };
  if (!detail) return base;
  return {
    ...base,
    description: report.description || '',
    additionalInfo: report.additionalInfo || '',
    location: report.location ? { area: report.location.area, address: report.location.address, landmark: report.location.landmark } : null,
    attachments: (report.attachments || []).map((item) => ({ mediaType: item.mediaType, originalName: item.originalName })),
    messages: (report.messages || []).slice(-8).map((message) => ({ from: message.senderRole, text: message.text, at: message.createdAt, internal: message.isInternal })),
    activity: (report.activity || []).slice(-12).map((entry) => ({ action: entry.action, actorRole: entry.actorRole, at: entry.timestamp, note: entry.note })),
    activeTask: report.activeTask && typeof report.activeTask === 'object' ? {
      id: String(report.activeTask._id),
      title: report.activeTask.title,
      status: report.activeTask.status,
      priority: report.activeTask.priority,
      targetDueAt: report.activeTask.targetDueAt,
      blockedReason: report.activeTask.blockedInfo?.reason || '',
      completion: report.activeTask.completion?.summary || ''
    } : null,
    completionReport: report.completionReport?.verificationStatus && report.completionReport.verificationStatus !== 'not_submitted' ? {
      summary: report.completionReport.summary,
      verificationStatus: report.completionReport.verificationStatus,
      submittedAt: report.completionReport.submittedAt
    } : null
  };
}

/** Compact emergency projection for prompts, redacted for the viewer. */
export function emergencySummary(emergency, viewer, { detail = false } = {}) {
  if (!emergency) return null;
  const redacted = redactEmergencyForViewer(typeof emergency.toObject === 'function' ? emergency.toObject() : emergency, viewer, { summary: !detail });
  const assignments = (redacted.responseAssignments || []).map((assignment) => ({
    id: String(assignment._id || assignment),
    responseType: assignment.responseType,
    responseTeam: assignment.responseTeam || assignment.team?.name || '',
    status: assignment.status,
    officer: assignment.emergencyOfficer?.name || null,
    fieldWorkers: (assignment.fieldWorkers || []).map((worker) => worker?.name).filter(Boolean),
    etaMinutes: assignment.etaMinutes ?? null,
    assignedAt: assignment.assignedAt || null,
    arrivedAt: assignment.arrivedAt || null
  }));
  const summary = {
    reference: redacted.emergencyId || `EM-${String(redacted._id).slice(-6).toUpperCase()}`,
    id: String(redacted._id),
    title: redacted.title,
    category: redacted.category,
    subcategory: redacted.subcategory,
    severity: redacted.severity,
    status: redacted.status,
    source: redacted.source,
    visibility: redacted.visibility,
    createdAt: redacted.createdAt,
    resolvedAt: redacted.resolvedAt || null,
    closedAt: redacted.closedAt || null,
    location: { address: redacted.location?.address || '', landmark: redacted.location?.landmark || '' },
    assignedDepartment: redacted.assignedDepartment?.name || null,
    emergencyHead: redacted.emergencyHead?.name || null,
    assignments,
    sla: redacted.sla || null,
    nextAction: redacted.nextAction || null,
    evidenceCount: (redacted.evidence || []).length
  };
  if (detail) {
    summary.description = redacted.description || '';
    summary.personDetails = redacted.personDetails || null;
    summary.activity = (redacted.activity || []).slice(-12).map((entry) => ({ action: entry.action, actorRole: entry.actorRole, at: entry.timestamp, note: entry.note }));
  }
  return summary;
}
