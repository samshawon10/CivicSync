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
import { emitDepartmentEvent } from '../realtime/emergencyRealtime.js';

import { canReviewReportCompletion, canTransitionReport } from '../services/reportLifecycle.js';
import { reportCategories, reportPriorities, reportStatuses } from '../config/reportOptions.js';
import { getReportNextAction } from '../services/nextAction.js';

const headRoles = ['department_head'];
const managementRoles = ['department_head', 'department_officer'];
const departmentRoles = ['department_head', 'department_officer', 'officer', 'field_worker'];
const completionStatuses = ['submitted', 'approved', 'rejected'];

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
    .populate('assignedFieldWorker', 'name role phone')
    .populate('assignedTeam', 'name status serviceArea phone members')
    .populate('teamLeader', 'name role phone')
    .populate('activeTask')
    .populate('completionReport.submittedBy', 'name role');
  if (managementRoles.includes(req.user.role)) reportQuery.populate('createdBy', 'name');
  else reportQuery.select('-createdBy');
  const report = await reportQuery;
  if (!report || !canAccessReport(req.user, report)) {
    res.status(404).json({ success: false, message: 'Report not found.' });
    return null;
  }
  return report;
}

function scopedFilter(req) {
  const departmentName = departmentNameFor(req.user);
  if (!departmentName) return null;
  const filter = { departmentName };
  if (['officer', 'field_worker'].includes(req.user.role)) filter.$or = [{ assignedOfficer: req.user._id }, { assignedFieldWorker: req.user._id }];
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
    if (reportCategories.includes(category)) filter.category = category;
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
    res.json({
      success: true,
      reports: reports.map((report) => ({
        ...report.toObject(),
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
      res.json({
        success: true,
        report: {
          ...reportObj,
          nextAction: getReportNextAction(report),
          sla: calculateDepartmentSla(report)
        }
      });
    }
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
    if (!managementRoles.includes(req.user.role)) return res.status(403).json({ success: false, message: 'Only department heads and department officers can assign reports.' });
    const { officerId, fieldWorkerId, teamId } = req.body;
    if (officerId === undefined && fieldWorkerId === undefined && teamId === undefined) return res.status(400).json({ success: false, message: 'Select an officer, field worker, or team assignment to update.' });
    if ([officerId, fieldWorkerId, teamId].some((id) => id && !mongoose.Types.ObjectId.isValid(id))) return res.status(400).json({ success: false, message: 'Select valid department staff or team.' });
    const report = await loadScopedReport(req, res);
    if (!report) return;
    const departmentName = departmentNameFor(req.user);
    const [officer, worker, team] = await Promise.all([
      officerId ? User.findOne({ _id: officerId, role: { $in: ['department_officer', 'officer'] }, departmentName, status: 'active' }) : null,
      fieldWorkerId ? User.findOne({ _id: fieldWorkerId, role: { $in: ['field_worker', 'officer'] }, departmentName, status: 'active' }) : null,
      teamId ? DepartmentTeam.findOne({ _id: teamId, departmentName, active: true }).populate('leader', 'name role').populate('members', 'name role') : null
    ]);
    if (officerId && !officer) return res.status(400).json({ success: false, message: 'Selected officer is not in this department.' });
    if (fieldWorkerId && !worker) return res.status(400).json({ success: false, message: 'Selected field worker is not in this department.' });
    if (teamId && !team) return res.status(400).json({ success: false, message: 'Selected team is not active in this department.' });

    if (officerId !== undefined) report.assignedOfficer = officer?._id || null;
    if (fieldWorkerId !== undefined) report.assignedFieldWorker = worker?._id || null;
    if (teamId !== undefined) {
      report.assignedTeam = team?._id || null;
      report.teamLeader = team?.leader?._id || null;
      if (team) {
        team.status = 'busy';
        await team.save();
      }
    }

    if ((officer || worker || team) && ['pending', 'verified'].includes(report.status)) {
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

    // Create or link a field task if worker or team assigned
    const targetWorker = worker || (team?.members?.[0]);
    if (targetWorker && !report.activeTask) {
      const task = await DepartmentTask.create({
        report: report._id,
        taskNumber: `TK-${Date.now().toString().slice(-4)}`,
        title: report.title,
        description: report.description,
        departmentName,
        team: team?._id || null,
        teamLeader: team?.leader?._id || null,
        assignedWorker: targetWorker._id,
        assignedBy: req.user._id,
        status: 'assigned',
        priority: report.priority,
        targetDueAt: report.dueAt || report.sla?.resolutionDueAt,
        location: {
          address: report.location?.address || report.location?.area || '',
          latitude: report.location?.latitude || null,
          longitude: report.location?.longitude || null
        },
        timeline: [{ status: 'assigned', actor: req.user._id, actorRole: req.user.role, note: 'Task created and dispatched.' }]
      });
      report.activeTask = task._id;
    }

    const changes = [];
    if (officerId !== undefined) changes.push(`Officer: ${officer?.name || 'Unassigned'}`);
    if (fieldWorkerId !== undefined) changes.push(`Field worker: ${worker?.name || 'Unassigned'}`);
    if (teamId !== undefined) changes.push(`Team: ${team?.name || 'Unassigned'}`);

    report.activity.push({ action: 'Assignment updated', actorRole: req.user.role, note: changes.join(', ') });
    await report.save();

    await auditLog(req.user, 'case_assigned', 'report', report._id, report.title, changes.join(', '));

    const notificationRecipients = [officer?._id, worker?._id, team?.leader?._id].filter(Boolean);
    await Promise.all(notificationRecipients.map((recipient) => Notification.create({ recipient, report: report._id, type: 'report_status', message: `You/your team were assigned to "${report.title}".` })));

    emitDepartmentEvent('CASE_ASSIGNED', {
      caseId: report._id,
      title: report.title,
      departmentName,
      status: report.status,
      assignedOfficer: officer?._id,
      assignedWorker: worker?._id,
      assignedTeam: team?._id
    }, { department: departmentName });

    await report.populate('assignedOfficer', 'name role phone');
    await report.populate('assignedFieldWorker', 'name role phone');
    await report.populate('assignedTeam', 'name status serviceArea phone');
    await report.populate('teamLeader', 'name role phone');
    await report.populate('activeTask');

    res.json({ success: true, message: 'Assignment updated.', report });
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
    const citizenId = report.createdBy?._id || report.createdBy || (await Report.findById(report._id).select('createdBy').lean())?.createdBy;
    if (citizenId) await Notification.create({ recipient: citizenId, report: report._id, message: `Your report "${report.title}" is now ${label(report.status)}.` });
    res.json({ success: true, message: 'Status updated.', report });
  } catch (error) { next(error); }
}

export async function submitCompletion(req, res, next) {
  try {
    const report = await loadScopedReport(req, res);
    if (!report) return;
    if (!departmentRoles.includes(req.user.role)) return res.status(403).json({ success: false, message: 'You cannot submit completion reports.' });
    const { summary = '', materials = '', notes = '', beforeImages = [], afterImages = [] } = req.body;
    if (summary.trim().length < 10) return res.status(400).json({ success: false, message: 'Work summary must be at least 10 characters.' });
    if (!canTransitionReport(report.status, 'completed')) return res.status(409).json({ success: false, message: `A completion report can only be submitted from under review; current status is ${label(report.status)}.` });
    report.completionReport = { summary: summary.trim(), materials: String(materials).trim(), notes: String(notes).trim(), beforeImages, afterImages, submittedBy: req.user._id, submittedAt: new Date(), verificationStatus: 'submitted' };
    report.status = 'completed';
    report.activity.push({ action: 'Completion report submitted', actorRole: req.user.role, note: summary.trim().slice(0, 160) });
    await report.save();
    res.json({ success: true, message: 'Completion report submitted.', report });
  } catch (error) { next(error); }
}

export async function reviewCompletion(req, res, next) {
  try {
    if (!headRoles.includes(req.user.role)) return res.status(403).json({ success: false, message: 'Only department heads can review completion.' });
    if (!completionStatuses.includes(req.body.verificationStatus)) return res.status(400).json({ success: false, message: 'Invalid verification status.' });
    const report = await loadScopedReport(req, res);
    if (!report) return;
    if (!canReviewReportCompletion(report.status, report.completionReport.verificationStatus, req.body.verificationStatus)) return res.status(409).json({ success: false, message: 'Completion review is only available for a submitted completion report.' });
    report.completionReport.verificationStatus = req.body.verificationStatus;
    if (req.body.verificationStatus === 'approved') report.status = 'closed';
    if (req.body.verificationStatus === 'rejected') report.status = 'in_progress';
    report.activity.push({ action: `Completion ${req.body.verificationStatus}`, actorRole: req.user.role, note: req.body.note || '' });
    await report.save();
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
    if (!headRoles.includes(req.user.role)) return res.status(403).json({ success: false, message: 'Only Department Head can create teams.' });
    const departmentName = departmentNameFor(req.user);
    const department = await Department.findOne({ name: departmentName });
    const { name, leaderId, memberIds = [], skills = [], serviceArea = '', capacity = 5, phone = '', notes = '' } = req.body;
    if (!name?.trim()) return res.status(400).json({ success: false, message: 'Team name is required.' });

    const team = await DepartmentTeam.create({
      name: name.trim(),
      department: department?._id,
      departmentName,
      leader: leaderId || null,
      members: memberIds,
      skills: Array.isArray(skills) ? skills : [],
      serviceArea: serviceArea.trim(),
      capacity: Number(capacity) || 5,
      phone: phone.trim(),
      notes: notes.trim()
    });

    await auditLog(req.user, 'team_created', 'department', team._id, team.name, 'Department response team created.');
    emitDepartmentEvent('TEAM_ASSIGNMENT_CREATED', { teamId: team._id, name: team.name, departmentName }, { department: departmentName });

    res.status(201).json({ success: true, team });
  } catch (error) { next(error); }
}

export async function updateTeam(req, res, next) {
  try {
    if (!headRoles.includes(req.user.role)) return res.status(403).json({ success: false, message: 'Only Department Head can modify teams.' });
    const team = await DepartmentTeam.findById(req.params.id);
    if (!team) return res.status(404).json({ success: false, message: 'Team not found.' });

    const allowed = ['name', 'leader', 'members', 'skills', 'serviceArea', 'capacity', 'status', 'phone', 'notes', 'active'];
    for (const key of allowed) {
      if (req.body[key] !== undefined) team[key] = req.body[key];
    }
    await team.save();
    await auditLog(req.user, 'team_updated', 'department', team._id, team.name, 'Department team modified.');

    res.json({ success: true, team });
  } catch (error) { next(error); }
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
      { $match: { team: { $in: teams.map((t) => t._id) }, status: { $in: ['assigned', 'accepted', 'traveling', 'arrived', 'in_progress', 'blocked'] } } },
      { $group: { _id: '$team', count: { $sum: 1 } } }
    ]);
    const taskCountMap = Object.fromEntries(activeTasks.map((t) => [String(t._id), t.count]));

    const scored = teams.map((team) => {
      let score = 50;
      const reasons = [];

      // Availability check
      if (team.status === 'available') {
        score += 30;
        reasons.push('Team status is Available');
      } else if (team.status === 'busy') {
        score -= 20;
        reasons.push('Team is currently busy with ongoing tasks');
      } else {
        score -= 40;
        reasons.push(`Team status is ${team.status}`);
      }

      // Workload check
      const currentTasks = taskCountMap[String(team._id)] || 0;
      const capacity = team.capacity || 5;
      if (currentTasks === 0) {
        score += 20;
        reasons.push('Low workload (0 active tasks)');
      } else if (currentTasks < capacity) {
        score += 10;
        reasons.push(`Available capacity (${currentTasks}/${capacity} tasks)`);
      } else {
        score -= 30;
        reasons.push(`At or above capacity (${currentTasks}/${capacity})`);
      }

      // Category / Skill match
      const reportCategory = (report.category || '').toLowerCase();
      const hasSkill = (team.skills || []).some((s) => reportCategory.includes(s.toLowerCase()) || s.toLowerCase().includes(reportCategory));
      if (hasSkill) {
        score += 25;
        reasons.push('Matches required category skills');
      }

      return {
        ...team,
        score: Math.max(0, Math.min(100, score)),
        reasons,
        currentWorkload: currentTasks
      };
    });

    scored.sort((a, b) => b.score - a.score);
    res.json({ success: true, recommendations: scored });
  } catch (error) { next(error); }
}
// --- Tasks Management (Field Worker & Officer Execution) ---

export async function listTasks(req, res, next) {
  try {
    const departmentName = departmentNameFor(req.user);
    if (!departmentName) return res.status(403).json({ success: false, message: 'Department assignment required.' });

    const filter = { departmentName };
    if (req.user.role === 'field_worker') {
      filter.assignedWorker = req.user._id;
    } else if (req.query.workerId) {
      filter.assignedWorker = req.query.workerId;
    }
    if (req.query.status) {
      filter.status = req.query.status;
    }

    const tasks = await DepartmentTask.find(filter)
      .populate('report', 'title category priority location dueAt status sla')
      .populate('team', 'name serviceArea')
      .populate('assignedWorker', 'name phone')
      .populate('teamLeader', 'name phone')
      .sort({ updatedAt: -1 })
      .lean();

    res.json({ success: true, tasks });
  } catch (error) { next(error); }
}

export async function getTask(req, res, next) {
  try {
    const task = await DepartmentTask.findById(req.params.id)
      .populate('report')
      .populate('team')
      .populate('assignedWorker', 'name phone')
      .populate('teamLeader', 'name phone')
      .populate('timeline.actor', 'name role');

    if (!task) return res.status(404).json({ success: false, message: 'Task not found.' });
    res.json({ success: true, task });
  } catch (error) { next(error); }
}

export async function updateTaskStatus(req, res, next) {
  try {
    const { status, note = '', reason = '', description = '', resourceNeeded = '', latitude, longitude } = req.body;
    const task = await DepartmentTask.findById(req.params.id);
    if (!task) return res.status(404).json({ success: false, message: 'Task not found.' });

    const isWorker = task.assignedWorker?.equals?.(req.user._id);
    if (!isWorker && !managementRoles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'You are not authorized to update this task.' });
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

    if (!validTransitions[task.status]?.includes(status) && !managementRoles.includes(req.user.role)) {
      return res.status(409).json({ success: false, message: `Cannot transition task from ${task.status} to ${status}.` });
    }

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
      location: {
        latitude: Number(latitude) || null,
        longitude: Number(longitude) || null
      }
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
    const { summary = '', result = '', materialsUsed = '', remainingIssues = '', evidenceUrls = [] } = req.body;
    const task = await DepartmentTask.findById(req.params.id);
    if (!task) return res.status(404).json({ success: false, message: 'Task not found.' });

    const isWorker = task.assignedWorker?.equals?.(req.user._id);
    if (!isWorker && !managementRoles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Not authorized to complete this task.' });
    }

    if (task.status === 'completed') {
      return res.json({ success: true, message: 'Task already completed.', task });
    }

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

    const report = await Report.findById(task.report);
    if (report) {
      report.status = 'under_review';
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
      await report.save();

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
    report.handoverHistory = report.handoverHistory || [];
    report.handoverHistory.push({
      previousOfficer: prevOfficerId,
      newOfficer: newOfficer._id,
      reason: reason.trim(),
      notes: notes.trim(),
      transferredAt: new Date()
    });

    report.assignedOfficer = newOfficer._id;
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

    const resources = await DepartmentResource.find({ departmentName })
      .populate('assignedTeam', 'name')
      .populate('assignedCase', 'title')
      .sort({ type: 1, name: 1 })
      .lean();

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
    const resource = await DepartmentResource.findById(req.params.id);
    if (!resource) return res.status(404).json({ success: false, message: 'Resource not found.' });

    const { caseId, reason = '' } = req.body;
    resource.requests.push({
      requestedBy: req.user._id,
      requesterRole: req.user.role,
      caseId: caseId || null,
      reason: reason.trim(),
      status: 'pending',
      requestedAt: new Date()
    });

    await resource.save();
    emitDepartmentEvent('RESOURCE_REQUESTED', {
      resourceId: resource._id,
      name: resource.name,
      departmentName: resource.departmentName
    }, { department: resource.departmentName });

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




