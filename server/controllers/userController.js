import mongoose from 'mongoose';
import User from '../models/User.js';
import Report from '../models/Report.js';
import Emergency from '../models/Emergency.js';
import ActivityLog from '../models/ActivityLog.js';

const roles = ['citizen', 'admin', 'department_head', 'department_officer', 'officer', 'field_worker', 'emergency_department_head', 'emergency_department_officer', 'emergency_officer', 'emergency_field_worker'];
const statuses = ['active', 'suspended'];

function safeUser(user) { return user.toSafeObject(); }

function logActivity(admin, action, targetType, targetId, targetName, description, metadata = {}) {
  return ActivityLog.create({ admin, actorRole: admin.role || '', action, targetType, targetId, targetName, description, metadata, result: 'success' }).catch(() => {});
}

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
    const [reportCount, reportStats, emergencyCount] = await Promise.all([
      Report.countDocuments({ createdBy: user._id }),
      Report.aggregate([{ $match: { createdBy: user._id } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
      Emergency.countDocuments({ citizen: user._id })
    ]);
    const reportStatsMap = Object.fromEntries(reportStats.map(r => [r._id, r.count]));
    return res.json({ success: true, user: safeUser(user), stats: { reports: reportCount, emergencies: emergencyCount, reportsByStatus: reportStatsMap } });
  } catch (error) { next(error); }
}

export async function updateUserRole(req, res, next) {
  try {
    const { role } = req.body;
    if (!roles.includes(role) || role !== 'citizen') return res.status(400).json({ success: false, message: 'Use the admin management API to assign privileged roles and departments.' });
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).json({ success: false, message: 'User not found.' });
    if (req.user._id.equals(req.params.id)) return res.status(400).json({ success: false, message: 'You cannot change your own admin role.' });
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    const previousRole = user.role;
    user.role = role;
    user.department = null;
    user.departmentName = '';
    await user.save();
    await logActivity(req.user, 'role_changed', 'user', user._id, user.name, 'Role changed from ' + previousRole + ' to ' + role, { previousRole, newRole: role });
    res.json({ success: true, message: 'User role updated.', user: safeUser(user) });
  } catch (error) { next(error); }
}

export async function updateUserStatus(req, res, next) {
  try {
    const { status } = req.body;
    if (!statuses.includes(status)) return res.status(400).json({ success: false, message: 'Invalid account status.' });
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).json({ success: false, message: 'User not found.' });
    if (req.user._id.equals(req.params.id)) return res.status(400).json({ success: false, message: 'You cannot change your own account status.' });
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    user.status = status;
    await user.save();
    await logActivity(req.user, status === 'suspended' ? 'user_blocked' : 'user_unblocked', 'user', user._id, user.name, 'Account status changed to ' + status, { status });
    res.json({ success: true, message: 'User status updated.', user: safeUser(user) });
  } catch (error) { next(error); }
}

export async function deleteUser(req, res, next) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).json({ success: false, message: 'User not found.' });
    if (req.user._id.equals(req.params.id)) return res.status(400).json({ success: false, message: 'You cannot delete your own account.' });
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    if (user.role === 'admin') return res.status(400).json({ success: false, message: 'Administrator accounts cannot be deleted.' });
    await logActivity(req.user, 'user_deleted', 'user', user._id, user.name, 'User ' + user.name + ' (' + user.email + ') was deleted.');
    await User.deleteOne({ _id: user._id });
    res.json({ success: true, message: 'User deleted.' });
  } catch (error) { next(error); }
}

export async function getMyProfile(req, res) { return res.json({ success: true, user: safeUser(req.user), preferences: req.user.preferences || { emailNotifications: true } }); }
export async function updateMyProfile(req, res, next) {
  try {
    const { name, photoURL } = req.body;
    if (name !== undefined) { if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 80) return res.status(400).json({ success: false, message: 'Name must be between 2 and 80 characters.' }); req.user.name = name.trim(); }
    if (photoURL !== undefined) { if (typeof photoURL !== 'string' || photoURL.length > 500) return res.status(400).json({ success: false, message: 'Profile photo URL is invalid.' }); req.user.photoURL = photoURL.trim(); }
    await req.user.save(); res.json({ success: true, user: safeUser(req.user) });
  } catch (error) { next(error); }
}
export async function updateMyPreferences(req, res, next) { try { if (typeof req.body.emailNotifications !== 'boolean') return res.status(400).json({ success: false, message: 'Email notification preference must be true or false.' }); req.user.preferences = { ...(req.user.preferences || {}), emailNotifications: req.body.emailNotifications }; await req.user.save(); res.json({ success: true, preferences: req.user.preferences }); } catch (error) { next(error); } }

