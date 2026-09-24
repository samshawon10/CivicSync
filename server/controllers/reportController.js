import fs from 'node:fs/promises';
import path from 'node:path';
import mongoose from 'mongoose';
import Report from '../models/Report.js';
import Notification from '../models/Notification.js';
import Department from '../models/Department.js';
import { reportUploadDir } from '../middleware/uploadMiddleware.js';
import { reportCategories, reportDepartments, reportPriorities, reportStatuses } from '../config/reportOptions.js';

const editableStatuses = ['pending', 'verified'];
const fields = ['title', 'description', 'category', 'priority', 'departmentName'];
const statuses = reportStatuses;

async function ownedReport(id, userId) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return Report.findOne({ _id: id, createdBy: userId });
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
    let location = {};
    try { location = req.body.location ? JSON.parse(req.body.location) : {}; } catch { await removeFiles(req.files); return res.status(400).json({ success: false, message: 'Location must be valid.' }); }
    if ([location.latitude, location.longitude].some((value) => value !== undefined && value !== '' && !Number.isFinite(Number(value)))) { await removeFiles(req.files); return res.status(400).json({ success: false, message: 'Location coordinates are invalid.' }); }
    const report = await Report.create({
      title: title.trim(),
      description: description.trim(),
      category,
      priority,
      departmentName: departmentName.trim(),
      location: { area: String(location.area || '').trim(), address: String(location.address || '').trim(), landmark: String(location.landmark || '').trim(), ...(location.latitude !== undefined && location.latitude !== '' ? { latitude: Number(location.latitude) } : {}), ...(location.longitude !== undefined && location.longitude !== '' ? { longitude: Number(location.longitude) } : {}) },
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
  try { const rows = await Report.aggregate([{ $match: { createdBy: req.user._id } }, { $group: { _id: '$status', count: { $sum: 1 } } }]); const byStatus = Object.fromEntries(rows.map((row) => [row._id, row.count])); return res.json({ success: true, stats: { total: rows.reduce((sum, row) => sum + row.count, 0), pending: byStatus.pending || 0, verified: byStatus.verified || 0, inProgress: (byStatus.assigned || 0) + (byStatus.in_progress || 0), completed: byStatus.completed || 0, closed: byStatus.closed || 0 } }); } catch (error) { next(error); }
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
    if (req.body.category && !reportCategories.includes(req.body.category) || req.body.priority && !reportPriorities.includes(req.body.priority) || req.body.departmentName && !reportDepartments.includes(req.body.departmentName.trim())) { await removeFiles(req.files); return res.status(400).json({ success: false, message: 'Category, department, or priority is invalid.' }); }
    for (const field of fields) if (req.body[field] !== undefined) report[field] = typeof req.body[field] === 'string' ? req.body[field].trim() : req.body[field];
    if (req.body.location) { try { report.location = JSON.parse(req.body.location); } catch { await removeFiles(req.files); return res.status(400).json({ success: false, message: 'Location must be valid.' }); } }
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

export async function updateReportStatus(req, res, next) {
  try {
    const { status } = req.body;
    if (!statuses.includes(status)) return res.status(400).json({ success: false, message: 'Invalid report status.' });
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).json({ success: false, message: 'Report not found.' });
    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ success: false, message: 'Report not found.' });
    const previous = report.status;
    report.status = status;
    report.activity.push({ action: `Report status changed from ${previous.replace('_', ' ')} to ${status.replace('_', ' ')}`, actorRole: req.user.role });
    await report.save();
    await Notification.create({ recipient: report.createdBy, report: report._id, message: `Your report “${report.title}” is now ${status.replace('_', ' ')}.` });
    await report.populate('createdBy', 'name email');
    return res.json({ success: true, message: 'Report status updated.', report });
  } catch (error) { next(error); }
}
