import mongoose from 'mongoose';
import Notification from '../models/Notification.js';
import Report from '../models/Report.js';
import User from '../models/User.js';
import ActivityLog from '../models/ActivityLog.js';
import DepartmentTeam from '../models/DepartmentTeam.js';
import DepartmentTask from '../models/DepartmentTask.js';
import DepartmentResource from '../models/DepartmentResource.js';
import Department from '../models/Department.js';
import { calculateDepartmentSla, departmentSlaTargets } from '../services/departmentSla.js';
import { activeTaskStatuses, scoreTeamsForCase, taskCountsByTeam } from '../services/departmentTeamScoring.js';
import { emitDepartmentEvent } from '../realtime/emergencyRealtime.js';

import { canReviewReportCompletion, canTransitionReport, completionStageFor } from '../services/reportLifecycle.js';
import { checkStageTransition, stageLabel } from '../services/reportWorkflow.js';
import { roleLabel } from '../config/roleLabels.js';
import { resolveAssignableTarget, canAssignCaseLevel, releaseWorker } from '../services/assignmentAuthority.js';
import { reportCategories, reportPriorities, reportStatuses } from '../config/reportOptions.js';
import { getReportNextAction } from '../services/nextAction.js';
import { departmentTaskAccess } from '../services/departmentTaskAccess.js';
import { findPotentialDuplicateReports, isDuplicateReport, sanitizePublicIssueText } from '../services/duplicateReports.js';
import { notifyMasterCaseReporters } from '../services/masterCaseNotifications.js';

const headRoles = ['department_head'];
const managementRoles = ['department_head', 'department_officer'];
const departmentRoles = ['department_head', 'department_officer', 'officer', 'field_worker'];

const completionStatuses = ['submitted', 'verified', 'approved', 'rejected'];

/**
 * Records one workflow stage step on a case. Every stage change on a report
 * goes through here so `workflowHistory` and the citizen timeline stay complete.
 */
function applyStage(report, stage, actor, note = '') {
  const transition = checkStageTransition({ from: report.workflowStage, to: stage, actorRole: actor.role });
  if (!transition.ok) return false;
  const previousStage = report.workflowStage;
  report.workflowStage = stage;
  report.workflowHistory.push({
    stage,
    previousStage,
    actor: actor._id,
    actorRole: actor.role,
    note: note || stageLabel(stage)
  });
  report.activity.push({ action: stageLabel(stage), actorRole: actor.role, note: note || '' });
  return true;
}

function label(value = '') {
  return value.replaceAll('_', ' ');
}

function departmentNameFor(user) {
  return user.departmentName || user.department?.name || '';
}

function escapeRegex(value) {
  return value.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
async function auditLog(user, action, targetType, targetId, targetName, description, metadata = {}) {
  return ActivityLog.create({
    admin: user._id,
    actorRole: user.role || '',
    action,
    targetType,
    targetId,
    targetName: targetName || '',
    description: description || '',
    metadata,
    result: 'success'
  }).catch(() => {});
}

function canAccessReport(user, report) {
  const departmentName = departmentNameFor(user);
  if (!departmentName || report.departmentName !== departmentName) return false;
  if (managementRoles.includes(user.role)) return true;
  return report.assignedOfficer?.equals?.(user._id) || report.assignedFieldWorker?.equals?.(user._id);
}

async function loadScopedReport(req, res) {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    res.status(404).json({ success: false, message: 'Report not found.' });
    return null;
  }
  const reportQuery = Report.findById(req.params.id)
    .populate('assignedOfficer', 'name role phone')
    .populate('assignedDepartmentOfficer', 'name role phone')
    .populate('assignedFieldWorker', 'name role phone')
    .populate('assignedTeam', 'name status serviceArea phone members')
    .populate('teamLeader', 'name role phone')
    .populate({
      path: 'activeTask',
      populate: [
        { path: 'team', select: 'name serviceArea leader members' },
        { path: 'assignedWorker', select: 'name phone role' },
        { path: 'workerIds', select: 'name phone role availability' },
        { path: 'workerAssignments.worker', select: 'name email role availability' },
        { path: 'teamLeader', select: 'name phone' }
      ]
    })
    .populate('completionReport.submittedBy', 'name role');
  if (managementRoles.includes(req.user.role)) reportQuery.populate('createdBy', 'name');
  else reportQuery.select('-createdBy');
  const report = await reportQuery;
  if (!report || !canAccessReport(req.user, report)) {
    res.status(404).json({ success: false, message: 'Report not found.' });
    return null;
  }
  if (isDuplicateReport(report)) {
    res.status(404).json({ success: false, message: 'Use the master civic case for department operations.' });
    return null;
  }
  return report;
}

function scopedFilter(req) {
  const departmentName = departmentNameFor(req.user);
  if (!departmentName) return null;
  const filter = {
    departmentName,
    $and: [
      { $or: [{ relationType: { $ne: 'DUPLICATE' } }, { relationType: { $exists: false } }] },
      { $or: [{ isMasterReport: { $ne: false } }, { isMasterReport: { $exists: false } }] }
    ]
  };
  if (['officer', 'field_worker'].includes(req.user.role)) {
    filter.$and.push({ $or: [{ assignedOfficer: req.user._id }, { assignedFieldWorker: req.user._id }] });
  }
  return filter;
}

export async function dashboard(req, res, next) {
  try {
    const filter = scopedFilter(req);
    if (!filter) return res.status(403).json({ success: false, message: 'Department assignment is required.' });
    const departmentName = departmentNameFor(req.user);
    const activeStatuses = ['assigned', 'in_progress', 'under_review'];
    const now = new Date();
    const [statusRows, priorityRows, recent, unreadCount, overdueCount, staffRows, teamRows, taskRows, escalationCount, resourceRows] = await Promise.all([
      Report.aggregate([{ $match: filter }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
      Report.aggregate([{ $match: filter }, { $group: { _id: '$priority', count: { $sum: 1 } } }]),
      Report.find(filter).select('-createdBy').populate('assignedOfficer', 'name').sort({ updatedAt: -1 }).limit(8).lean(),
      Notification.countDocuments({ recipient: req.user._id, readAt: null }),
      Report.countDocuments({ ...filter, dueAt: { $lt: now, $ne: null }, status: { $nin: ['completed', 'closed'] } }),
      managementRoles.includes(req.user.role)
        ? User.aggregate([{ $match: { departmentName, status: 'active', role: { $in: ['department_officer', 'officer', 'field_worker'] } } }, { $group: { _id: '$role', count: { $sum: 1 } } }])
        : Promise.resolve([]),
      DepartmentTeam.aggregate([{ $match: { departmentName, active: true } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
      DepartmentTask.aggregate([{ $match: { departmentName } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
      Report.countDocuments({ ...filter, 'escalation.isEscalated': true, 'escalation.resolvedAt': null }),
      DepartmentResource.aggregate([{ $match: { departmentName } }, { $group: { _id: '$status', count: { $sum: 1 } } }])
    ]);
    const byStatus = Object.fromEntries(statusRows.map((row) => [row._id, row.count]));
    const byPriority = Object.fromEntries(priorityRows.map((row) => [row._id, row.count]));
    const byTeamStatus = Object.fromEntries(teamRows.map((row) => [row._id, row.count]));
    const byTaskStatus = Object.fromEntries(taskRows.map((row) => [row._id, row.count]));
    const byResourceStatus = Object.fromEntries(resourceRows.map((row) => [row._id, row.count]));
    const recentWithNextAction = recent.map((report) => ({ ...report, nextAction: getReportNextAction(report), sla: calculateDepartmentSla(report) }));
    res.json({ success: true, stats: {
      total: statusRows.reduce((sum, row) => sum + row.count, 0),
      pending: byStatus.pending || 0,
      verified: byStatus.verified || 0,
      assigned: byStatus.assigned || 0,
      inProgress: byStatus.in_progress || 0,
      completed: byStatus.completed || 0,
      closed: byStatus.closed || 0,
      active: activeStatuses.reduce((sum, status) => sum + (byStatus[status] || 0), 0),
      overdue: overdueCount,
      activeOfficers: staffRows.filter((row) => ['department_officer', 'officer'].includes(row._id)).reduce((sum, row) => sum + row.count, 0),
      fieldWorkers: staffRows.find((row) => row._id === 'field_worker')?.count || 0,
      critical: byPriority.urgent || 0,
      unreadNotifications: unreadCount,
      // Operational metrics
      activeTeams: teamRows.reduce((sum, row) => sum + row.count, 0),
      availableTeams: byTeamStatus.available || 0,
      busyTeams: byTeamStatus.busy || 0,
      blockedTasks: byTaskStatus.blocked || 0,
      activeTasks: (byTaskStatus.assigned || 0) + (byTaskStatus.accepted || 0) + (byTaskStatus.traveling || 0) + (byTaskStatus.arrived || 0) + (byTaskStatus.in_progress || 0),
      completedTasks: byTaskStatus.completed || 0,
      escalatedCases: escalationCount,
      resourcesInUse: byResourceStatus.in_use || 0,
      resourcesAvailable: byResourceStatus.available || 0
    }, recent: recentWithNextAction });
  } catch (error) { next(error); }
}

export async function listReports(req, res, next) {
  try {
    const filter = scopedFilter(req);
    if (!filter) return res.status(403).json({ success: false, message: 'Department assignment is required.' });
    const { search = '', status = '', priority = '', category = '', officer = '', fieldWorker = '', overdue = '', escalated = '', page = 1, limit = 10, sort = 'updated' } = req.query;
    if (reportStatuses.includes(status)) filter.status = status;
    if (reportPriorities.includes(priority)) filter.priority = priority;
    if (String(category).trim()) filter.category = String(category).trim();
    if (mongoose.Types.ObjectId.isValid(officer)) filter.assignedOfficer = officer;
    if (mongoose.Types.ObjectId.isValid(fieldWorker)) filter.assignedFieldWorker = fieldWorker;
    if (escalated === 'true') {
      filter['escalation.isEscalated'] = true;
      filter['escalation.resolvedAt'] = null;
    }
    if (overdue === 'true') {
      filter.dueAt = { $lt: new Date(), $ne: null };
      filter.$and = [...(filter.$and || []), { status: { $nin: ['completed', 'closed'] } }];
    }
    if (search.trim()) {
      const expression = new RegExp(escapeRegex(search), 'i');
      filter.$and = [...(filter.$and || []), { $or: [{ title: expression }, { description: expression }, { category: expression }] }];
    }
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(50, Math.max(1, Number(limit) || 10));
    const order = sort === 'oldest' ? { createdAt: 1 } : sort === 'priority' ? { priorityRank: -1, dueAt: 1, createdAt: 1 } : { updatedAt: -1 };
    const [reportRows, total] = await Promise.all([
      Report.aggregate([
        { $match: filter },
        { $addFields: { priorityRank: { $switch: { branches: [
          { case: { $eq: ['$priority', 'urgent'] }, then: 4 },
          { case: { $eq: ['$priority', 'high'] }, then: 3 },
          { case: { $eq: ['$priority', 'medium'] }, then: 2 },
          { case: { $eq: ['$priority', 'low'] }, then: 1 }
        ], default: 0 } } } },
        { $sort: order },
        { $skip: (safePage - 1) * safeLimit },
        { $limit: safeLimit },
        { $project: { priorityRank: 0, createdBy: 0 } }
      ]),
      Report.countDocuments(filter)
    ]);
    const reports = await Report.populate(reportRows, [
      { path: 'assignedOfficer', select: 'name role phone' },
      { path: 'assignedFieldWorker', select: 'name role phone' },
      { path: 'assignedTeam', select: 'name status serviceArea' },
      { path: 'activeTask' }
    ]);
    const caseIds = reports.map((report) => report._id);
    const reportCounts = caseIds.length
      ? await Report.aggregate([
        { $match: { $or: [{ masterCaseId: { $in: caseIds } }, { _id: { $in: caseIds }, masterCaseId: { $exists: false } }] } },
        { $group: { _id: { $ifNull: ['$masterCaseId', '$_id'] }, reportCount: { $sum: 1 } } }
      ])
      : [];
    const reportCountByMaster = new Map(reportCounts.map((row) => [String(row._id), row.reportCount]));
    res.json({
      success: true,
      // `aggregate()` returns plain objects and `Model.populate()` does not
      // hydrate them, so `report` is already a plain JSON-ready object here.
      // Calling `toObject()` on it throws `TypeError: report.toObject is not
      // a function`, which 500s every department case list.
      reports: reports.map((report) => ({
        ...report,
        masterReportCount: reportCountByMaster.get(String(report._id)) || 1,
        nextAction: getReportNextAction(report),
        sla: calculateDepartmentSla(report)
      })),
      pagination: { page: safePage, limit: safeLimit, total, pages: Math.ceil(total / safeLimit) }
    });
  } catch (error) { next(error); }
}

export async function getReport(req, res, next) {
  try {
    const report = await loadScopedReport(req, res);
    if (report) {
      const reportObj = report.toObject();
      const linkedReports = await Report.find({ masterCaseId: report._id, _id: { $ne: report._id } })
        .select('_id title description category location status workflowStage createdAt')
        .sort({ createdAt: 1 })
        .lean();
      const safeLinkedReports = linkedReports.map((linkedReport) => ({
        ...linkedReport,
        title: sanitizePublicIssueText(linkedReport.title),
        description: sanitizePublicIssueText(linkedReport.description),
        location: { area: sanitizePublicIssueText(linkedReport.location?.area || '') }
      }));
      const potentialDuplicates = await findPotentialDuplicateReports({
        title: report.title,
        description: report.description,
        category: report.category,
        departmentName: report.departmentName,
        location: report.location,
        excludeReportId: report._id
      });
      res.json({
        success: true,
        report: {
          ...reportObj,
          linkedReports: safeLinkedReports,
          masterReportCount: safeLinkedReports.length + 1,
          potentialDuplicates,
          nextAction: getReportNextAction(report),
          sla: calculateDepartmentSla(report)
        }
      });
    }

  } catch (error) { next(error); }
}

export async function reviewDuplicateCase(req, res, next) {
  try {
    if (!managementRoles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Only department management can review potential duplicate cases.' });
    }
    const report = await loadScopedReport(req, res);
    if (!report) return;
    const action = String(req.body.action || '');
    if (!['link', 'separate'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Choose whether to link the case or keep it separate.' });
    }
    if (action === 'separate') {
      report.duplicateReviewStatus = 'separate';
      report.activity.push({ action: 'Department review kept this civic case separate', actorRole: req.user.role });
      await report.save();
      await auditLog(req.user, 'DUPLICATE_CASE_KEPT_SEPARATE', 'report', report._id, report.title, 'Department management reviewed potential related cases.');
      return res.json({ success: true, message: 'This civic case will proceed separately.', report });
    }

    if (report.status === 'closed' || ['RESOLVED', 'CANCELLED'].includes(report.workflowStage)) {
      return res.status(409).json({ success: false, message: 'A resolved civic case cannot be linked to another issue.' });
    }
    const targetId = String(req.body.masterCaseId || '');
    if (!mongoose.Types.ObjectId.isValid(targetId) || targetId === String(report._id)) {
      return res.status(400).json({ success: false, message: 'Select a valid existing master civic case.' });
    }
    const candidates = await findPotentialDuplicateReports({
      title: report.title,
      description: report.description,
      category: report.category,
      departmentName: report.departmentName,
      location: report.location,
      excludeReportId: report._id
    });
    if (!candidates.some((candidate) => candidate.id === targetId)) {
      return res.status(409).json({ success: false, message: 'The selected case is no longer a valid nearby match.' });
    }
    if (report.activeTask || await DepartmentTask.exists({ report: report._id })) {
      return res.status(409).json({ success: false, message: 'A case with field task history cannot be linked to another master case.' });
    }
    const target = await Report.findOne({
      _id: targetId,
      departmentName: report.departmentName,
      isMasterReport: { $ne: false },
      relationType: { $ne: 'DUPLICATE' },
      status: { $ne: 'closed' },
      workflowStage: { $nin: ['RESOLVED', 'CANCELLED'] }
    }).select('_id title');
    if (!target) return res.status(404).json({ success: false, message: 'Master civic case not found.' });

    const claimed = await Report.findOneAndUpdate(
      {
        _id: report._id,
        activeTask: null,
        assignedDepartmentOfficer: null,
        assignedOfficer: null,
        relationType: { $ne: 'DUPLICATE' },
        workflowStage: { $in: ['SUBMITTED', 'DEPARTMENT_HEAD_REVIEW', 'ASSIGNED_TO_DEPARTMENT_OFFICER'] }
      },
      {
        $set: {
          masterCaseId: target._id,
          duplicateOf: target._id,
          isMasterReport: false,
          relationType: 'DUPLICATE',
          assignedDepartmentOfficer: null,
          assignedOfficer: null,
          assignedFieldWorker: null,
          assignedTeam: null,
          teamLeader: null,
          activeTask: null
        }
      },
      { new: true }
    );
    if (!claimed) return res.status(409).json({ success: false, message: 'This case has changed and can no longer be linked.' });
    const linked = await Report.updateMany(
      { masterCaseId: report._id, _id: { $ne: report._id } },
      { $set: { masterCaseId: target._id, duplicateOf: target._id, isMasterReport: false, relationType: 'DUPLICATE' } }
    );
    await Report.updateOne(
      { _id: target._id },
      { $push: { activity: { action: 'Related civic reports linked to this master case', actorRole: req.user.role, note: `${linked.modifiedCount + 1} report(s) linked by department review.` } } }
    );
    const reporterIds = await Report.find({ masterCaseId: target._id }).distinct('createdBy');
    await Promise.all(reporterIds.map((recipient) => Notification.create({
      recipient,
      report: target._id,
      type: 'report_status',
      message: 'The civic issue you reported has been linked to a master civic case.'
    }).catch((error) => console.error('[notification] duplicate case link notification failed:', error.message))));
    await auditLog(req.user, 'DUPLICATE_CASE_LINKED', 'report', report._id, report.title, `Linked to master case "${target.title}".`, { masterCaseId: String(target._id) });
    return res.json({ success: true, message: 'Related reports linked to the master civic case.', masterCaseId: target._id });
  } catch (error) { next(error); }
}

export async function listStaff(req, res, next) {
  try {
    if (!managementRoles.includes(req.user.role)) return res.status(403).json({ success: false, message: 'Only department management can view the department staff directory.' });
    const departmentName = departmentNameFor(req.user);
    if (!departmentName) return res.status(403).json({ success: false, message: 'Department assignment is required.' });
    const staff = await User.find({ departmentName, role: { $in: ['department_officer', 'officer', 'field_worker'] }, status: 'active' }).select('name role departmentName').lean();
    const workloads = await Report.aggregate([{ $match: { departmentName, status: { $in: ['assigned', 'in_progress', 'under_review'] } } }, { $facet: {
      officers: [{ $match: { assignedOfficer: { $ne: null } } }, { $group: { _id: '$assignedOfficer', count: { $sum: 1 } } }],
      workers: [{ $match: { assignedFieldWorker: { $ne: null } } }, { $group: { _id: '$assignedFieldWorker', count: { $sum: 1 } } }]
    } }]);
    const counts = new Map();
    for (const row of [...(workloads[0]?.officers || []), ...(workloads[0]?.workers || [])]) {
      const id = String(row._id);
      counts.set(id, (counts.get(id) || 0) + row.count);
    }
    res.json({ success: true, staff: staff.map((person) => ({ ...person, id: person._id, workload: counts.get(String(person._id)) || 0 })) });
  } catch (error) { next(error); }
}

export async function departmentActivity(req, res, next) {
  try {
    if (!headRoles.includes(req.user.role)) return res.status(403).json({ success: false, message: 'Only department heads can view department activity.' });
    const filter = scopedFilter(req);
    if (!filter) return res.status(403).json({ success: false, message: 'Department assignment is required.' });
    const reports = await Report.find(filter).select('title activity').sort({ updatedAt: -1 }).limit(100).lean();
    const activity = reports.flatMap((report) => (report.activity || []).map((entry) => ({
      ...entry,
      caseId: report._id,
      caseLabel: report.title
    }))).sort((left, right) => new Date(right.timestamp) - new Date(left.timestamp)).slice(0, 100);
    res.json({ success: true, activity });
  } catch (error) { next(error); }
}

export async function updatePriority(req, res, next) {
  try {
    if (!headRoles.includes(req.user.role)) return res.status(403).json({ success: false, message: 'Only department heads can change priority.' });
    if (!reportPriorities.includes(req.body.priority)) return res.status(400).json({ success: false, message: 'Invalid priority.' });
    const report = await loadScopedReport(req, res);
    if (!report) return;
    const previous = report.priority;
    report.priority = req.body.priority;
    report.activity.push({ action: `Priority changed from ${label(previous)} to ${label(report.priority)}`, actorRole: req.user.role, note: req.body.note || '' });
    await report.save();
    res.json({ success: true, message: 'Priority updated.', report });
  } catch (error) { next(error); }
}

export async function assignReport(req, res, next) {
  try {
    // ── Load the case first ───────────────────────────────────────────────
    // Case-level hand-off is management only. An Officer or Worker reaching
    // this endpoint is refused up front rather than being told the case does
    // not exist, which would be a confusing answer to a real authorisation
    // question. Worker booking happens on the task, under `officer`.
    if (!canAssignCaseLevel(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Only department heads and department officers can hand off a case.'
      });
    }

    // Scoping happens before any further authority check so a user from another
    // department gets a 404 rather than a 403 that would confirm the case
    // exists.
    const report = await loadScopedReport(req, res);
    if (!report) return;

    // ── Assignment authority ──────────────────────────────────────────────
    // A Department Head hands a case to a Department Officer. A Department
    // Officer hands it to an Officer. Workers and teams are an *operational*
    // act reserved for Officers, and live on the task — never on the case.
    const { departmentOfficerId, officerId, fieldWorkerId, teamId } = req.body;
    if (fieldWorkerId || teamId) {
      return res.status(403).json({
        success: false,
        message: 'Workers and teams are assigned by an Officer on the task, not on the case. Use the task assignment endpoint.'
      });
    }
    const requested = [];
    if (departmentOfficerId !== undefined) requested.push('departmentOfficerId');
    if (officerId !== undefined) requested.push('officerId');
    if (!requested.length) {
      return res.status(400).json({ success: false, message: 'Select a Department Officer or an Officer to assign.' });
    }
    if (requested.length > 1) {
      return res.status(422).json({ success: false, message: 'Assign one person at a time so the chain of custody stays unambiguous.' });
    }
    const isDepartmentOfficerHandoff = requested[0] === 'departmentOfficerId';
    const targetId = isDepartmentOfficerHandoff ? departmentOfficerId : officerId;

    // Role, department, active state and existence are all decided by the
    // service from the *authenticated* actor. Nothing in the body is trusted.
    const target = await resolveAssignableTarget({ actor: req.user, targetUserId: targetId, res });
    if (!target) return;

    // ── Workflow transition ───────────────────────────────────────────────
    // A Department Head reviewing a brand-new case is one act: the review is
    // acknowledged and the case is handed on. Both stages are recorded so the
    // timeline shows the review that actually happened.
    if (req.user.role === 'department_head' && isDepartmentOfficerHandoff) {
      applyStage(report, 'DEPARTMENT_HEAD_REVIEW', req.user, 'Department Head reviewed the new case.');
    }

    const nextStage = isDepartmentOfficerHandoff ? 'ASSIGNED_TO_DEPARTMENT_OFFICER' : 'ASSIGNED_TO_OFFICER';
    const transition = checkStageTransition({ from: report.workflowStage, to: nextStage, actorRole: req.user.role });
    if (!transition.ok) {
      return res.status(transition.status).json({ success: false, message: transition.message });
    }

    // ── Apply the hand-off ────────────────────────────────────────────────
    const previousStage = report.workflowStage;
    if (isDepartmentOfficerHandoff) {
      report.assignedDepartmentOfficer = target._id;
      // A new Department Officer takes over the chain from scratch.
      report.assignedOfficer = null;
      report.assignedTeam = null;
      report.teamLeader = null;
      report.assignedFieldWorker = null;
    } else {
      report.assignedOfficer = target._id;
      // The Officer now owns the work, so any stale team/worker link from a
      // previous chain is cleared rather than left to confuse the dashboard.
      report.assignedTeam = null;
      report.teamLeader = null;
      report.assignedFieldWorker = null;
    }
    report.workflowStage = nextStage;
    report.workflowHistory.push({
      stage: nextStage,
      previousStage,
      actor: req.user._id,
      actorRole: req.user.role,
      note: `${isDepartmentOfficerHandoff ? 'Department Officer' : 'Officer'}: ${target.name}`
    });

    if (['pending', 'verified'].includes(report.status)) {
      report.status = 'assigned';
    }

    // Set initial response SLA target if not set
    if (!report.sla?.responseDueAt) {
      const targets = departmentSlaTargets[report.priority || 'medium'] || departmentSlaTargets.medium;
      report.sla = {
        ...report.sla,
        responseDueAt: new Date(Date.now() + targets.response * 60000),
        arrivalDueAt: new Date(Date.now() + targets.arrival * 60000),
        resolutionDueAt: report.dueAt || new Date(Date.now() + targets.resolution * 60000),
        acknowledgedAt: new Date()
      };
    }

    // The field task is created by the Officer once they accept the work, not
    // here: no worker may be committed before an Officer owns the case.
    const assigneeLabel = isDepartmentOfficerHandoff ? roleLabel('department_officer') : roleLabel('officer');
    const changeNote = `${assigneeLabel}: ${target.name} (${previousStage} → ${nextStage})`;
    report.activity.push({ action: `Assigned to ${assigneeLabel}`, actorRole: req.user.role, note: changeNote });
    await report.save();
    await notifyMasterCaseReporters(
      report,
      `Your civic issue "${report.title}" was assigned to ${roleLabel(target.role)}.`
    );

    await auditLog(
      req.user,
      isDepartmentOfficerHandoff ? 'REPORT_ASSIGNED_TO_DEPARTMENT_OFFICER' : 'REPORT_ASSIGNED_TO_OFFICER',
      'report',
      report._id,
      report.title,
      changeNote,
      { assignedUserId: String(target._id), assignedRole: target.role, previousStatus: previousStage, newStatus: nextStage }
    );

    await Notification.create({
      recipient: target._id,
      report: report._id,
      type: 'report_status',
      message: `You were assigned "${report.title}" as ${assigneeLabel}.`
    });

    emitDepartmentEvent('CASE_ASSIGNED', {
      caseId: report._id,
      title: report.title,
      departmentName: report.departmentName,
      status: report.status,
      workflowStage: nextStage,
      assignedDepartmentOfficer: isDepartmentOfficerHandoff ? target._id : null,
      assignedOfficer: isDepartmentOfficerHandoff ? null : target._id
    }, { userIds: [target._id], department: report.departmentName });

    await report.populate('assignedDepartmentOfficer', 'name role phone');
    await report.populate('assignedOfficer', 'name role phone');
    await report.populate('assignedFieldWorker', 'name role phone');
    await report.populate('assignedTeam', 'name status serviceArea phone');
    await report.populate('teamLeader', 'name role phone');
    await report.populate('activeTask');

    res.json({ success: true, message: `Case assigned to ${assigneeLabel} ${target.name}.`, report });
  } catch (error) { next(error); }
}

/**
 * POST /reports/:id/review
 * Department Head moves a freshly submitted case into department review.
 */
export async function startReview(req, res, next) {
  try {
    if (!headRoles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Only department heads can start a case review.' });
    }
    const report = await loadScopedReport(req, res);
    if (!report) return;
    const note = String(req.body.note || '').trim().slice(0, 500);
    if (!applyStage(report, 'DEPARTMENT_HEAD_REVIEW', req.user, note || 'Department Head started the case review.')) {
      return res.status(409).json({
        success: false,
        message: `A case at ${stageLabel(report.workflowStage)} cannot be moved into department review.`
      });
    }
    await report.save();
    await auditLog(req.user, 'REPORT_REVIEW_STARTED', 'report', report._id, report.title, 'Department Head started the case review.');
    res.json({ success: true, message: 'Case moved into department review.', report });
  } catch (error) { next(error); }
}

export async function addReportNote(req, res, next) {
  try {
    const report = await loadScopedReport(req, res);
    if (!report) return;
    const note = typeof req.body.note === 'string' ? req.body.note.trim() : '';
    if (note.length < 3 || note.length > 1000) return res.status(400).json({ success: false, message: 'Notes must be between 3 and 1000 characters.' });
    report.activity.push({ action: 'Operational note added', actorRole: req.user.role, note });
    await report.save();
    res.json({ success: true, message: 'Note added.', report });
  } catch (error) { next(error); }
}

export async function updateStatus(req, res, next) {
  try {
    if (!departmentRoles.includes(req.user.role)) return res.status(403).json({ success: false, message: 'You do not have permission to update this report.' });
    if (!reportStatuses.includes(req.body.status)) return res.status(400).json({ success: false, message: 'Invalid status.' });
    const report = await loadScopedReport(req, res);
    if (!report) return;
    if (req.user.role !== 'department_head' && ['completed', 'closed'].includes(req.body.status)) return res.status(403).json({ success: false, message: 'Department head approval is required.' });
    const previous = report.status;
    if (req.body.status === 'closed' && !canTransitionReport(previous, 'closed')) return res.status(409).json({ success: false, message: `Invalid status transition from ${label(previous)} to closed.` });
    if (req.body.status !== previous && !canTransitionReport(previous, req.body.status)) return res.status(409).json({ success: false, message: `Invalid status transition from ${label(previous)} to ${label(req.body.status)}.` });
    report.status = req.body.status;
    report.activity.push({ action: `Status changed from ${label(previous)} to ${label(report.status)}`, actorRole: req.user.role, note: req.body.note || '' });
    await report.save();
    await notifyMasterCaseReporters(report, `The civic issue "${report.title}" is now ${label(report.status)}.`);
    res.json({ success: true, message: 'Status updated.', report });
  } catch (error) { next(error); }
}

export async function submitCompletion(req, res, next) {
  try {
    const report = await loadScopedReport(req, res);
    if (!report) return;
    if (!departmentRoles.includes(req.user.role) || req.user.role === 'field_worker') {
      return res.status(403).json({ success: false, message: 'Field Workers must submit completion through their assigned field task.' });
    }
    const fieldTask = await DepartmentTask.findOne({ report: report._id }).sort({ createdAt: -1 }).select('team workerAssignments');
    if (fieldTask?.team && fieldTask.workerAssignments.length) {
      return res.status(409).json({ success: false, message: 'Submit completion through the assigned field task and Team Leader verification workflow.' });
    }
    const { summary = '', materials = '', notes = '', beforeImages = [], afterImages = [] } = req.body;
    if (summary.trim().length < 10) return res.status(400).json({ success: false, message: 'Work summary must be at least 10 characters.' });
    if (!canTransitionReport(report.status, 'completed')) return res.status(409).json({ success: false, message: `A completion report can only be submitted from under review; current status is ${label(report.status)}.` });
    report.completionReport = { summary: summary.trim(), materials: String(materials).trim(), notes: String(notes).trim(), beforeImages, afterImages, submittedBy: req.user._id, submittedAt: new Date(), verificationStatus: 'submitted' };
    report.status = 'completed';
    report.activity.push({ action: 'Completion report submitted', actorRole: req.user.role, note: summary.trim().slice(0, 160) });
    // The team's work is done; the case now waits for Department Officer
    // verification and the Department Head's final resolution.
    if (!applyStage(report, 'PENDING_VERIFICATION', req.user, 'Field work completed — awaiting verification.')) {
      report.workflowHistory.push({
        stage: 'PENDING_VERIFICATION',
        previousStage: report.workflowStage,
        actor: req.user._id,
        actorRole: req.user.role,
        note: 'Field work completed — awaiting verification.'
      });
      report.workflowStage = 'PENDING_VERIFICATION';
    }
    await report.save();
    res.json({ success: true, message: 'Completion report submitted.', report });
  } catch (error) { next(error); }
}

export async function reviewCompletion(req, res, next) {
  try {
    const requested = String(req.body.verificationStatus || '');
    if (!completionStatuses.includes(requested)) return res.status(400).json({ success: false, message: 'Invalid verification status.' });
    const isHead = headRoles.includes(req.user.role);
    const isDepartmentOfficer = req.user.role === 'department_officer';
    if (!isHead && !isDepartmentOfficer) {
      return res.status(403).json({ success: false, message: 'Only the Department Officer or the Department Head can review a completed case.' });
    }
    if (requested === 'verified' && !isDepartmentOfficer) {
      return res.status(403).json({ success: false, message: `Only the ${roleLabel('department_officer')} can verify completed work.` });
    }
    if (requested === 'approved' && !isHead) {
      return res.status(403).json({ success: false, message: `Only the ${roleLabel('department_head')} can resolve a case.` });
    }
    const report = await loadScopedReport(req, res);
    if (!report) return;
    const fieldTask = await DepartmentTask.findOne({ report: report._id }).sort({ createdAt: -1 })
      .select('status team workerAssignments teamLeader assignedOfficer timeline departmentName title report');
    if (fieldTask?.team && fieldTask.workerAssignments.length && fieldTask.status !== 'verified') {
      return res.status(409).json({ success: false, message: 'The Team Leader must verify the completed field task before Department review.' });
    }
    const currentVerificationStatus = report.completionReport?.verificationStatus || 'not_submitted';
    if (!canReviewReportCompletion(report.status, currentVerificationStatus, requested)) {
      return res.status(409).json({
        success: false,
        message: currentVerificationStatus === 'verified'
          ? 'This completion report is already verified and only awaits the department head review.'
          : 'Completion review is only available for a submitted completion report.'
      });
    }
    const note = String(req.body.note || '').trim().slice(0, 500);
    report.completionReport.verificationStatus = requested;
    if (requested === 'approved') {
      report.status = 'closed';
      report.sla = { ...report.sla, resolvedAt: report.sla?.resolvedAt || new Date() };
    }
    if (requested === 'rejected') report.status = 'in_progress';

    const nextStage = completionStageFor(requested);
    if (nextStage && !applyStage(report, nextStage, req.user, note)) {
      report.workflowHistory.push({ stage: nextStage, previousStage: report.workflowStage, actor: req.user._id, actorRole: req.user.role, note });
      report.workflowStage = nextStage;
    }
    report.activity.push({ action: `Completion ${requested}`, actorRole: req.user.role, note });
    if (requested === 'rejected' && fieldTask?.team && fieldTask.workerAssignments.length) {
      fieldTask.status = 'cancelled';
      fieldTask.timeline.push({
        status: 'cancelled',
        actor: req.user._id,
        actorRole: req.user.role,
        note: 'Completion rejected; the Team Leader must dispatch a new field task.'
      });
      await fieldTask.save();
      if (String(report.activeTask?._id || report.activeTask || '') === String(fieldTask._id)) report.activeTask = null;
      const recipients = [...new Set([
        fieldTask.teamLeader ? String(fieldTask.teamLeader) : '',
        fieldTask.assignedOfficer ? String(fieldTask.assignedOfficer) : '',
        ...fieldTask.workerAssignments.map((assignment) => String(assignment.worker))
      ].filter(Boolean))];
      await Promise.all(recipients.map((recipient) => Notification.create({
        recipient,
        report: report._id,
        type: 'report_status',
        message: `Completion was sent back for rework on "${report.title}". The Team Leader will dispatch a new field task.`
      }).catch((error) => console.error('[notification] failed to notify field team of rejected completion:', error.message))));
      await auditLog(req.user, 'FIELD_TASK_REWORK_REQUIRED', 'task', fieldTask._id, fieldTask.title, 'Completion rejected; new task required.');
      emitDepartmentEvent('TASK_STATUS_CHANGED', {
        taskId: fieldTask._id,
        caseId: report._id,
        status: 'cancelled',
        departmentName: fieldTask.departmentName
      }, { userIds: recipients, department: fieldTask.departmentName });
    }
    await report.save();
    await notifyMasterCaseReporters(
      report,
      requested === 'approved'
        ? `The civic issue "${report.title}" is resolved.`
        : requested === 'verified'
          ? `Work for "${report.title}" was verified and awaits final approval.`
          : `Work on "${report.title}" was sent back for rework.`
    );
    res.json({ success: true, message: 'Completion review saved.', report });
  } catch (error) { next(error); }
}

export async function analytics(req, res, next) {
  try {
    const filter = scopedFilter(req);
    if (!filter) return res.status(403).json({ success: false, message: 'Department assignment is required.' });
    const [byStatus, byCategory, byPriority, overTime] = await Promise.all([
      Report.aggregate([{ $match: filter }, { $group: { _id: '$status', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
      Report.aggregate([{ $match: filter }, { $group: { _id: '$category', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
      Report.aggregate([{ $match: filter }, { $group: { _id: '$priority', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
      Report.aggregate([{ $match: filter }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } }, { $sort: { _id: 1 } }, { $limit: 30 }])
    ]);
    res.json({ success: true, analytics: { byStatus, byCategory, byPriority, overTime } });
  } catch (error) { next(error); }
}
// --- Teams Management & Recommendation Engine ---

export async function listTeams(req, res, next) {
  try {
    const departmentName = departmentNameFor(req.user);
    if (!departmentName) return res.status(403).json({ success: false, message: 'Department assignment required.' });
    const teams = await DepartmentTeam.find({ departmentName, active: true })
      .populate('leader', 'name email phone role')
      .populate('members', 'name email phone role')
      .sort({ name: 1 })
      .lean();

    const teamIds = teams.map((t) => t._id);
    const activeTasks = await DepartmentTask.aggregate([
      { $match: { team: { $in: teamIds }, status: { $in: ['assigned', 'accepted', 'traveling', 'arrived', 'in_progress', 'blocked'] } } },
      { $group: { _id: '$team', count: { $sum: 1 } } }
    ]);
    const taskCountMap = Object.fromEntries(activeTasks.map((t) => [String(t._id), t.count]));

    const enriched = teams.map((team) => {
      const activeCount = taskCountMap[String(team._id)] || 0;
      const capacity = team.capacity || 5;
      const workloadPercent = Math.min(100, Math.round((activeCount / capacity) * 100));
      return {
        ...team,
        activeTasksCount: activeCount,
        workloadPercent
      };
    });

    res.json({ success: true, teams: enriched });
  } catch (error) { next(error); }
}

export async function createTeam(req, res, next) {
  try {
    if (!['department_head', 'officer'].includes(req.user.role)) return res.status(403).json({ success: false, message: 'Only the Department Head or a Team Leader can create teams.' });
    const departmentName = departmentNameFor(req.user);
    const department = await Department.findOne({ _id: req.user.department?._id || req.user.department, name: departmentName, status: 'active' });
    if (!department) return res.status(403).json({ success: false, message: 'An active department assignment is required.' });
    const { name, leaderId, memberIds = [], skills = [], serviceArea = '', capacity = 5, phone = '', notes = '' } = req.body;
    if (typeof name !== 'string' || !name.trim()) return res.status(400).json({ success: false, message: 'Team name is required.' });
    const leader = req.user.role === 'officer' ? req.user._id : leaderId;
    if (req.user.role === 'officer' && leaderId && String(leaderId) !== String(req.user._id)) return res.status(403).json({ success: false, message: 'Team Leaders can create only their own teams.' });
    await validateTeamStaff(department._id, leader, memberIds, Number(capacity));

    const team = await DepartmentTeam.create({
      name: name.trim(),
      department: department?._id,
      departmentName,
      leader: leader || null,
      members: memberIds,
      skills: Array.isArray(skills) ? skills : [],
      serviceArea: String(serviceArea).trim(),
      capacity: Number(capacity),
      phone: String(phone).trim(),
      notes: String(notes).trim()
    });

    await auditLog(req.user, 'team_created', 'department', team._id, team.name, 'Department response team created.');
    emitDepartmentEvent('TEAM_ASSIGNMENT_CREATED', { teamId: team._id, name: team.name, departmentName }, { department: departmentName });

    res.status(201).json({ success: true, team });
  } catch (error) { next(error); }
}

export async function updateTeam(req, res, next) {
  try {
    if (!['department_head', 'officer'].includes(req.user.role)) return res.status(403).json({ success: false, message: 'Only the Department Head or the team leader can modify teams.' });
    const departmentName = departmentNameFor(req.user);
    if (!departmentName) return res.status(403).json({ success: false, message: 'Department assignment required.' });
    const team = await DepartmentTeam.findOne({ _id: req.params.id, departmentName });
    if (!team) return res.status(404).json({ success: false, message: 'Team not found.' });
    if (req.user.role === 'officer' && String(team.leader) !== String(req.user._id)) return res.status(403).json({ success: false, message: 'You can manage only teams you lead.' });
    const leader = req.body.leader !== undefined ? req.body.leader : req.body.leaderId !== undefined ? req.body.leaderId : team.leader;
    const members = req.body.members ?? req.body.memberIds ?? team.members;
    if (req.user.role === 'officer' && String(leader) !== String(req.user._id)) return res.status(403).json({ success: false, message: 'Only the Department Head can change the Team Leader.' });
    const busy = await DepartmentTask.exists({ team: team._id, status: { $nin: ['completed', 'verified', 'cancelled', 'rejected'] } });
    const changingRoster = String(leader || '') !== String(team.leader || '') || JSON.stringify(members.map?.(String)) !== JSON.stringify(team.members.map(String)) || (req.body.capacity !== undefined && Number(req.body.capacity) !== team.capacity) || (req.body.active !== undefined && req.body.active !== team.active) || (req.body.status !== undefined && req.body.status !== team.status);
    if (busy && changingRoster) return res.status(409).json({ success: false, message: 'Finish or detach active work before changing the team roster or availability.' });
    if (!busy && req.body.status === 'busy') return res.status(409).json({ success: false, message: 'Team busy status is controlled by operational assignment.' });
    await validateTeamStaff(team.department, leader, members, Number(req.body.capacity ?? team.capacity));

    const allowed = ['name', 'leader', 'members', 'skills', 'serviceArea', 'capacity', 'status', 'phone', 'notes', 'active'];
    for (const key of allowed) {
      if (req.body[key] !== undefined) team[key] = req.body[key];
    }
    team.leader = leader;
    team.members = members;
    await team.save();
    await auditLog(req.user, 'team_updated', 'department', team._id, team.name, 'Department team modified.');

    res.json({ success: true, team });
  } catch (error) { next(error); }
}

async function validateTeamStaff(departmentId, leader, members, capacity) {
  const invalid = (message) => { throw Object.assign(new Error(message), { statusCode: 400 }); };
  if (!Array.isArray(members) || members.some((id) => !mongoose.Types.ObjectId.isValid(id?._id || id)) || new Set(members.map(String)).size !== members.length) invalid('Choose valid, unique field workers.');
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 50 || members.length > capacity) invalid('Team capacity must be 1–50 and cover all selected workers.');
  if (leader && (!mongoose.Types.ObjectId.isValid(leader?._id || leader) || !(await User.exists({ _id: leader, department: departmentId, role: 'officer', status: 'active' })))) invalid('Choose an active Team Leader from this department.');
  const count = await User.countDocuments({ _id: { $in: members }, department: departmentId, role: 'field_worker', status: 'active' });
  if (count !== members.length) invalid('Every team member must be an active Field Worker in this department.');
}
export async function recommendTeams(req, res, next) {
  try {
    const report = await loadScopedReport(req, res);
    if (!report) return;
    const departmentName = departmentNameFor(req.user);

    const teams = await DepartmentTeam.find({ departmentName, active: true })
      .populate('leader', 'name phone')
      .populate('members', 'name role phone')
      .lean();

    const activeTasks = await DepartmentTask.aggregate([
      { $match: { team: { $in: teams.map((t) => t._id) }, status: { $in: activeTaskStatuses } } },
      { $group: { _id: '$team', count: { $sum: 1 } } }
    ]);

    // One shared, deterministic scoring implementation (services/departmentTeamScoring.js)
    // is used here and by the CivicSync AI Gateway, so the recommendation an
    // officer sees on screen and the one the assistant quotes can never diverge.
    const recommendations = scoreTeamsForCase({
      teams,
      taskCounts: taskCountsByTeam(activeTasks),
      category: report.category
    });

    res.json({ success: true, recommendations });
  } catch (error) { next(error); }
}
// --- Tasks Management (Field Worker & Officer Execution) ---

export async function listTasks(req, res, next) {
  try {
    const departmentName = departmentNameFor(req.user);
    if (!departmentName) return res.status(403).json({ success: false, message: 'Department assignment required.' });

    const filter = { departmentName };
    if (req.user.role === 'field_worker') {
      const departmentReportIds = await Report.find({ departmentName }).distinct('_id');
      filter.report = { $in: departmentReportIds };
      const workerTeams = await DepartmentTeam.find({
        departmentName,
        members: req.user._id
      }).distinct('_id');
      const directAssignment = {
        $or: [
          { assignedWorker: req.user._id },
          { workerIds: req.user._id },
          { 'workerAssignments.worker': req.user._id }
        ]
      };
      filter.$or = [
        ...(workerTeams.length ? [{ team: { $in: workerTeams } }] : []),
        { $and: [{ team: null }, directAssignment] }
      ];
    } else if (req.user.role === 'officer') {
      filter.$or = [
        { assignedOfficer: req.user._id },
        { teamLeader: req.user._id }
      ];
    } else if (req.query.workerId) {
      filter.$or = [
        { assignedWorker: req.query.workerId },
        { workerIds: req.query.workerId },
        { 'workerAssignments.worker': req.query.workerId }
      ];
    }
    if (req.query.status) {
      filter.status = req.query.status;
    }

    const tasks = await DepartmentTask.find(filter)
      .populate('report', 'title category priority location dueAt status sla departmentName')
      .populate({ path: 'team', select: 'name serviceArea departmentName leader members', populate: [
        { path: 'leader', select: 'name role' },
        { path: 'members', select: 'name role' }
      ] })
      .populate('assignedWorker', 'name role')
      .populate('workerIds', 'name role availability')
      .populate('workerAssignments.worker', 'name role availability')
      .populate('teamLeader', 'name phone role')
      .sort({ updatedAt: -1 })
      .lean();

    const reportIds = [...new Set(tasks.map((task) => String(task.report?._id || task.report)))];
    const counts = reportIds.length
      ? await Report.aggregate([
        { $match: { $or: [{ masterCaseId: { $in: reportIds.map((id) => new mongoose.Types.ObjectId(id)) } }, { _id: { $in: reportIds.map((id) => new mongoose.Types.ObjectId(id)) }, masterCaseId: { $exists: false } }] } },
        { $group: { _id: { $ifNull: ['$masterCaseId', '$_id'] }, reportCount: { $sum: 1 } } }
      ])
      : [];
    const countByMaster = new Map(counts.map((row) => [String(row._id), row.reportCount]));
    res.json({
      success: true,
      tasks: tasks.map((task) => ({
        ...task,
        masterReportCount: countByMaster.get(String(task.report?._id || task.report)) || 1
      }))
    });
  } catch (error) { next(error); }
}

async function loadScopedTask(req, res) {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    res.status(404).json({ success: false, message: 'Task not found.' });
    return null;
  }
  const task = await DepartmentTask.findById(req.params.id)
    .populate('report', 'title category priority location dueAt status sla departmentName')
    .populate({ path: 'team', select: 'name serviceArea departmentName leader members', populate: [
      { path: 'leader', select: 'name role' },
      { path: 'members', select: 'name role' }
    ] })
    .populate('assignedWorker', 'name role')
    .populate('workerIds', 'name role availability')
    .populate('workerAssignments.worker', 'name role availability')
    .populate('teamLeader', 'name phone role')
    .populate('timeline.actor', 'name role');
  if (!task || !departmentTaskAccess.canAccess(req.user, task)) {
    res.status(404).json({ success: false, message: 'Task not found.' });
    return null;
  }
  if (req.user.role === 'field_worker' && task.report?.departmentName !== task.departmentName) {
    res.status(404).json({ success: false, message: 'Task not found.' });
    return null;
  }
  return task;
}

function validateTaskLocation(latitude, longitude) {
  const hasLatitude = latitude !== undefined && latitude !== null && latitude !== '';
  const hasLongitude = longitude !== undefined && longitude !== null && longitude !== '';
  if (!hasLatitude && !hasLongitude) return { ok: true, value: { latitude: null, longitude: null } };
  if (hasLatitude !== hasLongitude) return { ok: false, message: 'Provide both latitude and longitude, or neither.' };
  const nextLatitude = Number(latitude);
  const nextLongitude = Number(longitude);
  if (!Number.isFinite(nextLatitude) || nextLatitude < -90 || nextLatitude > 90 || !Number.isFinite(nextLongitude) || nextLongitude < -180 || nextLongitude > 180) return { ok: false, message: 'Task location coordinates are invalid.' };
  return { ok: true, value: { latitude: nextLatitude, longitude: nextLongitude } };
}

export async function getTask(req, res, next) {
  try {
    const task = await loadScopedTask(req, res);
    if (task) {
      const reportId = task.report?._id || task.report;
      const masterReportCount = await Report.countDocuments({
        $or: [
          { masterCaseId: reportId },
          { _id: reportId, masterCaseId: { $exists: false } }
        ]
      });
      res.json({ success: true, task: { ...task.toObject(), masterReportCount: masterReportCount || 1 } });
    }
  } catch (error) { next(error); }
}

export async function updateTaskStatus(req, res, next) {
  try {
    const { status, note = '', reason = '', description = '', resourceNeeded = '', latitude, longitude } = req.body;
    const task = await loadScopedTask(req, res);
    if (!task) return;
    if (req.user.role === 'field_worker') {
      return res.status(403).json({ success: false, message: 'Use the worker assignment lifecycle and completion report endpoints for field updates.' });
    }
    if (!departmentTaskAccess.canManage(req.user, task)) return res.status(403).json({ success: false, message: 'You are not authorized to update this task.' });
    if ((task.team || task.workerAssignments.length)
      && ['accepted', 'traveling', 'arrived', 'in_progress'].includes(status)) {
      return res.status(409).json({ success: false, message: 'Workers on the assigned team must accept and start their own field assignments.' });
    }
    if (status === 'completed' && (task.team || task.workerAssignments.length)) {
      return res.status(409).json({ success: false, message: 'Assigned workers must complete the field task before Team Leader verification.' });
    }

    const validTransitions = {
      assigned: ['accepted', 'rejected', 'cancelled'],
      accepted: ['traveling', 'blocked', 'cancelled'],
      traveling: ['arrived', 'blocked'],
      arrived: ['in_progress', 'blocked'],
      in_progress: ['completed', 'blocked', 'paused'],
      paused: ['in_progress', 'blocked'],
      blocked: ['in_progress', 'traveling', 'arrived', 'cancelled'],
      completed: [],
      rejected: [],
      cancelled: []
    };

    if (task.status === status) {
      return res.json({ success: true, message: `Task is already ${status}.`, task });
    }

    if (!validTransitions[task.status]?.includes(status)) {
      return res.status(409).json({ success: false, message: `Cannot transition task from ${task.status} to ${status}.` });
    }
    const location = validateTaskLocation(latitude, longitude);
    if (!location.ok) return res.status(400).json({ success: false, message: location.message });

    const previousStatus = task.status;
    task.status = status;

    if (status === 'rejected') {
      task.rejection = {
        reason: reason.trim() || note.trim(),
        rejectedAt: new Date(),
        rejectedBy: req.user._id
      };
    } else if (status === 'blocked') {
      task.blockedInfo = {
        reason: reason.trim(),
        description: description.trim() || note.trim(),
        resourceNeeded: resourceNeeded.trim(),
        reportedAt: new Date(),
        resolvedAt: null
      };
    } else if (previousStatus === 'blocked' && status !== 'blocked') {
      task.blockedInfo.resolvedAt = new Date();
    } else if (status === 'completed') {
      task.completion.completedAt = new Date();
    }

    task.timeline.push({
      status,
      actor: req.user._id,
      actorRole: req.user.role,
      note: note || reason || description || '',
      location: location.value
    });

    await task.save();

    const report = await Report.findById(task.report);
    if (report) {
      if (status === 'traveling' && ['assigned', 'verified'].includes(report.status)) {
        report.status = 'in_progress';
      } else if (status === 'arrived') {
        report.sla = report.sla || {};
        report.sla.arrivedAt = new Date();
      } else if (status === 'blocked') {
        report.activity.push({
          action: 'Field task reported blocked',
          actorRole: req.user.role,
          note: `Reason: ${reason || 'unspecified'}`
        });
      }
      await report.save();
    }

    await auditLog(req.user, 'task_status_changed', 'report', task.report, task.title, `${previousStatus} → ${status}`);

    emitDepartmentEvent('TASK_STATUS_CHANGED', {
      taskId: task._id,
      caseId: task.report,
      status,
      departmentName: task.departmentName,
      workerId: task.assignedWorker
    }, { department: task.departmentName });

    res.json({ success: true, message: `Task status updated to ${status}.`, task });
  } catch (error) { next(error); }
}

export async function completeTask(req, res, next) {
  try {
    const task = await loadScopedTask(req, res);
    if (!task) return;

    if (req.user.role === 'field_worker') {
      const assignment = task.workerAssignments.find((item) => departmentTaskAccess.sameId(item.worker, req.user._id));
      if (!assignment) return res.status(403).json({ success: false, message: 'You are not assigned to this task.' });
      const summary = typeof req.body.summary === 'string' ? req.body.summary.trim() : '';
      if (summary.length < 10) {
        return res.status(422).json({ success: false, message: 'Add a meaningful completion note of at least 10 characters.' });
      }
      if (task.status !== 'in_progress' || assignment.status !== 'in_progress') {
        return res.status(409).json({ success: false, message: 'Your assignment and field task must both be in progress before completion.' });
      }

      assignment.status = 'completed';
      assignment.progressPercent = 100;
      assignment.completionSummary = summary.slice(0, 1200);
      assignment.updatedAt = new Date();
      task.timeline.push({
        status: 'completed',
        actor: req.user._id,
        actorRole: req.user.role,
        note: summary.slice(0, 160)
      });

      const remainingWorkers = task.workerAssignments.filter((item) => item.status !== 'completed');
      if (remainingWorkers.length) {
        await task.save();
        const teamLeaderId = task.teamLeader?._id || task.teamLeader || task.assignedOfficer?._id || task.assignedOfficer;
        if (teamLeaderId) {
          await Notification.create({
            recipient: teamLeaderId,
            report: task.report?._id || task.report,
            type: 'report_status',
            message: `${req.user.name} completed their part of "${task.title}". ${remainingWorkers.length} team member(s) remain.`
          }).catch((error) => console.error('[notification] failed to notify team leader of field completion:', error.message));
        }
        emitDepartmentEvent('WORKER_TASK_COMPLETED', {
          taskId: task._id,
          caseId: task.report?._id || task.report,
          workerId: req.user._id,
          remainingWorkerIds: remainingWorkers.map((item) => item.worker),
          departmentName: task.departmentName
        }, { userIds: [teamLeaderId, ...remainingWorkers.map((item) => item.worker)].filter(Boolean), department: task.departmentName });
        return res.json({
          success: true,
          message: `Your work is complete. Waiting for ${remainingWorkers.length} team member(s) to finish.`,
          task
        });
      }

      if (!task.workerAssignments.length) {
        return res.status(409).json({ success: false, message: 'This field task has no valid worker assignments.' });
      }

      const teamSummary = task.workerAssignments
        .map((item) => item.completionSummary)
        .filter(Boolean)
        .join('\n')
        .slice(0, 1200);
      task.status = 'completed';
      task.progressPercent = 100;
      task.completion = {
        summary: teamSummary,
        result: '',
        materialsUsed: '',
        remainingIssues: '',
        completedAt: new Date(),
        evidenceUrls: []
      };
      task.timeline.push({
        status: 'completed',
        actor: req.user._id,
        actorRole: req.user.role,
        note: 'All assigned workers completed their field work.'
      });
      await task.save();

      const workerIds = [...new Set([
        task.assignedWorker ? String(task.assignedWorker._id || task.assignedWorker) : '',
        ...(task.workerIds || []).map((worker) => String(worker._id || worker))
      ].filter(Boolean))];
      for (const workerId of workerIds) {
        await releaseWorker({ workerId, res: { status: () => ({ json: () => {} }) } });
      }
      if (task.team) await DepartmentTeam.updateOne({ _id: task.team._id || task.team }, { $set: { status: 'available' } });

      const report = await Report.findById(task.report?._id || task.report);
      if (report) {
        report.status = 'completed';
        report.completionReport = {
          summary: teamSummary || 'Field work completed.',
          materials: '',
          notes: '',
          beforeImages: [],
          afterImages: [],
          submittedBy: req.user._id,
          submittedAt: new Date(),
          verificationStatus: 'submitted'
        };
        report.activity.push({
          action: 'Field work completed by the assigned team',
          actorRole: req.user.role,
          note: teamSummary.slice(0, 500)
        });
        if (report.workflowStage !== 'COMPLETED') applyStage(report, 'COMPLETED', req.user, 'Field work completed by the assigned team.');
        await report.save();
        await notifyMasterCaseReporters(report, `Field work is complete for "${report.title}" and awaits Team Leader verification.`);
      }

      const teamLeaderId = task.teamLeader?._id || task.teamLeader || task.assignedOfficer?._id || task.assignedOfficer;
      if (teamLeaderId) {
        await Notification.create({
          recipient: teamLeaderId,
          report: report?._id || task.report?._id || task.report,
          type: 'report_status',
          message: `All workers completed "${task.title}". It is ready for Team Leader verification.`
        }).catch((error) => console.error('[notification] failed to notify team leader of completed task:', error.message));
      }
      await auditLog(req.user, 'WORKER_TASK_COMPLETED', 'task', task._id, task.title, 'All assigned workers completed field work.', {
        workerId: String(req.user._id),
        teamId: String(task.team?._id || task.team || '')
      });
      emitDepartmentEvent('TASK_COMPLETED', {
        taskId: task._id,
        caseId: report?._id || task.report?._id || task.report,
        departmentName: task.departmentName
      }, { userIds: [teamLeaderId].filter(Boolean), department: task.departmentName });
      return res.json({ success: true, message: 'Field work completed. Awaiting Team Leader verification.', task });
    }

    if (!departmentTaskAccess.canManage(req.user, task)) return res.status(403).json({ success: false, message: 'Not authorized to complete this task.' });
    if (task.team || task.workerAssignments.length) {
      return res.status(409).json({ success: false, message: 'Assigned workers must complete the field task before Team Leader verification.' });
    }

    const summary = typeof req.body.summary === 'string' ? req.body.summary.trim() : '';
    const result = typeof req.body.result === 'string' ? req.body.result.trim() : '';
    const materialsUsed = typeof req.body.materialsUsed === 'string' ? req.body.materialsUsed.trim() : '';
    const remainingIssues = typeof req.body.remainingIssues === 'string' ? req.body.remainingIssues.trim() : '';
    const evidenceUrls = Array.isArray(req.body.evidenceUrls) ? req.body.evidenceUrls : [];
    if (task.status === 'completed') {
      return res.json({ success: true, message: 'Task already completed.', task });
    }
    if (task.status !== 'in_progress') return res.status(409).json({ success: false, message: 'A task must be in progress before it can be completed.' });

    task.status = 'completed';
    task.completion = {
      summary: summary.trim(),
      result: result.trim(),
      materialsUsed: materialsUsed.trim(),
      remainingIssues: remainingIssues.trim(),
      completedAt: new Date(),
      evidenceUrls: Array.isArray(evidenceUrls) ? evidenceUrls : []
    };

    task.timeline.push({
      status: 'completed',
      actor: req.user._id,
      actorRole: req.user.role,
      note: summary.trim().slice(0, 160)
    });

    await task.save();
    if (task.team) await DepartmentTeam.updateOne({ _id: task.team }, { $set: { status: 'available' } });
    const workerIds = [...new Set([
      task.assignedWorker ? String(task.assignedWorker._id || task.assignedWorker) : '',
      ...(task.workerIds || []).map((worker) => String(worker._id || worker))
    ].filter(Boolean))];
    for (const workerId of workerIds) {
      await releaseWorker({ workerId, res: { status: () => ({ json: () => {} }) } });
    }

    const report = await Report.findById(task.report?._id || task.report);
    if (report) {
      report.status = 'completed';
      report.completionReport = {
        summary: summary.trim() || 'Field work completed.',
        materials: materialsUsed.trim(),
        notes: remainingIssues.trim(),
        beforeImages: [],
        afterImages: evidenceUrls,
        submittedBy: req.user._id,
        submittedAt: new Date(),
        verificationStatus: 'submitted'
      };
      report.activity.push({
        action: 'Field task completed and submitted for review',
        actorRole: req.user.role,
        note: summary.trim().slice(0, 160)
      });
      // Team work is finished, so the case moves to Pending Verification and
      // then to the Department Officer's verification queue.
      applyStage(report, 'COMPLETED', req.user, 'Field work completed by the response team.');
      applyStage(report, 'PENDING_VERIFICATION', req.user, 'Awaiting Department Officer verification.');
      await report.save();
      await notifyMasterCaseReporters(report, `Field work is complete for "${report.title}" and is awaiting Department Officer verification.`);

      if (report.assignedOfficer) {
        await Notification.create({
          recipient: report.assignedOfficer,
          report: report._id,
          type: 'report_status',
          message: `Field work completed for "${report.title}". Ready for review.`
        });
      }
    }

    await auditLog(req.user, 'task_completed', 'report', task.report, task.title, 'Field worker marked task completed.');

    emitDepartmentEvent('TASK_COMPLETED', {
      taskId: task._id,
      caseId: task.report,
      departmentName: task.departmentName
    }, { department: task.departmentName });

    res.json({ success: true, message: 'Task completed successfully.', task });
  } catch (error) { next(error); }
}

// --- Case Escalation Engine ---

export async function escalateCase(req, res, next) {
  try {
    const report = await loadScopedReport(req, res);
    if (!report) return;

    const { reason = '' } = req.body;
    if (!reason.trim()) return res.status(400).json({ success: false, message: 'Escalation reason is required.' });

    report.escalation = {
      isEscalated: true,
      reason: reason.trim(),
      escalatedAt: new Date(),
      escalatedBy: req.user._id,
      resolvedAt: null,
      resolutionNote: ''
    };
    report.priority = 'urgent';
    report.activity.push({
      action: 'Case Escalated to Department Head',
      actorRole: req.user.role,
      note: reason.trim()
    });

    await report.save();
    await auditLog(req.user, 'case_escalated', 'report', report._id, report.title, reason.trim());

    const departmentName = departmentNameFor(req.user);
    const heads = await User.find({ departmentName, role: 'department_head', status: 'active' }).select('_id');
    await Promise.all(heads.map((h) => Notification.create({
      recipient: h._id,
      report: report._id,
      type: 'report_status',
      message: `URGENT ESCALATION: "${report.title}" - ${reason.trim()}`
    })));

    emitDepartmentEvent('CASE_ESCALATED', {
      caseId: report._id,
      title: report.title,
      reason: reason.trim(),
      departmentName
    }, { department: departmentName });

    res.json({ success: true, message: 'Case escalated to Department Head.', report });
  } catch (error) { next(error); }
}

export async function resolveEscalation(req, res, next) {
  try {
    if (!headRoles.includes(req.user.role)) return res.status(403).json({ success: false, message: 'Only Department Head can resolve escalations.' });
    const report = await loadScopedReport(req, res);
    if (!report) return;

    const { resolutionNote = '' } = req.body;
    report.escalation.resolvedAt = new Date();
    report.escalation.resolutionNote = resolutionNote.trim();
    report.escalation.isEscalated = false;

    report.activity.push({
      action: 'Escalation Resolved by Department Head',
      actorRole: req.user.role,
      note: resolutionNote.trim()
    });

    await report.save();
    await auditLog(req.user, 'escalation_resolved', 'report', report._id, report.title, resolutionNote.trim());

    res.json({ success: true, message: 'Escalation resolved.', report });
  } catch (error) { next(error); }
}
// --- Case Handover Engine ---

export async function handoverCase(req, res, next) {
  try {
    if (!managementRoles.includes(req.user.role)) return res.status(403).json({ success: false, message: 'Management role required.' });
    const report = await loadScopedReport(req, res);
    if (!report) return;

    const { newOfficerId, reason = '', notes = '' } = req.body;
    if (!newOfficerId || !mongoose.Types.ObjectId.isValid(newOfficerId)) {
      return res.status(400).json({ success: false, message: 'Valid new officer ID required.' });
    }

    const newOfficer = await User.findOne({ _id: newOfficerId, role: { $in: ['department_officer', 'officer'] }, departmentName: report.departmentName, status: 'active' });
    if (!newOfficer) return res.status(400).json({ success: false, message: 'Selected officer is not in this department.' });

    const prevOfficerId = report.assignedOfficer?._id || report.assignedOfficer;
    const activeTaskId = report.activeTask?._id || report.activeTask;
    const activeTask = activeTaskId ? await DepartmentTask.findById(activeTaskId) : null;
    const bookedWorkers = activeTask
      ? [activeTask.assignedWorker, ...(activeTask.workerIds || [])].filter(Boolean)
      : [];
    if (activeTask && bookedWorkers.length && String(activeTask.assignedOfficer) !== String(newOfficer._id)) {
      return res.status(409).json({ success: false, message: 'The active task already has workers. Complete it before changing its Team Leader.' });
    }
    report.handoverHistory = report.handoverHistory || [];
    report.handoverHistory.push({
      previousOfficer: prevOfficerId,
      newOfficer: newOfficer._id,
      reason: reason.trim(),
      notes: notes.trim(),
      transferredAt: new Date()
    });

    report.assignedOfficer = newOfficer._id;
    if (activeTask && !bookedWorkers.length && activeTask.status === 'pending') {
      activeTask.assignedOfficer = newOfficer._id;
      activeTask.teamLeader = newOfficer.role === 'officer' ? newOfficer._id : activeTask.teamLeader;
      await activeTask.save();
    }
    report.activity.push({
      action: `Case handed over to ${newOfficer.name}`,
      actorRole: req.user.role,
      note: reason.trim()
    });

    await report.save();
    await auditLog(req.user, 'case_handover', 'report', report._id, report.title, `Transferred to ${newOfficer.name}`);

    await Notification.create({
      recipient: newOfficer._id,
      report: report._id,
      type: 'report_status',
      message: `Case "${report.title}" was handed over to you.`
    });

    res.json({ success: true, message: `Case handed over to ${newOfficer.name}.`, report });
  } catch (error) { next(error); }
}

// --- Case Messages (Internal vs Citizen) ---

export async function addCaseMessage(req, res, next) {
  try {
    const report = await loadScopedReport(req, res);
    if (!report) return;

    const { text = '', isInternal = true } = req.body;
    if (!text.trim()) return res.status(400).json({ success: false, message: 'Message text is required.' });

    const message = {
      sender: req.user._id,
      senderName: req.user.name,
      senderRole: req.user.role,
      text: text.trim(),
      isInternal: Boolean(isInternal),
      createdAt: new Date()
    };

    report.messages = report.messages || [];
    report.messages.push(message);
    await report.save();

    emitDepartmentEvent('CASE_MESSAGE_ADDED', {
      caseId: report._id,
      message,
      departmentName: report.departmentName
    }, { department: report.departmentName });

    res.json({ success: true, message: 'Message posted.', messages: report.messages });
  } catch (error) { next(error); }
}

// --- Resources Management Engine ---

export async function listResources(req, res, next) {
  try {
    const departmentName = departmentNameFor(req.user);
    if (!departmentName) return res.status(403).json({ success: false, message: 'Department assignment required.' });

    const resourceQuery = DepartmentResource.find({ departmentName }).sort({ type: 1, name: 1 });
    if (req.user.role === 'field_worker') {
      resourceQuery.select('name type departmentName identifier capacityOrQuantity status');
    } else {
      resourceQuery.populate('assignedTeam', 'name').populate('assignedCase', 'title');
    }
    const resources = await resourceQuery.lean();

    res.json({ success: true, resources });
  } catch (error) { next(error); }
}

export async function createResource(req, res, next) {
  try {
    if (!headRoles.includes(req.user.role)) return res.status(403).json({ success: false, message: 'Only Department Head can create resources.' });
    const departmentName = departmentNameFor(req.user);
    const department = await Department.findOne({ name: departmentName });
    const { name, type, identifier = '', capacityOrQuantity = 1, notes = '' } = req.body;

    if (!name?.trim() || !type) return res.status(400).json({ success: false, message: 'Name and type are required.' });

    const resource = await DepartmentResource.create({
      name: name.trim(),
      type,
      department: department?._id,
      departmentName,
      identifier: identifier.trim(),
      capacityOrQuantity: Number(capacityOrQuantity) || 1,
      notes: notes.trim()
    });

    await auditLog(req.user, 'resource_created', 'department', resource._id, resource.name, 'Department resource catalogued.');
    res.status(201).json({ success: true, resource });
  } catch (error) { next(error); }
}

export async function requestResource(req, res, next) {
  try {
    const departmentName = departmentNameFor(req.user);
    if (!departmentName) return res.status(403).json({ success: false, message: 'Department assignment required.' });
    const resource = await DepartmentResource.findOne({ _id: req.params.id, departmentName });
    if (!resource) return res.status(404).json({ success: false, message: 'Resource not found.' });

    const { caseId, reason = '' } = req.body;
    let scopedCaseId = null;
    if (caseId) {
      if (!mongoose.Types.ObjectId.isValid(caseId)) return res.status(400).json({ success: false, message: 'Select a valid case.' });
      const report = await Report.findOne({ _id: caseId, departmentName }).select('_id');
      if (!report) return res.status(404).json({ success: false, message: 'Case not found in your department.' });
      if (req.user.role === 'field_worker') {
        const workerTeams = await DepartmentTeam.find({ departmentName, members: req.user._id }).distinct('_id');
        const assignedTask = await DepartmentTask.exists({
          report: report._id,
          departmentName,
          $or: [
            { assignedWorker: req.user._id },
            { workerIds: req.user._id },
            { 'workerAssignments.worker': req.user._id },
            { team: { $in: workerTeams } }
          ]
        });
        if (!assignedTask) return res.status(403).json({ success: false, message: 'You can only request resources for your assigned field tasks.' });
      }
      scopedCaseId = report._id;
    }
    resource.requests.push({
      requestedBy: req.user._id,
      requesterRole: req.user.role,
      caseId: scopedCaseId,
      reason: String(reason).trim().slice(0, 500),
      status: 'pending',
      requestedAt: new Date()
    });

    await resource.save();
    emitDepartmentEvent('RESOURCE_REQUESTED', {
      resourceId: resource._id,
      name: resource.name,
      departmentName: resource.departmentName
    }, { department: resource.departmentName });

    if (req.user.role === 'field_worker') {
      const ownRequests = resource.requests.filter((request) => request.requestedBy.equals(req.user._id));
      return res.json({
        success: true,
        message: 'Resource request submitted for approval.',
        resource: {
          _id: resource._id,
          name: resource.name,
          type: resource.type,
          departmentName: resource.departmentName,
          identifier: resource.identifier,
          capacityOrQuantity: resource.capacityOrQuantity,
          status: resource.status,
          requests: ownRequests
        }
      });
    }
    res.json({ success: true, message: 'Resource request submitted for approval.', resource });
  } catch (error) { next(error); }
}

export async function reviewResourceRequest(req, res, next) {
  try {
    if (!headRoles.includes(req.user.role)) return res.status(403).json({ success: false, message: 'Only Department Head can approve resource requests.' });
    const resource = await DepartmentResource.findById(req.params.id);
    if (!resource) return res.status(404).json({ success: false, message: 'Resource not found.' });

    const { requestId, status, reviewNote = '' } = req.body;
    const request = resource.requests.id(requestId);
    if (!request) return res.status(404).json({ success: false, message: 'Request not found.' });

    request.status = status;
    request.reviewedAt = new Date();
    request.reviewedBy = req.user._id;
    request.reviewNote = reviewNote.trim();

    if (status === 'approved') {
      resource.status = 'in_use';
      if (request.caseId) resource.assignedCase = request.caseId;
    }

    await resource.save();
    await auditLog(req.user, `resource_request_${status}`, 'department', resource._id, resource.name, reviewNote.trim());

    emitDepartmentEvent('RESOURCE_APPROVED', {
      resourceId: resource._id,
      status,
      departmentName: resource.departmentName
    }, { department: resource.departmentName });

    res.json({ success: true, message: `Resource request ${status}.`, resource });
  } catch (error) { next(error); }
}
