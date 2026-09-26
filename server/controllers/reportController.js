import fs from 'node:fs/promises';
import path from 'node:path';
import mongoose from 'mongoose';
import Report from '../models/Report.js';
import Notification from '../models/Notification.js';
import Department from '../models/Department.js';
import { reportUploadDir } from '../middleware/uploadMiddleware.js';
import { reportCategories, reportDepartments, reportPriorities, reportStatuses } from '../config/reportOptions.js';
import { canCitizenReopenReport, canCitizenResolveReport, canTransitionReport } from '../services/reportLifecycle.js';
import ActivityLog from '../models/ActivityLog.js';
import { normalizeReportLocation } from '../services/reportLocation.js';

const editableStatuses = ['pending', 'verified'];
const fields = ['title', 'description', 'category', 'priority', 'departmentName', 'additionalInfo'];
const statuses = reportStatuses;

async function ownedReport(id, userId) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return Report.findOne({ _id: id, createdBy: userId });
}

function sameId(value, userId) {
  const id = value?._id || value;
  return Boolean(id && String(id) === String(userId));
}

function canViewReport(user, report) {
  if (user.role === 'admin') return true;
  if (user.role === 'citizen') return sameId(report.createdBy, user._id);
  const staffRoles = ['department_head', 'department_officer', 'officer', 'field_worker'];
  if (!staffRoles.includes(user.role) || report.departmentName !== (user.departmentName || user.department?.name)) return false;
  if (['department_head', 'department_officer'].includes(user.role)) return true;
  return sameId(report.assignedOfficer, user._id) || sameId(report.assignedFieldWorker, user._id);
}

function sendReportAttachment(report, filename, res) {
  const safeFilename = path.basename(String(filename || ''));
  const attachment = report.attachments.find((item) => item.filename === safeFilename);
  if (!attachment) return res.status(404).json({ success: false, message: 'Report media not found.' });
  return res.sendFile(path.join(reportUploadDir, safeFilename), (error) => {
    if (error && !res.headersSent) res.status(404).json({ success: false, message: 'Report media is unavailable.' });
  });
}

export async function getReportAttachment(req, res, next) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).json({ success: false, message: 'Report not found.' });
    const report = await Report.findById(req.params.id);
    if (!report || !canViewReport(req.user, report)) return res.status(404).json({ success: false, message: 'Report not found.' });
    return sendReportAttachment(report, req.params.filename, res);
  } catch (error) { next(error); }
}

export async function getLegacyReportAttachment(req, res, next) {
  try {
    const filename = path.basename(String(req.params.filename || ''));
    const report = await Report.findOne({ 'attachments.filename': filename });
    if (!report || !canViewReport(req.user, report)) return res.status(404).json({ success: false, message: 'Report not found.' });
    return sendReportAttachment(report, filename, res);
  } catch (error) { next(error); }
}

function uploadedAttachments(files = []) {
  return files.map((file) => ({
    url: `/uploads/reports/${file.filename}`,
    filename: file.filename,
    originalName: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
    mediaType: file.mimetype.startsWith('video/') ? 'video' : 'image'
  }));
}

async function removeFiles(files = []) {
  await Promise.all(files.map(async (file) => {
    const filename = typeof file === 'string' ? file : file.filename;
    if (!filename) return;
    await fs.unlink(path.join(reportUploadDir, path.basename(filename))).catch(() => {});
  }));
}

export async function createReport(req, res, next) {
  try {
    const { title, description, category, priority, departmentName, additionalInfo = '' } = req.body;
    if (!title?.trim() || !description?.trim() || !category || !priority || !departmentName?.trim()) {
      await removeFiles(req.files);
      return res.status(400).json({ success: false, message: 'Title, description, category, priority, and department name are required.' });
    }
    if (!reportCategories.includes(category) || !reportDepartments.includes(departmentName.trim()) || !reportPriorities.includes(priority)) {
      await removeFiles(req.files);
      return res.status(400).json({ success: false, message: 'Category, department, or priority is invalid.' });
    }
    const locationResult = normalizeReportLocation(req.body.location);
    if (locationResult.error) { await removeFiles(req.files); return res.status(400).json({ success: false, message: locationResult.error }); }
    const report = await Report.create({
      title: title.trim(),
      description: description.trim(),
      category,
      priority,
      departmentName: departmentName.trim(),
      location: locationResult.value,
      additionalInfo: String(additionalInfo).trim(),
      attachments: uploadedAttachments(req.files),
      createdBy: req.user._id,
      activity: [{ action: 'Citizen submitted this report', actorRole: 'citizen' }]
    });
    return res.status(201).json({ success: true, message: 'Report submitted successfully.', report });
  } catch (error) {
    await removeFiles(req.files);
    next(error);
  }
}

export async function listMyReports(req, res, next) {
  try {
    const { search = '', status = '', category = '', department = '', priority = '', page = 1, limit = 10, sort = 'newest' } = req.query;
    const filter = { createdBy: req.user._id };
    if (statuses.includes(status)) filter.status = status;
    if (reportCategories.includes(category)) filter.category = category;
    if (reportDepartments.includes(department)) filter.departmentName = department;
    if (reportPriorities.includes(priority)) filter.priority = priority;
    if (search.trim()) { const expression = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'); filter.$or = [{ title: expression }, { description: expression }]; }
    const safePage = Math.max(1, Number(page) || 1); const safeLimit = Math.min(50, Math.max(1, Number(limit) || 10));
    const order = sort === 'oldest' ? { createdAt: 1 } : sort === 'updated' ? { updatedAt: -1 } : { createdAt: -1 };
    const [reports, total] = await Promise.all([Report.find(filter).sort(order).skip((safePage - 1) * safeLimit).limit(safeLimit).lean(), Report.countDocuments(filter)]);
    return res.json({ success: true, reports, pagination: { page: safePage, limit: safeLimit, total, pages: Math.ceil(total / safeLimit) } });
  } catch (error) { next(error); }
}

export async function reportStats(req, res, next) {
  try {
    const rows = await Report.aggregate([{ $match: { createdBy: req.user._id } }, { $group: { _id: '$status', count: { $sum: 1 } } }]);
    const byStatus = Object.fromEntries(rows.map((row) => [row._id, row.count]));
    const pending = byStatus.pending || 0;
    const verified = byStatus.verified || 0;
    const inProgress = (byStatus.assigned || 0) + (byStatus.in_progress || 0);
    const underReview = byStatus.under_review || 0;
    const completed = byStatus.completed || 0;
    const closed = byStatus.closed || 0;
    return res.json({
      success: true,
      stats: {
        total: rows.reduce((sum, row) => sum + row.count, 0), pending, verified, inProgress, underReview, completed, closed,
        active: pending + verified + inProgress + underReview,
        resolved: completed + closed
      }
    });
  } catch (error) { next(error); }
}

export async function getReport(req, res, next) {
  try {
    const report = await ownedReport(req.params.id, req.user._id);
    if (!report) return res.status(404).json({ success: false, message: 'Report not found.' });
    return res.json({ success: true, report });
  } catch (error) { next(error); }
}

export async function updateReport(req, res, next) {
  try {
    const report = await ownedReport(req.params.id, req.user._id);
    if (!report) {
      await removeFiles(req.files);
      return res.status(404).json({ success: false, message: 'Report not found.' });
    }
    if (!editableStatuses.includes(report.status)) {
      await removeFiles(req.files);
      return res.status(403).json({ success: false, message: 'This report can no longer be edited.' });
    }
    if (req.body.title !== undefined && (typeof req.body.title !== 'string' || req.body.title.trim().length < 3)) { await removeFiles(req.files); return res.status(400).json({ success: false, message: 'Title must be at least 3 characters.' }); }
    if (req.body.description !== undefined && (typeof req.body.description !== 'string' || req.body.description.trim().length < 10)) { await removeFiles(req.files); return res.status(400).json({ success: false, message: 'Description must be at least 10 characters.' }); }
    if (req.body.additionalInfo !== undefined && String(req.body.additionalInfo).trim().length > 1000) { await removeFiles(req.files); return res.status(400).json({ success: false, message: 'Additional information must be 1,000 characters or fewer.' }); }
    if (req.body.category && !reportCategories.includes(req.body.category) || req.body.priority && !reportPriorities.includes(req.body.priority) || req.body.departmentName && !reportDepartments.includes(req.body.departmentName.trim())) { await removeFiles(req.files); return res.status(400).json({ success: false, message: 'Category, department, or priority is invalid.' }); }
    for (const field of fields) if (req.body[field] !== undefined) report[field] = typeof req.body[field] === 'string' ? req.body[field].trim() : req.body[field];
    if (req.body.location !== undefined) {
      const locationResult = normalizeReportLocation(req.body.location);
      if (locationResult.error) { await removeFiles(req.files); return res.status(400).json({ success: false, message: locationResult.error }); }
      report.location = locationResult.value;
    }
    report.attachments.push(...uploadedAttachments(req.files));
    report.activity.push({ action: 'Citizen updated this report', actorRole: 'citizen' });
    await report.save();
    return res.json({ success: true, message: 'Report updated successfully.', report });
  } catch (error) {
    await removeFiles(req.files);
    next(error);
  }
}

export async function deleteReport(req, res, next) {
  try {
    const report = await ownedReport(req.params.id, req.user._id);
    if (!report) return res.status(404).json({ success: false, message: 'Report not found.' });
    if (!editableStatuses.includes(report.status)) return res.status(403).json({ success: false, message: 'This report can no longer be deleted.' });
    await report.deleteOne();
    await removeFiles(report.attachments);
    return res.json({ success: true, message: 'Report deleted successfully.' });
  } catch (error) { next(error); }
}

export async function listAllReports(req, res, next) {
  try {
    const { search = '', status = '' } = req.query;
    const filter = {};
    if (statuses.includes(status)) filter.status = status;
    if (search.trim()) {
      const expression = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ title: expression }, { description: expression }, { departmentName: expression }];
    }
    const reports = await Report.find(filter).populate('createdBy', 'name email').sort({ createdAt: -1 }).limit(200);
    return res.json({ success: true, reports });
  } catch (error) { next(error); }
}

export async function listDepartments(req, res, next) {
  try {
    const departments = await Department.find({ status: 'active' }).sort({ name: 1 }).lean();
    return res.json({ success: true, departments });
  } catch (error) { next(error); }
}

export async function verifyReportResolution(req, res, next) {
  try {
    const report = await ownedReport(req.params.id, req.user._id);
    if (!report) return res.status(404).json({ success: false, message: 'Report not found.' });
    if (!canCitizenResolveReport(report.status)) return res.status(409).json({ success: false, message: 'Resolution verification is available after the department marks a report completed.' });
    const action = String(req.body.action || '').trim();
    if (!['confirm', 'reopen'].includes(action)) return res.status(400).json({ success: false, message: 'Action must be confirm or reopen.' });
    const note = String(req.body.note || '').trim().slice(0, 500);
    if (action === 'reopen' && note.length < 3) return res.status(400).json({ success: false, message: 'Tell the department why this needs reopening.' });
    if (action === 'reopen' && !canCitizenReopenReport(report.status)) return res.status(409).json({ success: false, message: 'This report can no longer be reopened through citizen verification.' });
    if (action === 'confirm') {
      report.citizenResolution = { status: 'confirmed', note, requestedAt: new Date(), resolvedAt: report.citizenResolution?.resolvedAt || new Date() };
      report.activity.push({ action: 'Citizen confirmed the resolution', actorRole: 'citizen', note });
    } else {
      report.status = 'in_progress';
      report.citizenResolution = { status: 'reopen_requested', note, requestedAt: new Date(), resolvedAt: null };
      report.activity.push({ action: 'Citizen requested report reopening', actorRole: 'citizen', note });
    }
    await report.save();
    await ActivityLog.create({ admin: req.user._id, actorRole: 'citizen', action: action === 'confirm' ? 'report_resolution_confirmed' : 'report_reopen_requested', targetType: 'report', targetId: report._id, targetName: report.title, description: note, metadata: { status: report.status }, result: 'success' });
    const recipients = [report.assignedOfficer, report.assignedFieldWorker].filter(Boolean);
    await Promise.all(recipients.map((recipient) => Notification.create({ recipient, report: report._id, type: 'report_status', message: action === 'confirm' ? `Citizen confirmed resolution of “${report.title}”.` : `Citizen requested reopening of “${report.title}”.` })));
    return res.json({ success: true, message: action === 'confirm' ? 'Resolution confirmed.' : 'Reopening request sent to the responsible department.', report });
  } catch (error) { next(error); }
}

export async function submitReportFeedback(req, res, next) {
  try {
    const report = await ownedReport(req.params.id, req.user._id);
    if (!report) return res.status(404).json({ success: false, message: 'Report not found.' });
    if (!canCitizenResolveReport(report.status) || report.citizenResolution?.status !== 'confirmed') return res.status(409).json({ success: false, message: 'Confirm the resolution before submitting feedback.' });
    if (report.citizenFeedback?.submittedAt) return res.status(409).json({ success: false, message: 'Feedback has already been submitted for this report.' });
    const rating = Number(req.body.rating);
    const comment = String(req.body.comment || '').trim().slice(0, 1000);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return res.status(400).json({ success: false, message: 'Rating must be a whole number from 1 to 5.' });
    if (comment.length < 3) return res.status(400).json({ success: false, message: 'Please include a short feedback comment.' });
    report.citizenFeedback = { rating, comment, submittedAt: new Date() };
    report.activity.push({ action: 'Citizen submitted resolution feedback', actorRole: 'citizen', note: `${rating}/5 — ${comment.slice(0, 160)}` });
    await report.save();
    await ActivityLog.create({ admin: req.user._id, actorRole: 'citizen', action: 'report_feedback_submitted', targetType: 'report', targetId: report._id, targetName: report.title, description: `${rating}/5 feedback submitted.`, metadata: { rating }, result: 'success' });
    return res.status(201).json({ success: true, message: 'Thank you for your feedback.', report });
  } catch (error) { next(error); }
}

export async function updateReportStatus(req, res, next) {
  try {
    const { status } = req.body;
    if (!statuses.includes(status)) return res.status(400).json({ success: false, message: 'Invalid report status.' });
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).json({ success: false, message: 'Report not found.' });
    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ success: false, message: 'Report not found.' });
    const previous = report.status;
    if (status !== previous && !canTransitionReport(previous, status)) return res.status(409).json({ success: false, message: `Invalid report status transition from ${previous}.` });
    report.status = status;
    report.activity.push({ action: `Report status changed from ${previous.replace('_', ' ')} to ${status.replace('_', ' ')}`, actorRole: req.user.role });
    await report.save();
    await Notification.create({ recipient: report.createdBy, report: report._id, message: `Your report “${report.title}” is now ${status.replace('_', ' ')}.` });
    await report.populate('createdBy', 'name email');
    return res.json({ success: true, message: 'Report status updated.', report });
  } catch (error) { next(error); }
}
