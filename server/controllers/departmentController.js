import mongoose from 'mongoose';
import Notification from '../models/Notification.js';
import Report from '../models/Report.js';
import User from '../models/User.js';
import { canReviewReportCompletion, canTransitionReport } from '../services/reportLifecycle.js';
import { reportCategories, reportPriorities, reportStatuses } from '../config/reportOptions.js';

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
  const report = await Report.findById(req.params.id)
    .populate('createdBy', 'name email')
    .populate('assignedOfficer', 'name email role departmentName')
    .populate('assignedFieldWorker', 'name email role departmentName')
    .populate('completionReport.submittedBy', 'name email role');
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
    const [statusRows, priorityRows, recent, unreadCount] = await Promise.all([
      Report.aggregate([{ $match: filter }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
      Report.aggregate([{ $match: filter }, { $group: { _id: '$priority', count: { $sum: 1 } } }]),
      Report.find(filter).populate('createdBy', 'name email').populate('assignedOfficer', 'name email').sort({ priority: -1, updatedAt: -1 }).limit(8).lean(),
      Notification.countDocuments({ recipient: req.user._id, readAt: null })
    ]);
    const byStatus = Object.fromEntries(statusRows.map((row) => [row._id, row.count]));
    const byPriority = Object.fromEntries(priorityRows.map((row) => [row._id, row.count]));
    res.json({ success: true, stats: {
      total: statusRows.reduce((sum, row) => sum + row.count, 0),
      pending: byStatus.pending || 0,
      verified: byStatus.verified || 0,
      assigned: byStatus.assigned || 0,
      inProgress: byStatus.in_progress || 0,
      completed: byStatus.completed || 0,
      closed: byStatus.closed || 0,
      critical: byPriority.urgent || 0,
      unreadNotifications: unreadCount
    }, recent });
  } catch (error) { next(error); }
}

export async function listReports(req, res, next) {
  try {
    const filter = scopedFilter(req);
    if (!filter) return res.status(403).json({ success: false, message: 'Department assignment is required.' });
    const { search = '', status = '', priority = '', category = '', officer = '', fieldWorker = '', page = 1, limit = 10, sort = 'updated' } = req.query;
    if (reportStatuses.includes(status)) filter.status = status;
    if (reportPriorities.includes(priority)) filter.priority = priority;
    if (reportCategories.includes(category)) filter.category = category;
    if (mongoose.Types.ObjectId.isValid(officer)) filter.assignedOfficer = officer;
    if (mongoose.Types.ObjectId.isValid(fieldWorker)) filter.assignedFieldWorker = fieldWorker;
    if (search.trim()) {
      const expression = new RegExp(escapeRegex(search), 'i');
      filter.$and = [{ $or: [{ title: expression }, { description: expression }, { category: expression }] }];
    }
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(50, Math.max(1, Number(limit) || 10));
    const order = sort === 'oldest' ? { createdAt: 1 } : sort === 'priority' ? { priority: -1, updatedAt: -1 } : { updatedAt: -1 };
    const [reports, total] = await Promise.all([
      Report.find(filter).populate('createdBy', 'name email').populate('assignedOfficer', 'name email').populate('assignedFieldWorker', 'name email').sort(order).skip((safePage - 1) * safeLimit).limit(safeLimit).lean(),
      Report.countDocuments(filter)
    ]);
    res.json({ success: true, reports, pagination: { page: safePage, limit: safeLimit, total, pages: Math.ceil(total / safeLimit) } });
  } catch (error) { next(error); }
}

export async function getReport(req, res, next) {
  try {
    const report = await loadScopedReport(req, res);
    if (report) res.json({ success: true, report });
  } catch (error) { next(error); }
}

export async function listStaff(req, res, next) {
  try {
    if (!managementRoles.includes(req.user.role)) return res.status(403).json({ success: false, message: 'Only department management can view the department staff directory.' });
    const departmentName = departmentNameFor(req.user);
    if (!departmentName) return res.status(403).json({ success: false, message: 'Department assignment is required.' });
    const staff = await User.find({ departmentName, role: { $in: ['department_officer', 'officer', 'field_worker'] }, status: 'active' }).select('name email role departmentName').lean();
    const workloads = await Report.aggregate([{ $match: { departmentName, status: { $in: ['assigned', 'in_progress'] } } }, { $facet: {
      officers: [{ $match: { assignedOfficer: { $ne: null } } }, { $group: { _id: '$assignedOfficer', count: { $sum: 1 } } }],
      workers: [{ $match: { assignedFieldWorker: { $ne: null } } }, { $group: { _id: '$assignedFieldWorker', count: { $sum: 1 } } }]
    } }]);
    const counts = new Map([...(workloads[0]?.officers || []), ...(workloads[0]?.workers || [])].map((row) => [String(row._id), row.count]));
    res.json({ success: true, staff: staff.map((person) => ({ ...person, id: person._id, workload: counts.get(String(person._id)) || 0, availability: 'available' })) });
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
    const { officerId, fieldWorkerId } = req.body;
    const report = await loadScopedReport(req, res);
    if (!report) return;
    const departmentName = departmentNameFor(req.user);
    const [officer, worker] = await Promise.all([
      officerId ? User.findOne({ _id: officerId, role: { $in: ['department_officer', 'officer'] }, departmentName, status: 'active' }) : null,
      fieldWorkerId ? User.findOne({ _id: fieldWorkerId, role: { $in: ['field_worker', 'officer'] }, departmentName, status: 'active' }) : null
    ]);
    if (officerId && !officer) return res.status(400).json({ success: false, message: 'Selected officer is not in this department.' });
    if (fieldWorkerId && !worker) return res.status(400).json({ success: false, message: 'Selected field worker is not in this department.' });
    if (officer) report.assignedOfficer = officer._id;
    if (worker) report.assignedFieldWorker = worker._id;
    if (['pending', 'verified'].includes(report.status)) report.status = 'assigned';
    report.activity.push({ action: 'Assignment updated', actorRole: req.user.role, note: [officer && `Officer: ${officer.name}`, worker && `Field worker: ${worker.name}`].filter(Boolean).join(', ') });
    await report.save();
    await Promise.all([officer, worker].filter(Boolean).map((person) => Notification.create({ recipient: person._id, report: report._id, type: 'report_status', message: `You were assigned to "${report.title}".` })));
    await report.populate('assignedOfficer', 'name email role departmentName');
    await report.populate('assignedFieldWorker', 'name email role departmentName');
    res.json({ success: true, message: 'Assignment updated.', report });
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
    await Notification.create({ recipient: report.createdBy._id || report.createdBy, report: report._id, message: `Your report "${report.title}" is now ${label(report.status)}.` });
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
