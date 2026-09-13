import fs from 'node:fs/promises';
import path from 'node:path';
import mongoose from 'mongoose';
import Report from '../models/Report.js';
import { reportUploadDir } from '../middleware/uploadMiddleware.js';

const editableStatuses = ['pending', 'verified'];
const fields = ['title', 'description', 'category', 'priority', 'departmentName'];
const statuses = ['pending', 'verified', 'assigned', 'in_progress', 'completed', 'closed'];

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
    const { title, description, category, priority, departmentName } = req.body;
    if (!title?.trim() || !description?.trim() || !category || !priority || !departmentName?.trim()) {
      await removeFiles(req.files);
      return res.status(400).json({ success: false, message: 'Title, description, category, priority, and department name are required.' });
    }
    const report = await Report.create({
      title: title.trim(),
      description: description.trim(),
      category,
      priority,
      departmentName: departmentName.trim(),
      attachments: uploadedAttachments(req.files),
      createdBy: req.user._id
    });
    return res.status(201).json({ success: true, message: 'Report submitted successfully.', report });
  } catch (error) {
    await removeFiles(req.files);
    next(error);
  }
}

export async function listMyReports(req, res, next) {
  try {
    const reports = await Report.find({ createdBy: req.user._id }).sort({ createdAt: -1 });
    return res.json({ success: true, reports });
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
    for (const field of fields) if (req.body[field] !== undefined) report[field] = typeof req.body[field] === 'string' ? req.body[field].trim() : req.body[field];
    report.attachments.push(...uploadedAttachments(req.files));
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

export async function updateReportStatus(req, res, next) {
  try {
    const { status } = req.body;
    if (!statuses.includes(status)) return res.status(400).json({ success: false, message: 'Invalid report status.' });
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).json({ success: false, message: 'Report not found.' });
    const report = await Report.findByIdAndUpdate(req.params.id, { status }, { new: true, runValidators: true }).populate('createdBy', 'name email');
    if (!report) return res.status(404).json({ success: false, message: 'Report not found.' });
    return res.json({ success: true, message: 'Report status updated.', report });
  } catch (error) { next(error); }
}
