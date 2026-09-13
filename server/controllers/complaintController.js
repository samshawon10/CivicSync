import mongoose from 'mongoose';
import Complaint from '../models/Complaint.js';

const editableFields = ['title', 'description', 'category', 'status'];

function validId(id) { return mongoose.Types.ObjectId.isValid(id); }

export async function createComplaint(req, res, next) {
  try {
    const { title, description, category } = req.body;
    if (!title?.trim() || !description?.trim() || !category?.trim()) {
      return res.status(400).json({ success: false, message: 'Title, description, and category are required.' });
    }
    const complaint = await Complaint.create({ title: title.trim(), description: description.trim(), category: category.trim(), createdBy: req.user._id });
    return res.status(201).json({ success: true, message: 'Complaint created.', complaint });
  } catch (error) { next(error); }
}

export async function listComplaints(req, res, next) {
  try {
    const filter = req.user.role === 'admin' ? {} : { createdBy: req.user._id };
    const complaints = await Complaint.find(filter).sort({ createdAt: -1 });
    return res.json({ success: true, complaints });
  } catch (error) { next(error); }
}

export async function getComplaint(req, res, next) {
  try {
    if (!validId(req.params.id)) return res.status(404).json({ success: false, message: 'Complaint not found.' });
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint || (req.user.role !== 'admin' && !complaint.createdBy.equals(req.user._id))) return res.status(404).json({ success: false, message: 'Complaint not found.' });
    return res.json({ success: true, complaint });
  } catch (error) { next(error); }
}

export async function updateComplaint(req, res, next) {
  try {
    if (!validId(req.params.id)) return res.status(404).json({ success: false, message: 'Complaint not found.' });
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint || (req.user.role !== 'admin' && !complaint.createdBy.equals(req.user._id))) return res.status(404).json({ success: false, message: 'Complaint not found.' });
    for (const field of editableFields) if (req.body[field] !== undefined) complaint[field] = typeof req.body[field] === 'string' ? req.body[field].trim() : req.body[field];
    if (!complaint.title || !complaint.description || !complaint.category) return res.status(400).json({ success: false, message: 'Title, description, and category cannot be empty.' });
    await complaint.save();
    return res.json({ success: true, message: 'Complaint updated.', complaint });
  } catch (error) { next(error); }
}

export async function deleteComplaint(req, res, next) {
  try {
    if (!validId(req.params.id)) return res.status(404).json({ success: false, message: 'Complaint not found.' });
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint || (req.user.role !== 'admin' && !complaint.createdBy.equals(req.user._id))) return res.status(404).json({ success: false, message: 'Complaint not found.' });
    await complaint.deleteOne();
    return res.json({ success: true, message: 'Complaint deleted.' });
  } catch (error) { next(error); }
}

