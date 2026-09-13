import mongoose from 'mongoose';
import User from '../models/User.js';

const roles = ['citizen', 'department_head', 'department_officer', 'field_worker', 'admin'];
const statuses = ['active', 'suspended'];

function safeUser(user) { return user.toSafeObject(); }

export async function listUsers(req, res, next) {
  try {
    const { search = '', role = '' } = req.query;
    const filter = {};
    if (role && roles.includes(role)) filter.role = role;
    if (search.trim()) {
      const expression = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ name: expression }, { email: expression }];
    }
    const users = await User.find(filter).sort({ createdAt: -1 }).limit(100);
    return res.json({ success: true, users: users.map(safeUser) });
  } catch (error) { next(error); }
}

export async function getUser(req, res, next) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).json({ success: false, message: 'User not found.' });
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    return res.json({ success: true, user: safeUser(user) });
  } catch (error) { next(error); }
}

export async function updateUserRole(req, res, next) {
  try {
    const { role } = req.body;
    if (!roles.includes(role)) return res.status(400).json({ success: false, message: 'Invalid user role.' });
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).json({ success: false, message: 'User not found.' });
    if (req.user._id.equals(req.params.id)) return res.status(400).json({ success: false, message: 'You cannot change your own admin role.' });
    const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true, runValidators: true });
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    return res.json({ success: true, message: 'User role updated.', user: safeUser(user) });
  } catch (error) { next(error); }
}

export async function updateUserStatus(req, res, next) {
  try {
    const { status } = req.body;
    if (!statuses.includes(status)) return res.status(400).json({ success: false, message: 'Invalid account status.' });
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).json({ success: false, message: 'User not found.' });
    if (req.user._id.equals(req.params.id)) return res.status(400).json({ success: false, message: 'You cannot change your own account status.' });
    const user = await User.findByIdAndUpdate(req.params.id, { status }, { new: true, runValidators: true });
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    return res.json({ success: true, message: 'User status updated.', user: safeUser(user) });
  } catch (error) { next(error); }
}

