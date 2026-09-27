import mongoose from 'mongoose';
import User from '../models/User.js';
import Department, { DEPARTMENT_ASSIGNABLE_ROLES } from '../models/Department.js';
import Report from '../models/Report.js';
import Emergency from '../models/Emergency.js';
import ActivityLog from '../models/ActivityLog.js';
import SystemSetting from '../models/SystemSetting.js';
import { canTransitionReport } from '../services/reportLifecycle.js';
import { reportPriorities, reportStatuses } from '../config/reportOptions.js';
import { emergencyStatuses } from '../config/emergencyOptions.js';
import { sanitizeSettings } from '../config/settingsDefaults.js';
import { emitDepartmentEvent } from '../realtime/emergencyRealtime.js';

const roles = ['citizen', 'admin', 'department_head', 'department_officer', 'officer', 'field_worker', 'emergency_department_head', 'emergency_department_officer', 'emergency_officer', 'emergency_field_worker'];
const departmentHeadRoles = ['department_head', 'emergency_department_head'];
const emergencyRoles = ['emergency_department_head', 'emergency_department_officer', 'emergency_officer', 'emergency_field_worker'];
const userStatuses = ['active', 'suspended'];
const emergencyTypes = ['police', 'fire', 'medical', 'accident', 'disaster', 'other'];
const statusLabels = Object.fromEntries(reportStatuses.map((value) => [value, value.replaceAll('_', ' ')]));

function objectId(value) { return mongoose.Types.ObjectId.isValid(value); }
function escapeRegex(value = '') { return value.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function pageOf(value) { return Math.max(1, Number(value) || 1); }
function limitOf(value) { return Math.min(50, Math.max(1, Number(value) || 15)); }
function dateRange(value) { const days = { '7d': 7, '30d': 30, '3m': 90, '6m': 180, '1y': 365 }[value] || 30; const end = new Date(); const start = new Date(end); start.setDate(start.getDate() - days); const previousStart = new Date(start); previousStart.setDate(previousStart.getDate() - days); return { start, end, previousStart, days }; }
function safeUser(user) { return { id: user._id, name: user.name, email: user.email, phone: user.phone || '', photoURL: user.photoURL || '', role: user.role, department: user.department, departmentName: user.departmentName || '', status: user.status, createdAt: user.createdAt }; }
async function log(admin, action, targetType, targetId, targetName, description, metadata = {}, options = {}) {
  await ActivityLog.create({
    admin: admin._id || admin,
    actorRole: admin.role || options.actorRole || '',
    action,
    targetType,
    targetId,
    targetName,
    description,
    metadata,
    result: options.result || 'success'
  });
}
function reportFilter(query = {}) { const filter = {}; if (reportStatuses.includes(query.status)) filter.status = query.status; if (reportPriorities.includes(query.priority)) filter.priority = query.priority; if (query.department?.trim()) filter.departmentName = query.department.trim(); if (query.category?.trim()) filter.category = query.category.trim(); if (query.from || query.to) { filter.createdAt = {}; if (query.from && !Number.isNaN(Date.parse(query.from))) filter.createdAt.$gte = new Date(query.from); if (query.to && !Number.isNaN(Date.parse(query.to))) { const end = new Date(query.to); end.setHours(23, 59, 59, 999); filter.createdAt.$lte = end; } } if (query.search?.trim()) { const expression = new RegExp(escapeRegex(query.search), 'i'); filter.$or = [{ title: expression }, { description: expression }, { departmentName: expression }]; } return filter; }
function reportQuery(filter) { return Report.find(filter).populate('createdBy', 'name email phone photoURL').populate('assignedOfficer', 'name email phone photoURL').populate('assignedFieldWorker', 'name email phone photoURL'); }

async function analyticsTrends(start, days) { const format = days > 90 ? '%Y-%m' : '%Y-%m-%d'; const [complaintTrend, emergencyTrend, userGrowth] = await Promise.all([Report.aggregate([{ $match: { createdAt: { $gte: start } } }, { $group: { _id: { $dateToString: { format, date: '$createdAt' } }, count: { $sum: 1 } } }, { $sort: { _id: 1 } }]), Emergency.aggregate([{ $match: { createdAt: { $gte: start } } }, { $group: { _id: { $dateToString: { format, date: '$createdAt' } }, count: { $sum: 1 } } }, { $sort: { _id: 1 } }]), User.aggregate([{ $match: { createdAt: { $gte: start } } }, { $group: { _id: { $dateToString: { format, date: '$createdAt' } }, count: { $sum: 1 } } }, { $sort: { _id: 1 } }])]); return { complaintTrend, emergencyTrend, userGrowth }; }

export async function getDashboardStats(req, res, next) {
  try {
    const { start, previousStart, days } = dateRange(req.query.range); const current = { createdAt: { $gte: start } }; const previous = { createdAt: { $gte: previousStart, $lt: start } };
    const [users, departments, reportRows, emergencyRows, roleRows, currentReports, previousReports, currentUsers, previousUsers, recentReports, recentEmergencies, departmentPerformance] = await Promise.all([
      User.countDocuments(), Department.countDocuments(), Report.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]), Emergency.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]), User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]), Report.countDocuments(current), Report.countDocuments(previous), User.countDocuments(current), User.countDocuments(previous), reportQuery({}).sort({ createdAt: -1 }).limit(6).lean(), Emergency.find().populate('citizen', 'name email phone photoURL').populate('assignedDepartment', 'name').populate('assignedOfficer', 'name email').sort({ createdAt: -1 }).limit(6).lean(),
      Report.aggregate([
        { $group: {
          _id: '$departmentName', total: { $sum: 1 },
          resolved: { $sum: { $cond: [{ $in: ['$status', ['completed', 'closed']] }, 1, 0] } },
          pending: { $sum: { $cond: [{ $in: ['$status', ['pending', 'verified', 'assigned', 'in_progress', 'under_review']] }, 1, 0] } }
        } },
        { $project: { department: '$_id', total: 1, resolved: 1, pending: 1 } },
        { $sort: { total: -1 } }, { $limit: 8 }
      ])
    ]);
    const statuses = Object.fromEntries(reportRows.map((row) => [row._id, row.count])); const emergencies = Object.fromEntries(emergencyRows.map((row) => [row._id, row.count])); const roleCounts = Object.fromEntries(roleRows.map((row) => [row._id, row.count])); const reportTotal = reportRows.reduce((sum, row) => sum + row.count, 0); const completed = (statuses.completed || 0) + (statuses.closed || 0); const trend = await analyticsTrends(start, days); const percentage = (now, before) => before ? Math.round(((now - before) / before) * 1000) / 10 : now ? 100 : 0;
    res.json({ success: true, dashboard: { cards: { totalUsers: users, totalCitizens: roleCounts.citizen || 0, totalDepartments: departments, totalDepartmentHeads: roleCounts.department_head || 0, totalDepartmentOfficers: roleCounts.department_officer || 0, totalOfficers: roleCounts.officer || 0, totalFieldWorkers: roleCounts.field_worker || 0, totalComplaints: reportTotal, pendingComplaints: statuses.pending || 0, activeComplaints: (statuses.assigned || 0) + (statuses.in_progress || 0) + (statuses.under_review || 0), completedComplaints: completed, totalEmergencies: emergencyRows.reduce((sum, row) => sum + row.count, 0), activeEmergencies: (emergencies.active || 0) + (emergencies.in_progress || 0) }, roleCounts, changes: { complaints: percentage(currentReports, previousReports), users: percentage(currentUsers, previousUsers) }, statusDistribution: reportRows, departmentPerformance, recentReports, recentEmergencies, resolutionRate: reportTotal ? Math.round((completed / reportTotal) * 100) : 0, ...trend } });
  } catch (error) { next(error); }
}

export async function getAnalytics(req, res, next) {
  try {
    const { start, days } = dateRange(req.query.range); const filter = { createdAt: { $gte: start } };
    if (req.query.department?.trim()) filter.departmentName = req.query.department.trim();
    if (reportStatuses.includes(req.query.status)) filter.status = req.query.status;
    if (req.query.category?.trim()) filter.category = req.query.category.trim();
    const [statusDistribution, byCategory, performance, responseTime, trends] = await Promise.all([
      Report.aggregate([{ $match: filter }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
      Report.aggregate([{ $match: filter }, { $group: { _id: '$category', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 8 }]),
      Report.aggregate([{ $match: filter }, { $group: { _id: '$departmentName', total: { $sum: 1 }, resolved: { $sum: { $cond: [{ $in: ['$status', ['completed', 'closed']] }, 1, 0] } } } }, { $project: { department: '$_id', total: 1, resolved: 1 } }, { $sort: { total: -1 } }]),
      Emergency.aggregate([{ $match: { createdAt: { $gte: start }, responseTimeMinutes: { $ne: null } } }, { $group: { _id: null, average: { $avg: '$responseTimeMinutes' } } }]), analyticsTrends(start, days)
    ]);
    res.json({ success: true, analytics: { statusDistribution, byCategory, departmentPerformance: performance, averageEmergencyResponseMinutes: Math.round(responseTime[0]?.average || 0), ...trends } });
  } catch (error) { next(error); }
}

export async function listUsers(req, res, next) { try { const filter = {}; const { search = '', role = '', status = '' } = req.query; if (roles.includes(role)) filter.role = role; if (userStatuses.includes(status)) filter.status = status; if (search.trim()) { const expression = new RegExp(escapeRegex(search), 'i'); filter.$or = [{ name: expression }, { email: expression }, { phone: expression }]; } const page = pageOf(req.query.page); const limit = limitOf(req.query.limit); const [items, total] = await Promise.all([User.find(filter).populate('department', 'name').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), User.countDocuments(filter)]); res.json({ success: true, users: items.map(safeUser), pagination: { page, limit, total, pages: Math.ceil(total / limit) } }); } catch (error) { next(error); } }
export async function selectUsers(req, res, next) { try { const filter = { status: 'active' }; if (req.query.q?.trim()) { const expression = new RegExp(escapeRegex(req.query.q), 'i'); filter.$or = [{ name: expression }, { email: expression }]; } const users = await User.find(filter).select('name email role department departmentName photoURL').populate('department', 'name').sort({ name: 1 }).limit(20).lean(); res.json({ success: true, users: users.map(safeUser) }); } catch (error) { next(error); } }
export async function getUserDetail(req, res, next) { try { if (!objectId(req.params.id)) return res.status(404).json({ success: false, message: 'User not found.' }); const user = await User.findById(req.params.id).populate('department', 'name').lean(); if (!user) return res.status(404).json({ success: false, message: 'User not found.' }); const [complaints, complaintStats, emergencies, activity] = await Promise.all([Report.countDocuments({ createdBy: user._id }), Report.aggregate([{ $match: { createdBy: user._id } }, { $group: { _id: '$status', count: { $sum: 1 } } }]), Emergency.countDocuments({ citizen: user._id }), ActivityLog.find({ targetId: user._id }).populate('admin', 'name email photoURL').sort({ createdAt: -1 }).limit(10).lean()]); res.json({ success: true, user: safeUser(user), stats: { complaints, complaintByStatus: complaintStats, emergencies }, activity }); } catch (error) { next(error); } }
export async function updateUserRole(req, res, next) { try { const { role, departmentId } = req.body; if (!roles.includes(role) || departmentHeadRoles.includes(role)) return res.status(400).json({ success: false, message: 'Department heads must be assigned from their department.' }); if (!objectId(req.params.id) || req.user._id.equals(req.params.id)) return res.status(400).json({ success: false, message: 'This user role cannot be changed.' }); const user = await User.findById(req.params.id); if (!user) return res.status(404).json({ success: false, message: 'User not found.' }); let department = null; if (departmentId) { if (!objectId(departmentId)) return res.status(400).json({ success: false, message: 'Invalid department.' }); department = await Department.findById(departmentId); if (!department) return res.status(404).json({ success: false, message: 'Department not found.' }); if (emergencyRoles.includes(role) && !['emergency', 'hybrid'].includes(department.scope)) return res.status(400).json({ success: false, message: 'Emergency staff must belong to an emergency-enabled department.' }); if (!emergencyRoles.includes(role) && role !== 'citizen' && department.scope === 'emergency') return res.status(400).json({ success: false, message: 'Civic staff must belong to a civic or hybrid department.' }); } else if (role !== 'citizen' && role !== 'admin') return res.status(400).json({ success: false, message: 'A department is required for this operational role.' }); const previousRole = user.role; await Department.updateMany({ $or: [{ head: user._id }, { emergencyHead: user._id }] }, { $set: { head: null, emergencyHead: null } }); user.role = role; user.department = department?._id || null; user.departmentName = department?.name || ''; await user.save(); await log(req.user, 'role_changed', 'user', user._id, user.name, `Role changed from ${previousRole} to ${role}.`, { previousRole, role }); res.json({ success: true, message: 'User role updated.', user: safeUser(user) }); } catch (error) { next(error); } }
export async function updateUserStatus(req, res, next) { try { if (!userStatuses.includes(req.body.status) || !objectId(req.params.id) || req.user._id.equals(req.params.id)) return res.status(400).json({ success: false, message: 'This account status cannot be changed.' }); const user = await User.findById(req.params.id); if (!user) return res.status(404).json({ success: false, message: 'User not found.' }); user.status = req.body.status; await user.save(); await log(req.user, user.status === 'suspended' ? 'user_blocked' : 'user_unblocked', 'user', user._id, user.name, `Account ${user.status}.`); res.json({ success: true, message: 'Account status updated.', user: safeUser(user) }); } catch (error) { next(error); } }
export async function deleteUser(req, res, next) { try { if (!objectId(req.params.id) || req.user._id.equals(req.params.id)) return res.status(400).json({ success: false, message: 'This user cannot be deleted.' }); const user = await User.findById(req.params.id); if (!user) return res.status(404).json({ success: false, message: 'User not found.' }); if (user.role === 'admin') return res.status(400).json({ success: false, message: 'Administrator accounts cannot be deleted.' }); await Department.updateMany({ $or: [{ head: user._id }, { emergencyHead: user._id }] }, { $set: { head: null, emergencyHead: null } }); await log(req.user, 'user_deleted', 'user', user._id, user.name, `User ${user.email} deleted.`); await user.deleteOne(); res.json({ success: true, message: 'User deleted.' }); } catch (error) { next(error); } }

export async function listDepartmentsForCitizen(req, res, next) {
  try {
    const departments = await Department.find({ status: 'active' })
      .select('name code description icon color contactNumber email address scope')
      .sort({ name: 1 })
      .lean();
    res.json({ success: true, departments });
  } catch (error) { next(error); }
}

export async function listDepartments(req, res, next) {
  try {
    const filter = {};
    if (req.query.status === 'active' || req.query.status === 'inactive') filter.status = req.query.status;
    if (['civic', 'emergency', 'hybrid'].includes(req.query.scope)) filter.scope = req.query.scope;
    if (req.query.search?.trim()) filter.name = new RegExp(escapeRegex(req.query.search), 'i');

    const page = pageOf(req.query.page);
    const limit = limitOf(req.query.limit);

    const [departments, total, activeCount, inactiveCount] = await Promise.all([
      Department.find(filter)
        .populate('head', 'name email photoURL')
        .populate('emergencyHead', 'name email photoURL')
        .sort({ name: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Department.countDocuments(filter),
      Department.countDocuments({ status: 'active' }),
      Department.countDocuments({ status: 'inactive' })
    ]);

    // Attach live staff counts per department (single aggregation)
    const deptIds = departments.map((d) => d._id);
    const staffCounts = await User.aggregate([
      { $match: { department: { $in: deptIds }, status: 'active' } },
      { $group: { _id: '$department', count: { $sum: 1 } } }
    ]);
    const staffMap = Object.fromEntries(staffCounts.map((row) => [String(row._id), row.count]));

    res.json({
      success: true,
      departments: departments.map((d) => ({
        ...d,
        staffCount: staffMap[String(d._id)] || 0
      })),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      counts: { total: activeCount + inactiveCount, active: activeCount, inactive: inactiveCount }
    });
  } catch (error) { next(error); }
}

export async function getDepartmentDetail(req, res, next) {
  try {
    if (!objectId(req.params.id)) return res.status(404).json({ success: false, message: 'Department not found.' });
    const department = await Department.findById(req.params.id)
      .populate('head', 'name email phone photoURL')
      .populate('emergencyHead', 'name email phone photoURL')
      .lean();
    if (!department) return res.status(404).json({ success: false, message: 'Department not found.' });

    const [team, rows, monthly] = await Promise.all([
      User.find({ department: department._id, role: { $in: DEPARTMENT_ASSIGNABLE_ROLES } })
        .select('name email phone photoURL role status')
        .lean(),
      Report.aggregate([
        { $match: { departmentName: department.name } },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      Report.aggregate([
        { $match: { departmentName: department.name } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
            total: { $sum: 1 },
            resolved: { $sum: { $cond: [{ $in: ['$status', ['completed', 'closed']] }, 1, 0] } }
          }
        },
        { $sort: { _id: 1 } },
        { $limit: 12 }
      ])
    ]);
    const stats = Object.fromEntries(rows.map((row) => [row._id, row.count]));
    const total = rows.reduce((sum, row) => sum + row.count, 0);
    const resolved = (stats.completed || 0) + (stats.closed || 0);
    res.json({
      success: true,
      department,
      team,
      stats: {
        total,
        pending: stats.pending || 0,
        active: (stats.assigned || 0) + (stats.in_progress || 0) + (stats.under_review || 0),
        completed: resolved,
        resolutionRate: total ? Math.round((resolved / total) * 100) : 0,
        byStatus: rows
      },
      monthly
    });
  } catch (error) { next(error); }
}

// ─── Department payload helpers ────────────────────────────────────────────
const VALID_EMERGENCY_TYPES = ['police', 'fire', 'medical', 'accident', 'disaster', 'other'];

function buildDepartmentPayload(body, existing = {}) {
  const routingTypes = Array.isArray(body.emergencyTypes)
    ? body.emergencyTypes.filter((type) => VALID_EMERGENCY_TYPES.includes(type))
    : (existing.emergencyTypes || []);

  // Sanitize and validate assignedRoles: only accept known department-level roles
  const assignedRoles = Array.isArray(body.assignedRoles)
    ? [...new Set(body.assignedRoles.filter((role) => DEPARTMENT_ASSIGNABLE_ROLES.includes(role)))]
    : (existing.assignedRoles || []);

  const code = body.code?.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '').slice(0, 40) || existing.code || null;

  return {
    name: body.name?.trim() ?? existing.name,
    code,
    type: body.type !== undefined ? String(body.type).trim().slice(0, 80) : (existing.type || ''),
    description: body.description !== undefined ? String(body.description).trim().slice(0, 2000) : (existing.description || ''),
    icon: body.icon !== undefined ? String(body.icon).trim().slice(0, 80) : (existing.icon || 'building2'),
    color: body.color !== undefined ? String(body.color).trim().slice(0, 20) : (existing.color || '#2563eb'),
    contactNumber: body.contactNumber !== undefined ? String(body.contactNumber).trim().slice(0, 30) : (existing.contactNumber || ''),
    email: body.email !== undefined ? String(body.email).trim().toLowerCase().slice(0, 120) : (existing.email || ''),
    address: body.address !== undefined ? String(body.address).trim().slice(0, 300) : (existing.address || ''),
    status: body.status === 'inactive' ? 'inactive' : 'active',
    scope: ['civic', 'emergency', 'hybrid'].includes(body.scope) ? body.scope : (existing.scope || 'civic'),
    emergencyTypes: routingTypes,
    assignedRoles
  };
}

function validateDepartmentPayload(payload) {
  if (!payload.name || payload.name.length > 120) return 'Department name is required (max 120 characters).';
  if (payload.name.length < 2) return 'Department name must be at least 2 characters.';
  if (payload.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) return 'Enter a valid email address.';
  if (payload.contactNumber && !/^[+()\-\s\d]{6,30}$/.test(payload.contactNumber)) return 'Enter a valid contact number (6–30 characters, digits and +()-).';
  if (payload.color && !/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(payload.color)) return 'Color must be a valid hex value (e.g. #2563eb).';
  if ((payload.scope === 'emergency' || payload.scope === 'hybrid') && !payload.emergencyTypes.length) {
    return 'Emergency and hybrid departments must handle at least one emergency type.';
  }
  return null;
}

export async function createDepartment(req, res, next) {
  try {
    const payload = buildDepartmentPayload(req.body);
    const error = validateDepartmentPayload(payload);
    if (error) return res.status(400).json({ success: false, message: error });

    // Duplicate name check (model has unique index, but provide a clear message)
    const existing = await Department.findOne({ name: payload.name }).lean();
    if (existing) return res.status(409).json({ success: false, message: `A department named "${payload.name}" already exists.` });

    // Duplicate code check
    if (payload.code) {
      const codeConflict = await Department.findOne({ code: payload.code }).lean();
      if (codeConflict) return res.status(409).json({ success: false, message: `Department code "${payload.code}" is already in use.` });
    }

    const department = await Department.create({ ...payload, createdBy: req.user._id });
    await log(req.user, 'department_created', 'department', department._id, department.name, `Department "${department.name}" created.`);

    // Notify all admin sockets and citizen role so their pickers update
    emitDepartmentEvent('DEPARTMENT_CREATED', {
      departmentId: department._id,
      name: department.name,
      code: department.code,
      status: department.status,
      icon: department.icon,
      color: department.color
    }, { roles: ['admin', 'citizen'] });

    res.status(201).json({ success: true, message: `Department "${department.name}" created.`, department });
  } catch (error) {
    if (error.code === 11000) {
      const field = error.keyPattern?.code ? 'code' : 'name';
      return res.status(409).json({ success: false, message: `A department with this ${field} already exists.` });
    }
    next(error);
  }
}

export async function updateDepartment(req, res, next) {
  try {
    if (!objectId(req.params.id)) return res.status(404).json({ success: false, message: 'Department not found.' });
    const department = await Department.findById(req.params.id);
    if (!department) return res.status(404).json({ success: false, message: 'Department not found.' });

    const payload = buildDepartmentPayload(req.body, department.toObject());
    const error = validateDepartmentPayload(payload);
    if (error) return res.status(400).json({ success: false, message: error });

    // Duplicate name check (excluding self)
    if (payload.name !== department.name) {
      const conflict = await Department.findOne({ name: payload.name, _id: { $ne: department._id } }).lean();
      if (conflict) return res.status(409).json({ success: false, message: `A department named "${payload.name}" already exists.` });
    }
    // Duplicate code check (excluding self)
    if (payload.code && payload.code !== department.code) {
      const codeConflict = await Department.findOne({ code: payload.code, _id: { $ne: department._id } }).lean();
      if (codeConflict) return res.status(409).json({ success: false, message: `Department code "${payload.code}" is already in use.` });
    }

    const oldName = department.name;
    Object.assign(department, payload);
    await department.save();

    // Cascade name change to all staff and reports
    if (oldName !== department.name) {
      await Promise.all([
        User.updateMany({ department: department._id }, { $set: { departmentName: department.name } }),
        Report.updateMany({ departmentName: oldName }, { $set: { departmentName: department.name } })
      ]);
    }

    await log(req.user, 'department_updated', 'department', department._id, department.name, `Department "${department.name}" details updated.`);

    emitDepartmentEvent('DEPARTMENT_UPDATED', {
      departmentId: department._id,
      name: department.name,
      code: department.code,
      status: department.status,
      icon: department.icon,
      color: department.color,
      oldName: oldName !== department.name ? oldName : undefined
    }, { roles: ['admin', 'citizen'], department: department.name });

    res.json({ success: true, message: `Department "${department.name}" updated.`, department });
  } catch (error) {
    if (error.code === 11000) {
      const field = error.keyPattern?.code ? 'code' : 'name';
      return res.status(409).json({ success: false, message: `A department with this ${field} already exists.` });
    }
    next(error);
  }
}

export async function toggleDepartmentStatus(req, res, next) {
  try {
    if (!objectId(req.params.id)) return res.status(404).json({ success: false, message: 'Department not found.' });
    const department = await Department.findById(req.params.id);
    if (!department) return res.status(404).json({ success: false, message: 'Department not found.' });

    const newStatus = req.body.status === 'inactive' ? 'inactive' : 'active';
    if (department.status === newStatus) {
      return res.json({ success: true, message: `Department is already ${newStatus}.`, department });
    }

    department.status = newStatus;
    await department.save();

    await log(
      req.user,
      newStatus === 'active' ? 'department_activated' : 'department_deactivated',
      'department',
      department._id,
      department.name,
      `Department "${department.name}" ${newStatus === 'active' ? 'activated' : 'deactivated'}.`
    );

    emitDepartmentEvent('DEPARTMENT_STATUS_CHANGED', {
      departmentId: department._id,
      name: department.name,
      status: department.status
    }, { roles: ['admin', 'citizen'] });

    res.json({ success: true, message: `Department "${department.name}" is now ${newStatus}.`, department });
  } catch (error) { next(error); }
}

const DEPARTMENT_HEAD_SLOTS = {
  head: {
    key: 'head',
    role: 'department_head',
    label: 'Department Head',
    noun: 'department head',
    scopes: ['civic', 'hybrid']
  },
  emergencyHead: {
    key: 'emergencyHead',
    role: 'emergency_department_head',
    label: 'Emergency Head',
    noun: 'emergency department head',
    scopes: ['emergency', 'hybrid']
  }
};

async function setDepartmentHeadSlot(req, res, next, slotKey) {
  const slot = DEPARTMENT_HEAD_SLOTS[slotKey];
  const opposite = DEPARTMENT_HEAD_SLOTS[slotKey === 'head' ? 'emergencyHead' : 'head'];
  try {
    if (!objectId(req.params.id)) return res.status(404).json({ success: false, message: 'Department not found.' });
    const department = await Department.findById(req.params.id);
    if (!department) return res.status(404).json({ success: false, message: 'Department not found.' });

    const rawUserId = req.body?.userId;
    const holder = department[slot.key] ? await User.findById(department[slot.key]) : null;

    // ── Clear the slot: change or demote the leader without naming a replacement.
    // This runs even for a slot the scope no longer supports, which is the only
    // way out of a department that ended up with a legacy head it should not have.
    if (rawUserId === null || rawUserId === undefined || rawUserId === '') {
      if (!holder) return res.json({ success: true, message: `"${department.name}" has no ${slot.label}.`, department });
      if (holder.role === slot.role) { holder.role = 'citizen'; holder.department = null; holder.departmentName = ''; await holder.save(); }
      department[slot.key] = null;
      await department.save();
      await log(req.user, `${slot.role}_removed`, 'department', department._id, department.name, `${holder.name} removed as ${slot.noun} of "${department.name}".`, { previousHead: holder._id });
      emitDepartmentEvent('DEPARTMENT_UPDATED', { departmentId: department._id, name: department.name }, { roles: ['admin'], department: department.name });
      await department.populate({ path: slot.key, select: 'name email phone photoURL' });
      return res.json({ success: true, message: `${slot.label} removed from "${department.name}".`, department });
    }

    // ── Assign the slot.
    // The scope decides which leadership role the department actually needs.
    if (!slot.scopes.includes(department.scope)) {
      return res.status(400).json({
        success: false,
        message: `"${department.name}" is a ${department.scope} department, so it is led by ${opposite.label.startsWith('E') ? 'an' : 'a'} ${opposite.label}. ${holder ? `Remove the ${slot.label} first, then assign the ${opposite.label}.` : ''} Use Routing to change what this department handles when both kinds of leadership are needed.`
      });
    }
    if (!objectId(rawUserId)) return res.status(400).json({ success: false, message: `Select a registered user to assign as ${slot.label}.` });
    const candidate = await User.findById(rawUserId);
    if (!candidate) return res.status(404).json({ success: false, message: 'User not found.' });
    if (candidate.status !== 'active') return res.status(400).json({ success: false, message: 'Only active non-admin users are eligible to lead a department.' });
    if (candidate.role === 'admin') return res.status(400).json({ success: false, message: 'Administrator accounts cannot lead a department.' });

    // One role per account: release the candidate from every other department first.
    await Promise.all([
      Department.updateMany({ _id: { $ne: department._id }, head: candidate._id }, { $set: { head: null } }),
      Department.updateMany({ _id: { $ne: department._id }, emergencyHead: candidate._id }, { $set: { emergencyHead: null } })
    ]);

    const replacing = Boolean(holder && !holder._id.equals(candidate._id));
    if (replacing) { holder.role = 'citizen'; holder.department = null; holder.departmentName = ''; await holder.save(); }

    // A single role cannot fill both leadership slots of the same department.
    const movedFromOpposite = Boolean(department[opposite.key] && String(department[opposite.key]) === String(candidate._id));

    candidate.role = slot.role;
    candidate.department = department._id;
    candidate.departmentName = department.name;
    await candidate.save();

    department[slot.key] = candidate._id;
    if (movedFromOpposite) department[opposite.key] = null;
    await department.save();

    await log(
      req.user,
      replacing ? `${slot.role}_changed` : `${slot.role}_assigned`,
      'department',
      department._id,
      department.name,
      `${candidate.name} assigned as ${slot.noun} of "${department.name}".`,
      { previousHead: replacing ? holder._id : null, newHead: candidate._id, movedFrom: movedFromOpposite ? opposite.key : null }
    );
    emitDepartmentEvent('DEPARTMENT_UPDATED', { departmentId: department._id, name: department.name }, { roles: ['admin'], department: department.name });
    await department.populate({ path: slot.key, select: 'name email phone photoURL' });
    const released = movedFromOpposite ? ` ${candidate.name} no longer holds the ${opposite.label} role because one account has one role.` : '';
    const samePerson = Boolean(holder && holder._id.equals(candidate._id));
    const message = samePerson
      ? `${candidate.name} is already the ${slot.label} of "${department.name}".`
      : `${slot.label} ${replacing ? 'changed for' : 'assigned to'} "${department.name}".${released}`;
    res.json({ success: true, message, department });
  } catch (error) { next(error); }
}

export async function assignDepartmentHead(req, res, next) { return setDepartmentHeadSlot(req, res, next, 'head'); }

export async function assignEmergencyDepartmentHead(req, res, next) { return setDepartmentHeadSlot(req, res, next, 'emergencyHead'); }

export async function updateEmergencyRouting(req, res, next) {
  try {
    if (!objectId(req.params.id)) return res.status(404).json({ success: false, message: 'Department not found.' });
    const department = await Department.findById(req.params.id);
    if (!department) return res.status(404).json({ success: false, message: 'Department not found.' });
    const types = Array.isArray(req.body.emergencyTypes) ? req.body.emergencyTypes.filter((type) => VALID_EMERGENCY_TYPES.includes(type)) : [];
    if (!types.length) return res.status(400).json({ success: false, message: 'Select at least one valid emergency type.' });
    department.scope = department.scope === 'civic' ? 'hybrid' : department.scope;
    department.emergencyTypes = [...new Set(types)];
    await department.save();
    await log(req.user, 'emergency_routing_updated', 'department', department._id, department.name, 'Emergency routing responsibilities updated.', { emergencyTypes: department.emergencyTypes });
    res.json({ success: true, message: 'Emergency routing updated.', department });
  } catch (error) { next(error); }
}

export async function deleteDepartment(req, res, next) {
  try {
    if (!objectId(req.params.id)) return res.status(404).json({ success: false, message: 'Department not found.' });
    const department = await Department.findById(req.params.id);
    if (!department) return res.status(404).json({ success: false, message: 'Department not found.' });

    // Safety check: if reports or emergencies reference this department, require explicit confirmation
    const force = req.query.force === 'true';
    if (!force) {
      const [reportCount, emergencyCount] = await Promise.all([
        Report.countDocuments({ departmentName: department.name }),
        Emergency.countDocuments({ assignedDepartment: department._id })
      ]);
      if (reportCount > 0 || emergencyCount > 0) {
        return res.status(409).json({
          success: false,
          message: `This department has ${reportCount} report(s) and ${emergencyCount} emergency record(s). Deactivate it instead, or pass ?force=true to permanently delete.`,
          counts: { reports: reportCount, emergencies: emergencyCount }
        });
      }
    }

    const name = department.name;
    await User.updateMany({ department: department._id }, { $set: { role: 'citizen', department: null, departmentName: '' } });
    await log(req.user, 'department_deleted', 'department', department._id, department.name, `Department "${department.name}" permanently deleted.`);
    await department.deleteOne();

    emitDepartmentEvent('DEPARTMENT_DELETED', { name }, { roles: ['admin', 'citizen'] });

    res.json({ success: true, message: `Department "${name}" deleted. Staff accounts reset to citizen.` });
  } catch (error) { next(error); }
}

export async function listAssignableRoles(req, res, next) {
  try {
    const roleDescriptions = {
      department_head: 'Leads the department. Manages officers, reviews completions, and has full case authority.',
      department_officer: 'Manages assigned citizen reports and handles department operations.',
      officer: 'General officer role for civic departments. Can be assigned to cases.',
      field_worker: 'Receives and updates assigned field tasks for on-site work.',
      emergency_department_head: 'Leads emergency response within the department. Manages dispatch and escalations.',
      emergency_department_officer: 'Coordinates emergency response assignments and monitors active incidents.',
      emergency_officer: 'Responds to dispatched emergency incidents in the field.',
      emergency_field_worker: 'Frontline field responder for emergency and disaster situations.'
    };
    const roleGroups = {
      department_head: 'Civic Leadership',
      department_officer: 'Civic Operations',
      officer: 'Civic Operations',
      field_worker: 'Civic Operations',
      emergency_department_head: 'Emergency Leadership',
      emergency_department_officer: 'Emergency Operations',
      emergency_officer: 'Emergency Operations',
      emergency_field_worker: 'Emergency Operations'
    };
    res.json({
      success: true,
      roles: DEPARTMENT_ASSIGNABLE_ROLES.map((key) => ({
        key,
        label: key.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()),
        description: roleDescriptions[key] || '',
        group: roleGroups[key] || 'Other'
      }))
    });
  } catch (error) { next(error); }
}

export async function listComplaints(req, res, next) { try { const filter = reportFilter(req.query); const page = pageOf(req.query.page); const limit = limitOf(req.query.limit); const [complaints, total] = await Promise.all([reportQuery(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), Report.countDocuments(filter)]); res.json({ success: true, complaints, pagination: { page, limit, total, pages: Math.ceil(total / limit) } }); } catch (error) { next(error); } }
export async function getComplaintDetail(req, res, next) { try { if (!objectId(req.params.id)) return res.status(404).json({ success: false, message: 'Complaint not found.' }); const complaint = await reportQuery({ _id: req.params.id }).populate('completionReport.submittedBy', 'name email photoURL').lean(); if (!complaint) return res.status(404).json({ success: false, message: 'Complaint not found.' }); res.json({ success: true, complaint }); } catch (error) { next(error); } }
export async function updateComplaint(req, res, next) { try { if (!objectId(req.params.id)) return res.status(404).json({ success: false, message: 'Complaint not found.' }); const complaint = await Report.findById(req.params.id); if (!complaint) return res.status(404).json({ success: false, message: 'Complaint not found.' }); const { status, priority, departmentName, officerId, fieldWorkerId, note = '' } = req.body; if (status !== undefined) { if (!reportStatuses.includes(status)) return res.status(400).json({ success: false, message: 'Invalid complaint status.' }); if (status !== complaint.status && !canTransitionReport(complaint.status, status)) return res.status(409).json({ success: false, message: `Invalid complaint status transition from ${statusLabels[complaint.status] || complaint.status}.` }); complaint.status = status; } if (priority !== undefined) { if (!reportPriorities.includes(priority)) return res.status(400).json({ success: false, message: 'Invalid priority.' }); complaint.priority = priority; } if (departmentName !== undefined) { const department = await Department.findOne({ name: departmentName, status: 'active', scope: { $in: ['civic', 'hybrid'] } }); if (!department) return res.status(400).json({ success: false, message: 'Choose an active civic department.' }); complaint.departmentName = department.name; } const assignedDepartment = complaint.departmentName; if (officerId !== undefined) { const officer = officerId ? await User.findOne({ _id: officerId, role: { $in: ['department_officer', 'officer'] }, departmentName: assignedDepartment, status: 'active' }) : null; if (officerId && !officer) return res.status(400).json({ success: false, message: 'Selected officer is not active in this department.' }); complaint.assignedOfficer = officer?._id || null; } if (fieldWorkerId !== undefined) { const worker = fieldWorkerId ? await User.findOne({ _id: fieldWorkerId, role: 'field_worker', departmentName: assignedDepartment, status: 'active' }) : null; if (fieldWorkerId && !worker) return res.status(400).json({ success: false, message: 'Selected field worker is not active in this department.' }); complaint.assignedFieldWorker = worker?._id || null; } if ((officerId || fieldWorkerId) && ['pending', 'verified'].includes(complaint.status)) complaint.status = 'assigned'; complaint.activity.push({ action: 'Updated by administrator', actorRole: 'admin', note: String(note).slice(0, 500) }); await complaint.save(); await log(req.user, 'complaint_updated', 'report', complaint._id, complaint.title, 'Complaint management data updated.'); await complaint.populate('createdBy', 'name email phone photoURL'); await complaint.populate('assignedOfficer', 'name email photoURL'); await complaint.populate('assignedFieldWorker', 'name email photoURL'); res.json({ success: true, message: 'Complaint updated.', complaint }); } catch (error) { next(error); } }
export async function deleteComplaint(req, res, next) { try { if (!objectId(req.params.id)) return res.status(404).json({ success: false, message: 'Complaint not found.' }); const complaint = await Report.findById(req.params.id); if (!complaint) return res.status(404).json({ success: false, message: 'Complaint not found.' }); await log(req.user, 'complaint_deleted', 'report', complaint._id, complaint.title, 'Complaint deleted.'); await complaint.deleteOne(); res.json({ success: true, message: 'Complaint deleted.' }); } catch (error) { next(error); } }

export async function listEmergencies(req, res, next) { try { const filter = {}; if (emergencyStatuses.includes(req.query.status)) filter.status = req.query.status; if (req.query.type) filter.type = req.query.type; if (req.query.search?.trim()) { const exp = new RegExp(escapeRegex(req.query.search), 'i'); filter.$or = [{ title: exp }, { citizenName: exp }, { 'location.address': exp }]; } const page = pageOf(req.query.page); const limit = limitOf(req.query.limit); const [emergencies, total] = await Promise.all([Emergency.find(filter).populate('citizen', 'name email phone photoURL').populate('assignedDepartment', 'name').populate('assignedOfficer', 'name email photoURL').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), Emergency.countDocuments(filter)]); res.json({ success: true, emergencies, pagination: { page, limit, total, pages: Math.ceil(total / limit) } }); } catch (error) { next(error); } }
export async function getEmergencyDetail(req, res, next) { try { if (!objectId(req.params.id)) return res.status(404).json({ success: false, message: 'Emergency not found.' }); const emergency = await Emergency.findById(req.params.id).populate('citizen', 'name email phone photoURL').populate('assignedDepartment', 'name').populate('assignedOfficer', 'name email phone photoURL').lean(); if (!emergency) return res.status(404).json({ success: false, message: 'Emergency not found.' }); res.json({ success: true, emergency }); } catch (error) { next(error); } }
export async function updateEmergency(req, res, next) { try { if (!objectId(req.params.id)) return res.status(404).json({ success: false, message: 'Emergency not found.' }); const emergency = await Emergency.findById(req.params.id); if (!emergency) return res.status(404).json({ success: false, message: 'Emergency not found.' }); const { status, departmentId, officerId, fieldWorkerId, notes } = req.body; if (status !== undefined && !emergencyStatuses.includes(status)) return res.status(400).json({ success: false, message: 'Invalid emergency status.' }); if (departmentId !== undefined) { const department = departmentId ? await Department.findById(departmentId) : null; if (departmentId && (!department || !['emergency', 'hybrid'].includes(department.scope) || !department.emergencyTypes.includes(emergency.type))) return res.status(400).json({ success: false, message: 'Choose an emergency-enabled department configured for this emergency type.' }); emergency.assignedDepartment = department?._id || null; } else if (!emergency.assignedDepartment) { const department = await Department.findOne({ status: 'active', scope: { $in: ['emergency', 'hybrid'] }, emergencyTypes: emergency.type }); if (department) emergency.assignedDepartment = department._id; } const assignmentDepartment = emergency.assignedDepartment; if (officerId !== undefined) { const officer = officerId ? await User.findOne({ _id: officerId, department: assignmentDepartment, status: 'active', role: { $in: ['emergency_department_officer', 'emergency_officer'] } }) : null; if (officerId && !officer) return res.status(400).json({ success: false, message: 'Officer is not active in the assigned emergency department.' }); emergency.assignedOfficer = officer?._id || null; } if (fieldWorkerId !== undefined) { const worker = fieldWorkerId ? await User.findOne({ _id: fieldWorkerId, department: assignmentDepartment, status: 'active', role: 'emergency_field_worker' }) : null; if (fieldWorkerId && !worker) return res.status(400).json({ success: false, message: 'Field worker is not active in the assigned emergency department.' }); emergency.assignedFieldWorker = worker?._id || null; } if (status) { if (status === 'resolved' && !emergency.resolvedAt) { emergency.resolvedAt = new Date(); } emergency.status = status; } if (notes !== undefined) emergency.notes = String(notes).slice(0, 1000); emergency.activity.push({ action: 'Emergency updated by administrator', actorRole: 'admin', note: String(notes || '').slice(0, 500) }); await emergency.save(); await log(req.user, 'emergency_updated', 'emergency', emergency._id, emergency.title, 'Emergency updated.'); res.json({ success: true, message: 'Emergency updated.', emergency }); } catch (error) { next(error); } }

export async function listActivityLogs(req, res, next) {
  try {
    const page = pageOf(req.query.page);
    const limit = limitOf(req.query.limit);
    const filter = {};
    if (req.query.action?.trim()) filter.action = req.query.action.trim();
    if (req.query.module?.trim()) filter.targetType = req.query.module.trim();
    if (['success', 'failure', 'info'].includes(req.query.result)) filter.result = req.query.result;
    if (req.query.role?.trim()) filter.actorRole = req.query.role.trim();
    if (objectId(req.query.actor)) filter.admin = req.query.actor;
    if (req.query.search?.trim()) {
      const expression = new RegExp(escapeRegex(req.query.search), 'i');
      filter.$or = [{ description: expression }, { targetName: expression }, { action: expression }];
    }
    if (req.query.from || req.query.to) {
      filter.createdAt = {};
      if (req.query.from && !Number.isNaN(Date.parse(req.query.from))) filter.createdAt.$gte = new Date(req.query.from);
      if (req.query.to && !Number.isNaN(Date.parse(req.query.to))) {
        const end = new Date(req.query.to);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }
    const [logs, total, actions, modules, roles] = await Promise.all([
      ActivityLog.find(filter).populate('admin', 'name email photoURL role').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      ActivityLog.countDocuments(filter),
      ActivityLog.distinct('action'),
      ActivityLog.distinct('targetType'),
      ActivityLog.distinct('actorRole')
    ]);
    res.json({
      success: true,
      logs,
      pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
      facets: { actions: actions.sort(), modules: modules.sort(), roles: roles.filter(Boolean).sort() }
    });
  } catch (error) { next(error); }
}
export async function getSettings(req, res, next) {
  try {
    const record = await SystemSetting.findOne({ key: 'admin_portal' }).lean();
    const { settings } = sanitizeSettings(record?.value || {}, {});
    res.json({ success: true, settings, lastUpdatedAt: record?.updatedAt || null });
  } catch (error) { next(error); }
}

export async function updateSettings(req, res, next) {
  try {
    const record = await SystemSetting.findOne({ key: 'admin_portal' }).lean();
    const { settings, errors, changed } = sanitizeSettings(record?.value || {}, req.body || {});
    if (errors.length) return res.status(400).json({ success: false, message: errors.join(' ') });
    await SystemSetting.findOneAndUpdate({ key: 'admin_portal' }, { value: settings, updatedBy: req.user._id }, { upsert: true, new: true, setDefaultsOnInsert: true });
    await log(req.user, 'settings_changed', 'system', req.user._id, 'Admin portal settings', changed.length ? `Updated: ${changed.join(', ')}` : 'Settings saved with no field changes.', { changed });
    res.json({ success: true, message: 'Settings saved.', settings, changed });
  } catch (error) { next(error); }
}
export async function exportReport(req, res, next) { try { const type = ['complaints', 'emergencies', 'users', 'departments'].includes(req.query.type) ? req.query.type : 'complaints'; let headers; let rows; if (type === 'emergencies') { headers = ['Emergency ID', 'Citizen', 'Type', 'Status', 'Department', 'Created']; rows = (await Emergency.find().populate('assignedDepartment', 'name').sort({ createdAt: -1 }).lean()).map((item) => [item._id, item.citizenName, item.type, item.status, item.assignedDepartment?.name || '', item.createdAt]); } else if (type === 'users') { headers = ['User ID', 'Name', 'Email', 'Role', 'Status', 'Department', 'Joined']; rows = (await User.find().sort({ createdAt: -1 }).lean()).map((item) => [item._id, item.name, item.email, item.role, item.status, item.departmentName, item.createdAt]); } else if (type === 'departments') { headers = ['Department', 'Type', 'Status', 'Email', 'Created']; rows = (await Department.find().sort({ name: 1 }).lean()).map((item) => [item.name, item.type, item.status, item.email, item.createdAt]); } else { headers = ['Complaint ID', 'Title', 'Citizen', 'Department', 'Priority', 'Status', 'Created']; rows = (await reportQuery(reportFilter(req.query)).sort({ createdAt: -1 }).lean()).map((item) => [item._id, item.title, item.createdBy?.name || '', item.departmentName, item.priority, item.status, item.createdAt]); } const csv = [headers, ...rows].map((row) => row.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\n'); res.setHeader('Content-Type', 'text/csv; charset=utf-8'); res.setHeader('Content-Disposition', `attachment; filename="civicsync-${type}-${new Date().toISOString().slice(0, 10)}.csv"`); res.send(csv); } catch (error) { next(error); } }
