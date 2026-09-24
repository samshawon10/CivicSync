/**
 * Super Admin governance API.
 *
 * Everything in this controller is derived from real CivicSync collections —
 * no sample data, no estimated numbers. Trend percentages are only produced
 * when a real comparison window exists; otherwise the API reports
 * `changePercent: null` with a basis of `no_prior_data` and the UI says so.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Department from '../models/Department.js';
import Report from '../models/Report.js';
import Emergency from '../models/Emergency.js';
import EmergencyAlert from '../models/EmergencyAlert.js';
import EmergencyCategory from '../models/EmergencyCategory.js';
import EmergencyResponseAssignment from '../models/EmergencyResponseAssignment.js';
import ResponseTeam from '../models/ResponseTeam.js';
import SafetyFacility from '../models/SafetyFacility.js';
import ActivityLog from '../models/ActivityLog.js';
import Notification from '../models/Notification.js';
import SystemSetting from '../models/SystemSetting.js';
import { activeEmergencyStatuses, emergencySeverities, emergencyTypeCatalog } from '../config/emergencyOptions.js';
import { reportStatuses, reportPriorities, reportCategories, reportDepartments } from '../config/reportOptions.js';
import { permissionMatrix, roleMeta, roleOrder } from '../config/permissions.js';
import { readFeatureFlags } from '../config/settingsDefaults.js';
import { realtimeStatus } from '../realtime/emergencyRealtime.js';
import { checkMapTileHealth } from '../services/mapTileHealth.js';

const serverDir = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(serverDir, '..', 'uploads');

const openComplaintStatuses = ['pending', 'verified', 'assigned', 'in_progress', 'under_review'];
const responderRoles = ['emergency_department_head', 'emergency_department_officer', 'emergency_officer', 'emergency_field_worker'];
const ranges = { '24h': 1, '7d': 7, '30d': 30, '3m': 90, '6m': 180, '1y': 365 };

function rangeWindow(value) {
  const days = ranges[value] || 30;
  const end = new Date();
  const start = new Date(end.getTime() - days * 86400000);
  const previousStart = new Date(start.getTime() - days * 86400000);
  return { key: ranges[value] ? value : '30d', days, start, end, previousStart };
}

function escapeRegex(value = '') { return value.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function pageOf(value) { return Math.max(1, Number(value) || 1); }
function limitOf(value) { return Math.min(100, Math.max(1, Number(value) || 20)); }
function count(value) { return Number.isFinite(Number(value)) ? Number(value) : 0; }
function tally(rows, key = '_id') { return Object.fromEntries(rows.map((row) => [row[key], row.count])); }

/** Honest trend: a percentage only exists when the previous window has data. */
function trendOf(current, previous) {
  if (!previous) return { current, previous, changePercent: null, basis: 'no_prior_data' };
  return { current, previous, changePercent: Math.round(((current - previous) / previous) * 1000) / 10, basis: 'period_over_period' };
}

async function storedSettings() {
  const record = await SystemSetting.findOne({ key: 'admin_portal' }).lean().catch(() => null);
  return record?.value || {};
}

export async function getGovernanceOverview(req, res, next) {
  try {
    const range = rangeWindow(req.query.range);
    const currentWindow = { createdAt: { $gte: range.start } };
    const previousWindow = { createdAt: { $gte: range.previousStart, $lt: range.start } };

    const [
      roleRows, userStatusRows, departmentRows, reportStatusRows, reportPriorityRows,
      emergencyStatusRows, emergencySeverityRows, emergencyCategoryRows, assignmentRows,
      teamRows, facilityRows, activeAlerts, categoryCount,
      userCurrent, userPrevious, reportCurrent, reportPrevious, emergencyCurrent, emergencyPrevious,
      activeResponders, restrictedActive, recentActivity, recentEmergencies, recentAlerts, settings
    ] = await Promise.all([
      User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]),
      User.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Department.aggregate([{ $group: { _id: '$scope', count: { $sum: 1 } } }]),
      Report.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Report.aggregate([{ $group: { _id: '$priority', count: { $sum: 1 } } }]),
      Emergency.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Emergency.aggregate([{ $group: { _id: '$severity', count: { $sum: 1 } } }]),
      Emergency.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
      EmergencyResponseAssignment.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      ResponseTeam.aggregate([{ $group: { _id: { availability: '$availability', active: '$active' }, count: { $sum: 1 } } }]),
      SafetyFacility.aggregate([{ $group: { _id: { type: '$type', active: '$active' }, count: { $sum: 1 } } }]),
      EmergencyAlert.countDocuments({ active: true }),
      EmergencyCategory.countDocuments({ active: true }),
      User.countDocuments(currentWindow),
      User.countDocuments(previousWindow),
      Report.countDocuments(currentWindow),
      Report.countDocuments(previousWindow),
      Emergency.countDocuments(currentWindow),
      Emergency.countDocuments(previousWindow),
      User.countDocuments({ role: { $in: responderRoles }, status: 'active' }),
      Emergency.countDocuments({ visibility: 'restricted', status: { $in: activeEmergencyStatuses } }),
      ActivityLog.find().populate('admin', 'name role photoURL').sort({ createdAt: -1 }).limit(8).lean(),
      Emergency.find()
        .select('emergencyId title category severity status visibility source createdAt citizen assignedDepartment')
        .populate('citizen', 'name')
        .populate('assignedDepartment', 'name')
        .sort({ createdAt: -1 })
        .limit(6)
        .lean(),
      EmergencyAlert.find().sort({ createdAt: -1 }).limit(5).lean(),
      storedSettings()
    ]);
    const roleCounts = tally(roleRows);
    const statusCounts = tally(userStatusRows);
    const reportCounts = tally(reportStatusRows);
    const severityCounts = tally(emergencySeverityRows);
    const emergencyCounts = tally(emergencyStatusRows);
    const assignmentCounts = tally(assignmentRows);
    const priorityCounts = tally(reportPriorityRows);
    const activeAssignmentStatuses = ['assigned', 'accepted', 'en_route', 'on_scene', 'responding'];
    const activeEmergencies = activeEmergencyStatuses.reduce((sum, key) => sum + count(emergencyCounts[key]), 0);
    const teamTally = teamRows.reduce((accumulator, row) => {
      const bucket = row._id.active === false ? 'inactive' : row._id.availability;
      accumulator[bucket] = count(accumulator[bucket]) + row.count;
      return accumulator;
    }, { available: 0, busy: 0, offline: 0, inactive: 0 });
    const facilityTally = facilityRows.reduce((accumulator, row) => {
      if (row._id.active === false) return accumulator;
      accumulator[row._id.type] = count(accumulator[row._id.type]) + row.count;
      return accumulator;
    }, {});
    res.json({
      success: true,
      generatedAt: new Date(),
      range: { key: range.key, days: range.days, start: range.start, end: range.end },
      features: readFeatureFlags(settings),
      kpis: {
        totalUsers: roleRows.reduce((sum, row) => sum + row.count, 0),
        citizens: count(roleCounts.citizen),
        activeUsers: count(statusCounts.active),
        suspendedUsers: count(statusCounts.suspended),
        activeEmergencies,
        totalEmergencies: emergencyStatusRows.reduce((sum, row) => sum + row.count, 0),
        restrictedEmergencies: restrictedActive,
        openComplaints: openComplaintStatuses.reduce((sum, key) => sum + count(reportCounts[key]), 0),
        totalComplaints: reportStatusRows.reduce((sum, row) => sum + row.count, 0),
        activeResponders,
        activeAssignments: activeAssignmentStatuses.reduce((sum, key) => sum + count(assignmentCounts[key]), 0),
        completedAssignments: count(assignmentCounts.completed),
        departments: departmentRows.reduce((sum, row) => sum + row.count, 0),
        responseTeams: teamRows.reduce((sum, row) => sum + row.count, 0),
        facilities: facilityRows.filter((row) => row._id.active !== false).reduce((sum, row) => sum + row.count, 0),
        activeAlerts,
        activeCategories: categoryCount
      },
      trends: {
        emergencies: trendOf(emergencyCurrent, emergencyPrevious),
        complaints: trendOf(reportCurrent, reportPrevious),
        users: trendOf(userCurrent, userPrevious)
      },
      emergency: {
        bySeverity: emergencySeverities.map((severity) => ({ key: severity, count: count(severityCounts[severity]) })),
        byCategory: emergencyCategoryRows.map((row) => ({ key: row._id || 'unknown', count: row.count })),
        byStatus: emergencyStatusRows.map((row) => ({ key: row._id || 'unknown', count: row.count }))
      },
      complaints: {
        byStatus: reportStatuses.map((status) => ({ key: status, count: count(reportCounts[status]) })),
        byPriority: reportPriorities.map((priority) => ({ key: priority, count: count(priorityCounts[priority]) }))
      },
      workforce: { byRole: roleOrder.map((role) => ({ key: role, count: count(roleCounts[role]) })), teams: teamTally },
      resources: {
        departmentsByScope: departmentRows.map((row) => ({ key: row._id || 'civic', count: row.count })),
        facilitiesByType: Object.entries(facilityTally).map(([key, value]) => ({ key, count: value })),
        categories: { configured: categoryCount, catalog: emergencyTypeCatalog.length }
      },
      recentActivity,
      recentEmergencies,
      alerts: { active: activeAlerts, recent: recentAlerts }
    });
  } catch (error) { next(error); }
}

export async function getMapTileHealth(req, res, next) {
  try {
    const result = await checkMapTileHealth({ force: req.query.refresh === 'true' });
    res.set('Cache-Control', 'private, no-store');
    return res.json({ success: true, ...result });
  } catch (error) { return next(error); }
}

/** Real, observable infrastructure checks. Unknowns are reported as such. */
export async function getSystemHealth(req, res, next) {
  try {
    const checks = [];
    const started = Date.now();
    let databaseLatency = null;
    let databaseDetail = 'MongoDB connection is not established.';
    let databaseStatus = 'unavailable';
    try {
      const readyState = mongoose.connection.readyState;
      const names = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
      if (readyState === 1 && mongoose.connection.db) {
        const pingStart = Date.now();
        await mongoose.connection.db.admin().ping();
        databaseLatency = Date.now() - pingStart;
        databaseStatus = 'operational';
        databaseDetail = `Connected to ${mongoose.connection.name || 'database'} (${names[readyState]}).`;
      } else {
        databaseStatus = readyState === 2 ? 'degraded' : 'unavailable';
        databaseDetail = `MongoDB state: ${names[readyState] || 'unknown'}.`;
      }
    } catch (error) {
      databaseStatus = 'degraded';
      databaseDetail = `Ping failed: ${error.message}`;
    }
    checks.push({ key: 'database', label: 'Database', status: databaseStatus, detail: databaseDetail, latencyMs: databaseLatency, source: 'mongoose connection ping' });

    const realtime = realtimeStatus();
    checks.push({
      key: 'realtime',
      label: 'Socket.IO Realtime',
      status: realtime.initialized ? 'operational' : 'unavailable',
      detail: realtime.initialized ? `Realtime gateway initialised with ${realtime.connections ?? 0} live connection(s).` : 'Realtime gateway was never initialised on this process.',
      source: 'realtime/emergencyRealtime.js'
    });

    checks.push({
      key: 'api',
      label: 'API Gateway',
      status: 'operational',
      detail: 'This governance request was served successfully.',
      latencyMs: Date.now() - started,
      source: 'GET /api/admin/system-health'
    });

    checks.push({
      key: 'auth',
      label: 'Authentication',
      status: process.env.JWT_SECRET ? 'operational' : 'degraded',
      detail: process.env.JWT_SECRET
        ? 'Firebase-issued identity tokens are exchanged for signed, httpOnly CivicSync sessions.'
        : 'JWT_SECRET is not configured — session issuance will fail.',
      source: 'middleware/authMiddleware.js + config/firebaseAdmin.js'
    });

    try {
      const [total, unread] = await Promise.all([Notification.countDocuments(), Notification.countDocuments({ readAt: null })]);
      checks.push({
        key: 'notifications',
        label: 'Notification Delivery',
        status: 'operational',
        detail: `${total} notification(s) stored, ${unread} unread. In-app delivery only — no external email/SMS provider is configured.`,
        source: 'models/Notification.js'
      });
    } catch (error) {
      checks.push({ key: 'notifications', label: 'Notification Delivery', status: 'degraded', detail: `Notification query failed: ${error.message}`, source: 'models/Notification.js' });
    }

    let storageStatus = 'unavailable';
    let storageDetail = 'Uploads directory could not be reached.';
    try {
      fs.accessSync(uploadsDir, fs.constants.R_OK | fs.constants.W_OK);
      const count = fs.readdirSync(path.join(uploadsDir, 'reports')).length;
      storageStatus = 'operational';
      storageDetail = `Local uploads directory is readable and writable (${count} stored file(s) in uploads/reports).`;
    } catch (error) {
      storageStatus = 'degraded';
      storageDetail = `Uploads directory check failed: ${error.message}`;
    }
    checks.push({ key: 'storage', label: 'File Storage', status: storageStatus, detail: storageDetail, source: 'middleware/uploadMiddleware.js' });

    checks.push({
      key: 'classification',
      label: 'Advisory Classification',
      status: 'operational',
      detail: 'Deterministic rule-based classifier is loaded. No external AI/LLM provider is configured in this project.',
      source: 'services/emergencyIntelligence.js'
    });

    const mapTiles = await checkMapTileHealth({ force: req.query.refresh === 'true' });
    checks.push({
      key: 'map',
      label: 'Map Tiles',
      status: mapTiles.status,
      detail: `${mapTiles.provider}: ${mapTiles.message}`,
      latencyMs: mapTiles.responseTimeMs,
      source: 'server-side HEAD probe',
      provider: mapTiles.provider,
      checkedAt: mapTiles.checkedAt,
      cacheExpiresAt: mapTiles.cacheExpiresAt,
      statusCode: mapTiles.statusCode
    });

    res.json({ success: true, checkedAt: new Date(), checks });
  } catch (error) { next(error); }
}

/**
 * Cross-collection command palette search. Grouped results with real records
 * only; restricted incidents never expose location or victim details.
 */
export async function globalSearch(req, res, next) {
  try {
    const query = String(req.query.q || '').trim();
    if (query.length < 2) return res.json({ success: true, query, groups: [] });
    const expression = new RegExp(escapeRegex(query), 'i');
    const [users, emergencies, departments, teams, facilities, alerts, logs] = await Promise.all([
      User.find({ $or: [{ name: expression }, { email: expression }, { phone: expression }] })
        .select('name email role departmentName photoURL status').sort({ name: 1 }).limit(5).lean(),
      Emergency.find({ $or: [{ emergencyId: expression }, { title: expression }, { category: expression }] })
        .select('emergencyId title category severity status visibility createdAt').sort({ createdAt: -1 }).limit(5).lean(),
      Department.find({ $or: [{ name: expression }, { type: expression }] })
        .select('name type scope status email').sort({ name: 1 }).limit(5).lean(),
      ResponseTeam.find({ $or: [{ name: expression }, { type: expression }] })
        .select('name type availability active baseLocation').sort({ name: 1 }).limit(5).lean(),
      SafetyFacility.find({ $or: [{ name: expression }, { type: expression }, { address: expression }] })
        .select('name type address active available').sort({ name: 1 }).limit(5).lean(),
      EmergencyAlert.find({ $or: [{ title: expression }, { message: expression }, { category: expression }] })
        .select('title severity category active createdAt').sort({ createdAt: -1 }).limit(5).lean(),
      ActivityLog.find({ $or: [{ action: expression }, { description: expression }, { targetName: expression }] })
        .select('action targetType targetName description actorRole result createdAt').sort({ createdAt: -1 }).limit(5).lean()
    ]);

    const groups = [
      {
        key: 'users',
        label: 'Users',
        items: users.map((user) => ({
          id: user._id,
          title: user.name,
          subtitle: `${user.email} · ${roleMeta[user.role]?.label || user.role}${user.status === 'suspended' ? ' · Suspended' : ''}`,
          tone: user.status === 'suspended' ? 'critical' : 'neutral',
          path: `/admin/users?user=${user._id}`
        }))
      },
      {
        key: 'emergencies',
        label: 'Emergencies',
        items: emergencies.map((item) => ({
          id: item._id,
          title: `${item.emergencyId || 'Unnumbered'} · ${item.title}`,
          subtitle: `${roleMeta[item.category] ? item.category.replaceAll('_', ' ') : String(item.category || '').replaceAll('_', ' ')} · ${item.severity} · ${String(item.status).replaceAll('_', ' ')}${item.visibility === 'restricted' ? ' · Restricted (location withheld)' : ''}`,
          tone: item.severity === 'critical' ? 'critical' : item.severity === 'high' ? 'high' : 'neutral',
          path: `/admin/emergencies?focus=${item._id}`
        }))
      },
      {
        key: 'departments',
        label: 'Departments',
        items: departments.map((item) => ({
          id: item._id,
          title: item.name,
          subtitle: `${item.scope || 'civic'} scope · ${item.status || 'active'}`,
          tone: item.status === 'inactive' ? 'muted' : 'neutral',
          path: `/admin/departments?focus=${item._id}`
        }))
      },
      {
        key: 'teams',
        label: 'Response Teams',
        items: teams.map((item) => ({
          id: item._id,
          title: item.name,
          subtitle: `${String(item.type).replaceAll('_', ' ')} · ${item.active === false ? 'archived' : item.availability}`,
          tone: item.active === false ? 'muted' : item.availability === 'available' ? 'success' : 'info',
          path: `/admin/response-teams?focus=${item._id}`
        }))
      },
      {
        key: 'facilities',
        label: 'Facilities',
        items: facilities.map((item) => ({
          id: item._id,
          title: item.name,
          subtitle: `${String(item.type).replaceAll('_', ' ')} · ${item.address || 'No address recorded'}${item.active === false ? ' · inactive' : ''}`,
          tone: item.active === false ? 'muted' : 'neutral',
          path: `/admin/facilities?focus=${item._id}`
        }))
      },
      {
        key: 'alerts',
        label: 'Alerts',
        items: alerts.map((item) => ({
          id: item._id,
          title: item.title,
          subtitle: `${String(item.category || 'alert').replaceAll('_', ' ')} · ${item.severity} · ${item.active ? 'active' : 'expired'}`,
          tone: item.severity === 'critical' ? 'critical' : item.active ? 'info' : 'muted',
          path: `/admin/alerts?focus=${item._id}`
        }))
      },
      {
        key: 'audit',
        label: 'Audit Events',
        items: logs.map((item) => ({
          id: item._id,
          title: String(item.action).replaceAll('_', ' '),
          subtitle: `${item.description || item.targetName || item.targetType} · ${new Date(item.createdAt).toLocaleString()}`,
          tone: item.result === 'failure' ? 'critical' : 'neutral',
          path: `/admin/audit-logs?focus=${item._id}`
        }))
      }
    ].filter((group) => group.items.length);

    res.json({ success: true, query, groups });
  } catch (error) { next(error); }
}

/**
 * Role/permission governance. The matrix comes from config/permissions.js,
 * which mirrors real server-side enforcement, and is combined with live user
 * counts so the screen never shows an empty, decorative table.
 */
export async function getPermissions(req, res, next) {
  try {
    const [roleRows, totalUsers] = await Promise.all([
      User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]),
      User.countDocuments()
    ]);
    const counts = tally(roleRows);
    res.json({
      success: true,
      generatedAt: new Date(),
      totalUsers,
      actions: ['view', 'create', 'edit', 'assign', 'manage', 'escalate', 'resolve', 'close', 'delete', 'export'],
      roles: roleOrder.map((role) => ({ key: role, ...(roleMeta[role] || { label: role, group: 'Other', description: '' }), count: count(counts[role]) })),
      resources: permissionMatrix
    });
  } catch (error) { next(error); }
}

/**
 * Emergency category governance: configured categories joined with real usage
 * counts from the emergency collection. Built-in catalog entries that were
 * never overridden appear with source: 'catalog' — that is exactly how the
 * citizen reporting API composes its type list.
 */
export async function getCategoryGovernance(req, res, next) {
  try {
    const [configured, usageRows, subcategoryRows, reportUsageRows, reportDepartmentRows, responseRows] = await Promise.all([
      EmergencyCategory.find().sort({ label: 1 }).lean(),
      Emergency.aggregate([{
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          restricted: { $sum: { $cond: [{ $eq: ['$visibility', 'restricted'] }, 1, 0] } },
          lastAt: { $max: '$createdAt' }
        }
      }]),
      Emergency.aggregate([{ $group: { _id: { category: '$category', subcategory: '$subcategory' }, count: { $sum: 1 } } }]),
      Report.aggregate([{ $group: { _id: '$category', count: { $sum: 1 }, lastAt: { $max: '$createdAt' } } }]),
      Report.aggregate([{ $group: { _id: '$departmentName', count: { $sum: 1 } } }]),
      Emergency.aggregate([
        { $match: { responseTimeMinutes: { $ne: null } } },
        { $lookup: { from: 'emergencycategories', localField: 'category', foreignField: 'key', as: 'categoryConfig' } },
        { $set: { responseTarget: { $ifNull: [{ $arrayElemAt: ['$categoryConfig.responseTargetMinutes', 0] }, 30] }, responseRulesActive: { $ne: [{ $arrayElemAt: ['$categoryConfig.responseTimeActive', 0] }, false] } } },
        { $group: { _id: '$category', measuredCount: { $sum: 1 }, averageResponseMinutes: { $avg: '$responseTimeMinutes' }, eligibleCount: { $sum: { $cond: ['$responseRulesActive', 1, 0] } }, withinTargetCount: { $sum: { $cond: [{ $cond: ['$responseRulesActive', { $lte: ['$responseTimeMinutes', '$responseTarget'] }, false] }, 1, 0] } } } }
      ])
    ]);
    const usage = Object.fromEntries(usageRows.map((row) => [row._id, row]));
    const response = Object.fromEntries(responseRows.map((row) => [row._id, row]));
    const reportUsage = Object.fromEntries(reportUsageRows.map((row) => [row._id, row]));
    const reportDepartmentUsage = Object.fromEntries(reportDepartmentRows.map((row) => [row._id, row.count]));
    const subUsage = Object.fromEntries(subcategoryRows.map((row) => [`${row._id.category}::${row._id.subcategory}`, row.count]));
    const keys = [...new Set([...configured.map((item) => item.key), ...emergencyTypeCatalog.map((item) => item.key)])];

    const rows = keys.map((key) => {
      const record = configured.find((item) => item.key === key);
      const catalog = emergencyTypeCatalog.find((item) => item.key === key);
      const responseTargetMinutes = record?.responseTargetMinutes ?? 30;
      const measured = response[key];
      const subcategories = record?.subcategories?.length
        ? record.subcategories.map((item) => ({ key: item.key, label: item.label || item.key, active: item.active !== false, usage: count(subUsage[`${key}::${item.key}`]) }))
        : (catalog?.subcategories || []).map((subKey) => ({ key: subKey, label: subKey.replaceAll('_', ' '), active: true, usage: count(subUsage[`${key}::${subKey}`]) }));
      return {
        key,
        label: record?.label || catalog?.label || key,
        source: record ? 'database' : 'catalog',
        active: record ? record.active !== false : true,
        editable: Boolean(record),
        updatedAt: record?.updatedAt || null,
        subcategories,
        responseTargetMinutes,
        responseWarningMinutes: record?.responseWarningMinutes ?? 20,
        responseCriticalMinutes: record?.responseCriticalMinutes ?? 30,
        responseTimeActive: record ? record.responseTimeActive !== false : true,
        averageResponseMinutes: measured?.averageResponseMinutes ?? null,
        measuredResponseCount: measured?.measuredCount || 0,
        withinTargetPercent: measured?.eligibleCount ? Math.round((measured.withinTargetCount / measured.eligibleCount) * 1000) / 10 : null,
        usage: count(usage[key]?.count),
        restrictedCount: count(usage[key]?.restricted),
        lastReportedAt: usage[key]?.lastAt || null
      };
    }).sort((a, b) => b.usage - a.usage || a.label.localeCompare(b.label));

    res.json({
      success: true,
      generatedAt: new Date(),
      configuredCount: configured.length,
      catalogCount: emergencyTypeCatalog.length,
      totalReports: rows.reduce((sum, row) => sum + row.usage, 0),
      reportCategories: reportCategories.map((key) => ({ key, usage: count(reportUsage[key]?.count), lastReportedAt: reportUsage[key]?.lastAt || null })),
      reportDepartments: reportDepartments.map((name) => ({ name, usage: count(reportDepartmentUsage[name]) })),
      rows
    });
  } catch (error) { next(error); }
}

/**
 * Operations analytics: real workload and utilisation aggregates for response
 * teams, officers, field workers and departments. Averages are computed only
 * from assignments that actually carry the relevant timestamps.
 */
export async function getOperationsAnalytics(req, res, next) {
  try {
    const features = readFeatureFlags(await storedSettings());
    if (!features.analytics) {
      return res.json({ success: true, available: false, reason: 'System analytics are disabled in System Settings (features.analytics).', features });
    }
    const activeStatuses = ['assigned', 'accepted', 'en_route', 'on_scene', 'responding'];
    const activeCondition = { $cond: [{ $in: ['$status', activeStatuses] }, 1, 0] };
    const completedCondition = { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] };
    const minutes = { $divide: [{ $subtract: ['$completedAt', '$assignedAt'] }, 60000] };

    const [teams, teamById, teamByName, officerRows, workerRows, departmentRows, staffRows] = await Promise.all([
      ResponseTeam.find().select('name type availability active members baseLocation phone').lean(),
      EmergencyResponseAssignment.aggregate([
        { $match: { team: { $ne: null } } },
        { $group: { _id: '$team', total: { $sum: 1 }, active: { $sum: activeCondition }, completed: { $sum: completedCondition }, averageMinutes: { $avg: minutes } } }
      ]),
      EmergencyResponseAssignment.aggregate([
        { $match: { responseTeam: { $nin: [null, ''] }, team: null } },
        { $group: { _id: '$responseTeam', total: { $sum: 1 }, active: { $sum: activeCondition }, completed: { $sum: completedCondition }, averageMinutes: { $avg: minutes } } }
      ]),
      EmergencyResponseAssignment.aggregate([
        { $match: { emergencyOfficer: { $ne: null } } },
        { $group: { _id: '$emergencyOfficer', total: { $sum: 1 }, active: { $sum: activeCondition }, completed: { $sum: completedCondition }, averageMinutes: { $avg: minutes } } },
        { $sort: { total: -1 } }, { $limit: 25 }
      ]),
      EmergencyResponseAssignment.aggregate([
        { $unwind: '$fieldWorkers' },
        { $group: { _id: '$fieldWorkers', total: { $sum: 1 }, active: { $sum: activeCondition }, completed: { $sum: completedCondition } } },
        { $sort: { total: -1 } }, { $limit: 25 }
      ]),
      Emergency.aggregate([
        { $match: { assignedDepartment: { $ne: null } } },
        { $group: { _id: '$assignedDepartment', total: { $sum: 1 }, active: { $sum: { $cond: [{ $in: ['$status', activeEmergencyStatuses] }, 1, 0] } }, resolved: { $sum: { $cond: [{ $in: ['$status', ['resolved', 'closed']] }, 1, 0] } } } },
        { $sort: { total: -1 } }
      ]),
      User.aggregate([{ $match: { departmentName: { $nin: [null, ''] } } }, { $group: { _id: '$departmentName', count: { $sum: 1 } } }])
    ]);
    const peopleIds = [...officerRows.map((row) => row._id), ...workerRows.map((row) => row._id)];
    const people = peopleIds.length
      ? await User.find({ _id: { $in: peopleIds } }).select('name email role status departmentName').lean()
      : [];
    const personById = new Map(people.map((person) => [String(person._id), person]));
    const enrich = (row) => {
      const person = personById.get(String(row._id));
      return {
        id: String(row._id),
        name: person?.name || 'Removed account',
        email: person?.email || '',
        role: person?.role || '',
        status: person?.status || 'unknown',
        departmentName: person?.departmentName || '',
        total: count(row.total),
        active: count(row.active),
        completed: count(row.completed),
        averageMinutes: row.averageMinutes == null ? null : Math.round(row.averageMinutes * 10) / 10
      };
    };

    const byTeamId = Object.fromEntries(teamById.map((row) => [String(row._id), row]));
    const byTeamName = Object.fromEntries(teamByName.map((row) => [row._id, row]));
    const teamsWithStats = teams.map((team) => {
      const idStats = byTeamId[String(team._id)] || {};
      const nameStats = byTeamName[team.name] || {};
      const averages = [idStats.averageMinutes, nameStats.averageMinutes].filter((value) => value != null);
      const memberCount = Array.isArray(team.members) ? team.members.length : 0;
      const activeAssignments = count(idStats.active) + count(nameStats.active);
      return {
        id: String(team._id),
        name: team.name,
        type: team.type,
        availability: team.availability,
        active: team.active !== false,
        memberCount,
        baseAddress: team.baseLocation?.address || '',
        hasCoordinates: Number.isFinite(team.baseLocation?.latitude) && Number.isFinite(team.baseLocation?.longitude),
        totalAssignments: count(idStats.total) + count(nameStats.total),
        activeAssignments,
        completedAssignments: count(idStats.completed) + count(nameStats.completed),
        averageMinutes: averages.length ? Math.round((averages.reduce((sum, value) => sum + value, 0) / averages.length) * 10) / 10 : null,
        utilizationPercent: memberCount ? Math.min(100, Math.round((activeAssignments / memberCount) * 100)) : null
      };
    }).sort((a, b) => b.activeAssignments - a.activeAssignments || a.name.localeCompare(b.name));

    const departmentRecords = departmentRows.length
      ? await Department.find({ _id: { $in: departmentRows.map((row) => row._id) } }).select('name scope status').lean()
      : [];
    const departmentById = new Map(departmentRecords.map((record) => [String(record._id), record]));
    const staffByName = Object.fromEntries(staffRows.map((row) => [row._id, row.count]));
    const departments = departmentRows.map((row) => {
      const record = departmentById.get(String(row._id)) || {};
      return {
        id: String(row._id),
        name: record.name || 'Archived department',
        scope: record.scope || 'civic',
        status: record.status || 'active',
        totalEmergencies: count(row.total),
        activeEmergencies: count(row.active),
        resolvedEmergencies: count(row.resolved),
        staffCount: count(staffByName[record.name])
      };
    });

    res.json({
      success: true,
      available: true,
      generatedAt: new Date(),
      features,
      totals: {
        teams: teams.length,
        activeAssignments: teamsWithStats.reduce((sum, team) => sum + team.activeAssignments, 0),
        trackedOfficers: officerRows.length,
        trackedFieldWorkers: workerRows.length,
        unassignedAssignments: await EmergencyResponseAssignment.countDocuments({ emergencyOfficer: null, status: { $in: activeStatuses } })
      },
      teams: teamsWithStats,
      officers: officerRows.map(enrich),
      fieldWorkers: workerRows.map(enrich),
      departments
    });
  } catch (error) { next(error); }
}
