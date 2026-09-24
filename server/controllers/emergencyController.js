import mongoose from 'mongoose';
import path from 'node:path';
import Emergency from '../models/Emergency.js';
import EmergencyAlert from '../models/EmergencyAlert.js';
import EmergencyContact from '../models/EmergencyContact.js';
import EmergencyCategory from '../models/EmergencyCategory.js';
import EmergencyResponseAssignment from '../models/EmergencyResponseAssignment.js';
import EmergencyResponderLocation from '../models/EmergencyResponderLocation.js';
import ResponseTeam from '../models/ResponseTeam.js';
import Notification from '../models/Notification.js';
import SystemSetting from '../models/SystemSetting.js';
import ActivityLog from '../models/ActivityLog.js';
import User from '../models/User.js';
import { emergencyUploadDir } from '../middleware/uploadMiddleware.js';
import { emitEmergencyEvent } from '../realtime/emergencyRealtime.js';
import { canTransitionAssignment, canTransitionEmergency } from '../services/emergencyLifecycle.js';
import { evaluateEmergencySla } from '../services/emergencySla.js';
import { sanitizeSettings } from '../config/settingsDefaults.js';
import { activeEmergencyStatuses, alertCategories, alertStatuses, assignmentStatuses, emergencyCategories, emergencyRoleGroups, emergencySeverities, emergencyStatuses, emergencyTypeCatalog, responseTypes, sensitiveCategories } from '../config/emergencyOptions.js';
import { haversineKm, isSensitiveCategory, suggestEmergencyClassification, suggestedTeamTypes } from '../services/emergencyIntelligence.js';
import { getEmergencyNextAction } from '../services/nextAction.js';

const commandRoles = emergencyRoleGroups.command;
const staffRoles = emergencyRoleGroups.allStaff;
const terminalStatuses = ['resolved', 'closed', 'cancelled', 'false_report'];
const clean = (value, max = 1000) => String(value || '').trim().slice(0, max);
const title = (value = '') => value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const isId = (value) => mongoose.Types.ObjectId.isValid(value);
async function validCategory(value) {
  if (typeof value !== 'string' || !value) return false;
  return emergencyCategories.includes(value) || Boolean(await EmergencyCategory.exists({ key: value, active: true }));
}

function commandAccess(user) { return commandRoles.includes(user.role); }
function sameId(value, userId) {
  const id = value?._id || value;
  return Boolean(id && String(id) === String(userId));
}
function participant(emergency, userId) {
  return sameId(emergency.citizen, userId) || sameId(emergency.emergencyHead, userId) || emergency.responseAssignments.some((assignment) => sameId(assignment.emergencyOfficer, userId) || assignment.fieldWorkers.some((worker) => sameId(worker, userId)));
}
function participantIds(emergency) {
  return [emergency.citizen, emergency.emergencyHead, ...emergency.responseAssignments.flatMap((assignment) => [assignment.emergencyOfficer, ...(assignment.fieldWorkers || [])])].map((value) => value?._id || value).filter(Boolean);
}

function responseStatus(status) {
  return ({ dispatched: 'assigned', en_route: 'en_route', on_scene: 'on_scene', responding: 'responding', resolved: 'completed' })[status] || null;
}
async function audit(user, action, emergency, description = '', targetType = 'emergency') {
  if (!user?._id) return;
  await ActivityLog.create({ admin: user._id, actorRole: user.role || '', action, targetType, targetId: emergency._id, targetName: emergency.emergencyId || emergency.title, description, result: 'success' }).catch(() => {});
}
async function notify(recipient, emergency, message) {
  if (!recipient) return;
  await Notification.create({ recipient, relatedType: 'emergency', relatedId: emergency._id, type: 'system', message }).catch(() => {});
}
async function identifier() {
  const latest = await Emergency.findOne({ emergencyId: /^EM-\d+$/ }).sort({ emergencyId: -1 }).select('emergencyId').lean();
  const lastNumber = latest ? Number(String(latest.emergencyId).slice(3)) : 1000;
  return `EM-${String(lastNumber + 1).padStart(5, '0')}`;
}
async function populatedEmergency(id) {
  return Emergency.findById(id)
    .populate('citizen', 'name email phone')
    .populate('emergencyHead', 'name email role')
    .populate({ path: 'responseAssignments', populate: [{ path: 'emergencyOfficer', select: 'name email phone role' }, { path: 'fieldWorkers', select: 'name email phone role' }] });
}
async function loadEmergencySettings() {
  const record = await SystemSetting.findOne({ key: 'admin_portal' }).lean().catch(() => null);
  return sanitizeSettings(record?.value || {}, {}).settings;
}
async function emergencyWithSla(emergency, viewer, summary = false, settingsOverride = null) {
  const value = emergencyForViewer(emergency, viewer, summary);
  const settings = settingsOverride || await loadEmergencySettings();
  value.sla = evaluateEmergencySla(emergency, settings);
  value.nextAction = getEmergencyNextAction(value, value.sla);
  return value;
}
function emergencyForViewer(emergency, viewer, summary = false) {
  const value = typeof emergency?.toObject === 'function' ? emergency.toObject() : { ...(emergency || {}) };
  if (['emergency_department_officer', 'emergency_officer', 'emergency_field_worker'].includes(viewer?.role)) {
    delete value.citizenPhone;
    delete value.citizenEmail;
    if (value.citizen && typeof value.citizen === 'object') {
      delete value.citizen.email;
      delete value.citizen.phone;
    }
    delete value.sosContacts;
    if (summary) {
      delete value.personDetails;
      delete value.evidence;
      delete value.activity;
    }
  }
  return value;
}
async function scopedEmergency(req, res) {
  if (!isId(req.params.id)) { res.status(404).json({ success: false, message: 'Emergency not found.' }); return null; }
  const emergency = await populatedEmergency(req.params.id);
  if (!emergency || (!commandAccess(req.user) && !participant(emergency, req.user._id))) { res.status(404).json({ success: false, message: 'Emergency not found.' }); return null; }
  return emergency;
}

function sanitizePersonDetails(raw) {
  if (!raw || typeof raw !== 'object') return undefined;
  const lastSeen = raw.lastSeenAt && !Number.isNaN(Date.parse(raw.lastSeenAt)) ? new Date(raw.lastSeenAt) : null;
  const latitudeInput = raw.lastKnownLatitude;
  const longitudeInput = raw.lastKnownLongitude;
  const latitude = Number(latitudeInput);
  const longitude = Number(longitudeInput);
  const hasLatitude = latitudeInput !== undefined && latitudeInput !== null && latitudeInput !== '';
  const hasLongitude = longitudeInput !== undefined && longitudeInput !== null && longitudeInput !== '';
  if (hasLatitude !== hasLongitude || (hasLatitude && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180))) return null;
  return {
    name: clean(raw.name, 120),
    age: clean(raw.age, 10),
    photoUrl: clean(raw.photoUrl, 500),
    description: clean(raw.description, 1000),
    clothing: clean(raw.clothing, 300),
    additionalInfo: clean(raw.additionalInfo, 1000),
    lastSeenAt: lastSeen,
    lastKnownLocation: {
      address: clean(raw.lastKnownAddress, 300),
      ...(Number.isFinite(latitude) ? { latitude } : {}),
      ...(Number.isFinite(longitude) ? { longitude } : {})
    }
  };
}

export async function createEmergency(req, res, next) {
  try {
    if (req.body.category !== undefined && !(await validCategory(req.body.category))) return res.status(400).json({ success: false, message: 'Select a valid emergency category.' });
    if (req.body.severity !== undefined && !emergencySeverities.includes(req.body.severity)) return res.status(400).json({ success: false, message: 'Select a valid emergency severity.' });
    if (req.body.sos !== undefined && typeof req.body.sos !== 'boolean') return res.status(400).json({ success: false, message: 'sos must be a boolean.' });
    if (req.body.notSafe !== undefined && typeof req.body.notSafe !== 'boolean') return res.status(400).json({ success: false, message: 'notSafe must be a boolean.' });
    const category = req.body.category || 'not_sure';
    const rawLocation = req.body.location && typeof req.body.location === 'object' ? req.body.location : {};
    const location = rawLocation;
    const latitudeInput = location.latitude ?? req.body.latitude;
    const longitudeInput = location.longitude ?? req.body.longitude;
    const latitude = Number(latitudeInput);
    const longitude = Number(longitudeInput);
    const hasLatitude = latitudeInput !== undefined && latitudeInput !== null && latitudeInput !== '';
    const hasLongitude = longitudeInput !== undefined && longitudeInput !== null && longitudeInput !== '';
    if (hasLatitude !== hasLongitude) return res.status(400).json({ success: false, message: 'Provide both latitude and longitude, or omit both.' });
    if (hasLatitude && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180)) return res.status(400).json({ success: false, message: 'Emergency coordinates must be valid latitude/longitude values.' });
    const accuracy = location.accuracy === undefined || location.accuracy === null || location.accuracy === '' ? null : Number(location.accuracy);
    if (accuracy !== null && (!Number.isFinite(accuracy) || accuracy < 0)) return res.status(400).json({ success: false, message: 'Location accuracy must be a non-negative number of metres.' });
    const capturedAtInput = location.timestamp ?? location.capturedAt;
    const capturedAt = capturedAtInput ? new Date(capturedAtInput) : null;
    if (capturedAt && Number.isNaN(capturedAt.getTime())) return res.status(400).json({ success: false, message: 'Location capture timestamp is invalid.' });
    const locationValue = { address: clean(location.address || req.body.address, 300), landmark: clean(location.landmark, 150), accuracy, capturedAt };
    if (hasLatitude) Object.assign(locationValue, { latitude, longitude, point: { type: 'Point', coordinates: [longitude, latitude] } });
    const source = req.body.notSafe ? 'not_safe' : req.body.sos ? 'sos' : 'report';
    // Advisory classification (rule-based; never auto-applied over an explicit citizen choice).
    const suggestion = suggestEmergencyClassification(clean(req.body.title, 140), clean(req.body.description, 2000));
    const visibility = isSensitiveCategory(category) || source === 'not_safe' ? 'restricted' : 'standard';
    // Snapshot enabled SOS contacts so command can reach next-of-kin. No SMS gateway exists in
    // this project, so we never claim contacts were messaged — only that they were recorded.
    const sosContacts = (source === 'sos' || source === 'not_safe')
      ? (await EmergencyContact.find({ citizen: req.user._id, enabledForSos: true }).select('name phone relationship').limit(10).lean())
      : [];
    const personDetails = ['missing_person', 'child_safety'].includes(category) ? sanitizePersonDetails(req.body.personDetails) : undefined;
    if (['missing_person', 'child_safety'].includes(category) && req.body.personDetails && !personDetails) return res.status(400).json({ success: false, message: 'Last known location must include a valid latitude/longitude pair.' });
    const emergency = await Emergency.create({
      emergencyId: await identifier(), citizen: req.user._id, citizenName: req.user.name, citizenPhone: req.user.phone, citizenEmail: req.user.email,
      type: category, category, subcategory: clean(req.body.subcategory || 'other', 80), title: clean(req.body.title || `${title(category)} emergency`, 140),
      description: clean(req.body.description, 2000), severity: emergencySeverities.includes(req.body.severity) ? req.body.severity : (source !== 'report' ? 'critical' : 'high'),
      priority: emergencySeverities.includes(req.body.severity) ? req.body.severity : (source !== 'report' ? 'critical' : 'high'),
      status: 'reported', source, discreet: source === 'not_safe', visibility,
      location: locationValue,
      aiSuggestion: { ...suggestion, suggestedAt: suggestion.suggestedAt },
      ...(personDetails ? { personDetails } : {}),
      ...(sosContacts.length ? { sosContacts: sosContacts.map((contact) => ({ name: contact.name, phone: contact.phone, relationship: contact.relationship })) } : {}),
      activity: [{ action: source === 'sos' ? 'SOS emergency created' : source === 'not_safe' ? '"I\'m Not Safe" discreet emergency created' : 'Emergency reported', actorRole: req.user.role, note: clean(req.body.description, 160) }]
    });
    const heads = await User.find({ role: { $in: commandRoles }, status: 'active' }).select('_id');
    await Promise.all(heads.map((head) => notify(head._id, emergency, `${emergency.severity === 'critical' ? 'Critical ' : ''}emergency ${emergency.emergencyId} reported: ${title(category)}.`)));
    emitEmergencyEvent('EMERGENCY_CREATED', { emergencyId: emergency._id, publicId: emergency.emergencyId, category, severity: emergency.severity }, { userIds: heads.map((head) => head._id), roles: commandRoles });
    emitEmergencyEvent('EMERGENCY_RECEIVED', { emergencyId: emergency._id, publicId: emergency.emergencyId, status: emergency.status }, { userIds: [emergency.citizen] });
    await audit(req.user, 'emergency_created', emergency, `Emergency reported as ${category} (source: ${source}).`);
    res.status(201).json({
      success: true,
      message: 'Emergency command has been notified.',
      emergency: await emergencyWithSla(await populatedEmergency(emergency._id), req.user),
      advisory: { classification: suggestion, note: 'Advisory suggestion only — Emergency Command makes the final classification.' },
      emergencyContacts: { recorded: sosContacts.length, channel: sosContacts.length ? 'recorded_for_command' : 'none', delivery: 'no_sms_gateway_configured' }
    });
  } catch (error) { next(error); }
}

export async function listEmergencies(req, res, next) {
  try {
    const { status = '', severity = '', category = '', search = '', page = 1, limit = 20, sort = 'newest' } = req.query;
    const filter = {};
    if (!commandAccess(req.user)) filter.$or = [{ citizen: req.user._id }, { emergencyHead: req.user._id }, { responseAssignments: { $in: await EmergencyResponseAssignment.find({ $or: [{ emergencyOfficer: req.user._id }, { fieldWorkers: req.user._id }] }).distinct('_id') } }];
    if (emergencyStatuses.includes(status)) filter.status = status;
    if (emergencySeverities.includes(severity)) filter.severity = severity;
    if (emergencyCategories.includes(category) || (category && await EmergencyCategory.exists({ key: category, active: true }))) filter.category = category;
    if (clean(search)) filter.$and = [{ $or: [{ emergencyId: new RegExp(clean(search), 'i') }, { title: new RegExp(clean(search), 'i') }, { 'location.address': new RegExp(clean(search), 'i') }] }];
    const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 50); const safePage = Math.max(Number(page) || 1, 1);
    const sortOrder = sort === 'oldest' ? { createdAt: 1 } : sort === 'severity' ? { severity: -1, createdAt: -1 } : { createdAt: -1 };
    const [emergencies, total] = await Promise.all([Emergency.find(filter).populate('citizen', 'name').populate({ path: 'responseAssignments', populate: { path: 'emergencyOfficer', select: 'name' } }).sort(sortOrder).skip((safePage - 1) * safeLimit).limit(safeLimit), Emergency.countDocuments(filter)]);
    const settings = await loadEmergencySettings();
    res.json({ success: true, emergencies: await Promise.all(emergencies.map((item) => emergencyWithSla(item, req.user, true, settings))), pagination: { page: safePage, limit: safeLimit, total, pages: Math.ceil(total / safeLimit) } });
  } catch (error) { next(error); }
}

export async function getEmergency(req, res, next) { try { const emergency = await scopedEmergency(req, res); if (emergency) res.json({ success: true, emergency: await emergencyWithSla(emergency, req.user) }); } catch (error) { next(error); } }

export async function similarEmergencies(req, res, next) {
  try {
    if (!commandAccess(req.user)) return res.status(403).json({ success: false, message: 'Emergency command access is required.' });
    const emergency = await scopedEmergency(req, res); if (!emergency) return;
    const { latitude, longitude } = emergency.location || {};
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return res.json({ success: true, emergencies: [], message: 'This incident has no GPS location to compare.' });
    const since = new Date(emergency.createdAt.getTime() - 30 * 60 * 1000); const until = new Date(emergency.createdAt.getTime() + 30 * 60 * 1000);
    const emergencies = await Emergency.find({ _id: { $ne: emergency._id }, category: emergency.category, createdAt: { $gte: since, $lte: until }, 'location.latitude': { $gte: latitude - 0.01, $lte: latitude + 0.01 }, 'location.longitude': { $gte: longitude - 0.01, $lte: longitude + 0.01 } }).select('emergencyId title status severity location createdAt').limit(20).lean();
    res.json({ success: true, emergencies });
  } catch (error) { next(error); }
}

export async function mergeEmergency(req, res, next) {
  try {
    if (!commandAccess(req.user)) return res.status(403).json({ success: false, message: 'Only emergency command can merge related incidents.' });
    const master = await scopedEmergency(req, res); if (!master) return;
    const duplicateIds = [...new Set((Array.isArray(req.body.emergencyIds) ? req.body.emergencyIds : []).filter(isId).map(String))].filter((id) => id !== String(master._id));
    if (!duplicateIds.length) return res.status(400).json({ success: false, message: 'Select at least one related incident.' });
    const duplicates = await Emergency.find({ _id: { $in: duplicateIds } });
    if (duplicates.length !== duplicateIds.length) return res.status(404).json({ success: false, message: 'One or more incidents were not found.' });
    await Emergency.updateMany({ _id: { $in: duplicateIds } }, { masterEmergency: master._id, status: 'reassigned' });
    master.relatedEmergencies = [...new Set([...master.relatedEmergencies.map(String), ...duplicateIds])]; master.activity.push({ action: 'Related incidents merged', actorRole: req.user.role, note: `${duplicates.length} report(s) retained and linked to this incident.` }); await master.save();
    await Promise.all(duplicates.map((incident) => notify(incident.citizen, incident, `Your report ${incident.emergencyId} was linked to related incident ${master.emergencyId}; it remains part of the response record.`)));
    await audit(req.user, 'emergency_merged', master, `${duplicates.length} related incidents linked.`); res.json({ success: true, emergency: await populatedEmergency(master._id) });
  } catch (error) { next(error); }
}

export async function uploadEvidence(req, res, next) {
  try {
    const emergency = await scopedEmergency(req, res); if (!emergency) return;
    const files = req.files || [];
    if (!files.length) return res.status(400).json({ success: false, message: 'Select at least one evidence file.' });
    emergency.evidence.push(...files.map((file) => ({ filename: file.filename, originalName: clean(file.originalname, 180), mediaType: file.mimetype.split('/')[0], url: `/api/emergencies/${emergency._id}/evidence/${file.filename}` })));
    emergency.activity.push({ action: 'Evidence uploaded', actorRole: req.user.role, note: `${files.length} file${files.length === 1 ? '' : 's'} added.` });
    await emergency.save(); await audit(req.user, 'emergency_evidence_uploaded', emergency, `${files.length} evidence file(s).`);
    res.status(201).json({ success: true, emergency: emergencyForViewer(await populatedEmergency(emergency._id), req.user) });
  } catch (error) { next(error); }
}

export async function updateResponderLocation(req, res, next) {
  try {
    if (!['emergency_officer', 'emergency_field_worker'].includes(req.user.role)) return res.status(403).json({ success: false, message: 'Only assigned responders can share live location.' });
    const emergency = await scopedEmergency(req, res); if (!emergency) return;
    const latitude = Number(req.body.latitude); const longitude = Number(req.body.longitude); const accuracy = Number(req.body.accuracy);
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) return res.status(400).json({ success: false, message: 'Valid location coordinates are required.' });
    const assignment = emergency.responseAssignments.find((item) => ['assigned', 'accepted', 'en_route', 'on_scene', 'responding'].includes(item.status) && (sameId(item.emergencyOfficer, req.user._id) || item.fieldWorkers.some((worker) => sameId(worker, req.user._id))));
    if (!assignment) return res.status(403).json({ success: false, message: 'You are not assigned to this emergency.' });
    const location = await EmergencyResponderLocation.findOneAndUpdate({ emergency: emergency._id, responder: req.user._id }, { assignment: assignment._id, latitude, longitude, ...(Number.isFinite(accuracy) && accuracy >= 0 ? { accuracy } : {}), recordedAt: new Date() }, { upsert: true, new: true, setDefaultsOnInsert: true });
    const teamIds = [assignment.emergencyOfficer?._id, ...(assignment.fieldWorkers || []).map((worker) => worker?._id || worker)].filter(Boolean);
    emitEmergencyEvent('RESPONDER_LOCATION_UPDATED', { emergencyId: emergency._id, responderId: req.user._id, latitude, longitude, recordedAt: location.recordedAt }, { userIds: teamIds, roles: commandRoles });
    res.json({ success: true, recordedAt: location.recordedAt });
  } catch (error) { next(error); }
}

export async function updateEmergency(req, res, next) {
  try {
    const emergency = await scopedEmergency(req, res); if (!emergency) return;
    const command = commandAccess(req.user); const ownDraft = sameId(emergency.citizen, req.user._id) && ['reported', 'received'].includes(emergency.status);
    if (!command && !ownDraft) return res.status(403).json({ success: false, message: 'This emergency can no longer be edited by the citizen.' });
    const reclassified = {};
    for (const field of ['title', 'description', 'subcategory']) if (req.body[field] !== undefined) emergency[field] = clean(req.body[field], field === 'description' ? 2000 : 140);
    if (command && await validCategory(req.body.category) && req.body.category !== emergency.category) {
      reclassified.from = emergency.category; reclassified.to = req.body.category;
      emergency.category = req.body.category; emergency.type = req.body.category;
      emergency.visibility = isSensitiveCategory(req.body.category) || emergency.discreet ? 'restricted' : 'standard';
      if (emergency.aiSuggestion?.category === req.body.category && !emergency.aiSuggestion.appliedAt) {
        emergency.aiSuggestion.appliedAt = new Date();
        emergency.aiSuggestion.overriddenBy = req.user._id;
      }
    }
    if (command && emergencySeverities.includes(req.body.severity) && req.body.severity !== emergency.severity) {
      reclassified.severity = `${emergency.severity} → ${req.body.severity}`;
      emergency.severity = req.body.severity; emergency.priority = req.body.severity;
    }
    if (command && typeof req.body.note === 'string' && clean(req.body.note, 500)) emergency.notes = clean(req.body.note, 1000);
    if (req.body.location && (command || ownDraft)) {
      const rawLocation = req.body.location && typeof req.body.location === 'object' ? req.body.location : {};
      const hasLatitude = rawLocation.latitude !== undefined && rawLocation.latitude !== null && rawLocation.latitude !== '';
      const hasLongitude = rawLocation.longitude !== undefined && rawLocation.longitude !== null && rawLocation.longitude !== '';
      if (hasLatitude !== hasLongitude) return res.status(400).json({ success: false, message: 'Provide both latitude and longitude, or omit both.' });
      const nextLatitude = Number(rawLocation.latitude);
      const nextLongitude = Number(rawLocation.longitude);
      if (hasLatitude && (!Number.isFinite(nextLatitude) || nextLatitude < -90 || nextLatitude > 90 || !Number.isFinite(nextLongitude) || nextLongitude < -180 || nextLongitude > 180)) return res.status(400).json({ success: false, message: 'Emergency coordinates must be valid latitude/longitude values.' });
      const accuracy = rawLocation.accuracy === undefined || rawLocation.accuracy === null || rawLocation.accuracy === '' ? null : Number(rawLocation.accuracy);
      if (accuracy !== null && (!Number.isFinite(accuracy) || accuracy < 0)) return res.status(400).json({ success: false, message: 'Location accuracy must be a non-negative number of metres.' });
      const capturedAtInput = rawLocation.timestamp ?? rawLocation.capturedAt;
      const capturedAt = capturedAtInput ? new Date(capturedAtInput) : null;
      if (capturedAt && Number.isNaN(capturedAt.getTime())) return res.status(400).json({ success: false, message: 'Location capture timestamp is invalid.' });
      emergency.location = {
        ...emergency.location.toObject(),
        address: clean(rawLocation.address, 300),
        landmark: clean(rawLocation.landmark, 150),
        accuracy,
        capturedAt,
        ...(hasLatitude ? { latitude: nextLatitude, longitude: nextLongitude, point: { type: 'Point', coordinates: [nextLongitude, nextLatitude] } } : {})
      };
    }
    emergency.activity.push({ action: command ? 'Emergency details updated by command' : 'Emergency details updated', actorRole: req.user.role, note: clean(req.body.note, 500) });
    await emergency.save();
    await audit(req.user, 'emergency_updated', emergency);
    if (reclassified.from) await audit(req.user, 'emergency_reclassified', emergency, `${reclassified.from} → ${reclassified.to}`);
    if (reclassified.severity) await audit(req.user, 'emergency_severity_changed', emergency, reclassified.severity);
    res.json({ success: true, emergency: emergencyForViewer(await populatedEmergency(emergency._id), req.user) });
  } catch (error) { next(error); }
}

export async function assignEmergency(req, res, next) {
  try {
    if (!commandAccess(req.user)) return res.status(403).json({ success: false, message: 'Only emergency command can dispatch response teams.' });
    const emergency = await scopedEmergency(req, res); if (!emergency) return;
    if (!activeEmergencyStatuses.includes(emergency.status)) return res.status(409).json({ success: false, message: 'Closed or terminal incidents cannot be dispatched.' });
    const { responseType, responseTeam = '', teamId = '', officerId = '', fieldWorkerIds = [], etaMinutes = null, notes = '' } = req.body;
    if (!clean(responseType, 80)) return res.status(400).json({ success: false, message: 'A response type is required.' });
    let team = null;
    if (teamId) {
      if (!isId(teamId)) return res.status(400).json({ success: false, message: 'Response team is invalid.' });
      team = await ResponseTeam.findById(teamId);
      if (!team || !team.active) return res.status(400).json({ success: false, message: 'Response team not found or inactive.' });
    }
    if (!Array.isArray(fieldWorkerIds)) return res.status(400).json({ success: false, message: 'fieldWorkerIds must be an array.' });
    const requestedWorkerIds = [...new Set(fieldWorkerIds.filter((id) => isId(id)).map(String))];
    if (requestedWorkerIds.length !== fieldWorkerIds.length) return res.status(400).json({ success: false, message: 'Select valid field worker IDs.' });
    const normalizedEta = etaMinutes === null || etaMinutes === '' ? null : Number(etaMinutes);
    if (normalizedEta !== null && (!Number.isFinite(normalizedEta) || normalizedEta < 0 || normalizedEta > 999)) return res.status(400).json({ success: false, message: 'ETA must be between 0 and 999 minutes.' });
    const users = await User.find({ _id: { $in: [officerId, ...requestedWorkerIds].filter(isId) }, role: { $in: ['emergency_officer', 'emergency_field_worker'] }, status: 'active' });
    const officer = officerId ? users.find((user) => String(user._id) === String(officerId) && user.role === 'emergency_officer') : null;
    if (officerId && !officer) return res.status(400).json({ success: false, message: 'Select an active emergency officer.' });
    const workers = users.filter((user) => requestedWorkerIds.includes(String(user._id)) && user.role === 'emergency_field_worker');
    if (workers.length !== requestedWorkerIds.length) return res.status(400).json({ success: false, message: 'Select active emergency field workers.' });
    const assignment = await EmergencyResponseAssignment.create({ emergency: emergency._id, responseType: clean(responseType, 80), responseTeam: clean(responseTeam || team?.name || '', 120), team: team?._id || null, emergencyOfficer: officer?._id || null, fieldWorkers: workers.map((worker) => worker._id), etaMinutes: normalizedEta, notes: clean(notes) });
    emergency.responseAssignments.push(assignment._id);
    emergency.emergencyHead = emergency.emergencyHead || req.user._id;
    if (['reported', 'received', 'assessing', 'verified'].includes(emergency.status)) emergency.status = 'dispatched';
    if (!emergency.dispatchedAt) emergency.dispatchedAt = new Date();
    if (!emergency.acknowledgedAt) emergency.acknowledgedAt = new Date();
    emergency.activity.push({ action: `Response team dispatched: ${clean(responseType, 80)}`, actorRole: req.user.role, note: clean(notes, 500) }); await emergency.save();
    if (team) { team.availability = 'busy'; await team.save().catch(() => {}); }
    await Promise.all([officer, ...workers].filter(Boolean).map((user) => notify(user._id, emergency, `New emergency assignment: ${emergency.emergencyId} (${title(emergency.category)}).`)));
    await notify(emergency.citizen._id, emergency, `A ${title(clean(responseType, 80))} response team has been dispatched to ${emergency.emergencyId}.`);
    emitEmergencyEvent('EMERGENCY_ASSIGNED', { emergencyId: emergency._id, publicId: emergency.emergencyId, assignmentId: assignment._id, responseType: assignment.responseType }, { userIds: [officer?._id, emergency.citizen._id, ...workers.map((worker) => worker._id)], roles: commandRoles });
    if (workers.length) emitEmergencyEvent('FIELD_WORKER_ASSIGNED', { emergencyId: emergency._id, publicId: emergency.emergencyId, assignmentId: assignment._id, fieldWorkerIds: workers.map((worker) => worker._id) }, { userIds: workers.map((worker) => worker._id), roles: commandRoles });
    await audit(req.user, 'emergency_assigned', emergency, clean(responseType, 80)); res.json({ success: true, assignment, emergency: emergencyForViewer(await populatedEmergency(emergency._id), req.user) });
  } catch (error) { next(error); }
}

export async function updateStatus(req, res, next) {
  try {
    const emergency = await scopedEmergency(req, res); if (!emergency) return;
    if (!commandAccess(req.user)) return res.status(403).json({ success: false, message: 'Only emergency command can update the incident status.' });
    const { status, note = '' } = req.body;
    if (!emergencyStatuses.includes(status)) return res.status(400).json({ success: false, message: 'Invalid emergency status.' });
    const previous = emergency.status;
    if (previous === status) return res.status(400).json({ success: false, message: 'The emergency is already in that status.' });
    if (!canTransitionEmergency(previous, status)) return res.status(409).json({ success: false, message: `Invalid status transition from ${title(previous)} to ${title(status)}.` });
    emergency.status = status;
    if (['received', 'assessing', 'verified'].includes(status) && !emergency.acknowledgedAt) emergency.acknowledgedAt = new Date();
    if (status === 'dispatched' && !emergency.dispatchedAt) emergency.dispatchedAt = new Date();
    if (status === 'en_route' && !emergency.enRouteAt) emergency.enRouteAt = new Date();
    if (status === 'on_scene') {
      if (!emergency.arrivalAt) emergency.arrivalAt = new Date();
      if (emergency.responseTimeMinutes == null) emergency.responseTimeMinutes = Math.round((emergency.arrivalAt.getTime() - emergency.createdAt.getTime()) / 60000);
    }
    if (status === 'resolved' && emergency.responseAssignments.length) {
      const openAssignments = emergency.responseAssignments.filter((assignment) => !['completed', 'cancelled'].includes(assignment.status));
      if (openAssignments.length) return res.status(409).json({ success: false, message: 'Complete or cancel every response assignment before resolving the incident.' });
    }
    if (status === 'resolved') { emergency.resolvedAt = new Date(); emergency.resolutionNotes = clean(note, 2000); }
    if (status === 'closed') emergency.closedAt = new Date();
    const activityEntry = { action: `Status changed from ${title(previous)} to ${title(status)}`, actorRole: req.user.role, note: clean(note, 500) };
    const statusUpdate = {
      status: emergency.status,
      ...(emergency.acknowledgedAt ? { acknowledgedAt: emergency.acknowledgedAt } : {}),
      ...(emergency.dispatchedAt ? { dispatchedAt: emergency.dispatchedAt } : {}),
      ...(emergency.enRouteAt ? { enRouteAt: emergency.enRouteAt } : {}),
      ...(emergency.arrivalAt ? { arrivalAt: emergency.arrivalAt } : {}),
      ...(emergency.responseTimeMinutes != null ? { responseTimeMinutes: emergency.responseTimeMinutes } : {}),
      ...(status === 'resolved' ? { resolvedAt: emergency.resolvedAt, resolutionNotes: emergency.resolutionNotes } : {}),
      ...(status === 'closed' ? { closedAt: emergency.closedAt } : {})
    };
    const changed = await Emergency.updateOne({ _id: emergency._id, status: previous }, { $set: statusUpdate, $push: { activity: activityEntry } });
    if (changed.modifiedCount !== 1) return res.status(409).json({ success: false, message: 'The incident changed while this update was being saved. Refresh and try again.' });
    emergency.activity.push(activityEntry);
    const citizenId = emergency.citizen?._id || emergency.citizen;
    await notify(citizenId, emergency, `Emergency ${emergency.emergencyId} is now ${title(status)}.`);
    await audit(req.user, 'emergency_status_changed', emergency, `${previous} → ${status}`);
    emitEmergencyEvent(status === 'resolved' ? 'EMERGENCY_RESOLVED' : 'EMERGENCY_STATUS_CHANGED', { emergencyId: emergency._id, publicId: emergency.emergencyId, status }, { userIds: participantIds(emergency), roles: commandRoles });
    res.json({ success: true, emergency: emergencyForViewer(await populatedEmergency(emergency._id), req.user) });
  } catch (error) { next(error); }
}

export async function escalateEmergency(req, res, next) {
  try { if (!commandAccess(req.user)) return res.status(403).json({ success: false, message: 'Only emergency command can escalate an incident.' }); const emergency = await scopedEmergency(req, res); if (!emergency) return; if (!activeEmergencyStatuses.includes(emergency.status) || emergency.status === 'escalated' || !canTransitionEmergency(emergency.status, 'escalated')) return res.status(409).json({ success: false, message: 'This incident cannot be escalated from its current status.' }); emergency.status = 'escalated'; emergency.severity = 'critical'; emergency.priority = 'critical'; emergency.escalation = { escalatedAt: new Date(), escalatedBy: req.user._id, reason: clean(req.body.reason, 1000) }; emergency.activity.push({ action: 'Emergency escalated', actorRole: req.user.role, note: clean(req.body.reason, 500) }); await emergency.save(); await audit(req.user, 'emergency_escalated', emergency, emergency.escalation.reason); emitEmergencyEvent('EMERGENCY_ESCALATED', { emergencyId: emergency._id, publicId: emergency.emergencyId, reason: emergency.escalation.reason }, { userIds: participantIds(emergency), roles: commandRoles }); res.json({ success: true, emergency: emergencyForViewer(await populatedEmergency(emergency._id), req.user) }); } catch (error) { next(error); }
}
export async function backupEmergency(req, res, next) {
  try {
    const emergency = await scopedEmergency(req, res); if (!emergency) return;
    if (!staffRoles.includes(req.user.role)) return res.status(403).json({ success: false, message: 'Only emergency staff can request backup.' });
    if (!activeEmergencyStatuses.includes(emergency.status) || emergency.status === 'requires_backup' || !canTransitionEmergency(emergency.status, 'requires_backup')) return res.status(409).json({ success: false, message: 'Backup cannot be requested from the current incident status.' });
    emergency.status = 'requires_backup';
    emergency.activity.push({ action: 'Backup requested', actorRole: req.user.role, note: clean(req.body.reason, 500) });
    await emergency.save();
    const heads = await User.find({ role: { $in: commandRoles }, status: 'active' }).select('_id');
    const involvedOfficerIds = (await EmergencyResponseAssignment.find({ _id: { $in: emergency.responseAssignments } }).select('emergencyOfficer').lean()).map((row) => row.emergencyOfficer).filter(Boolean);
    await Promise.all([
      ...heads.map((head) => notify(head._id, emergency, `Backup requested for ${emergency.emergencyId}.`)),
      ...involvedOfficerIds.map((officerId) => notify(officerId, emergency, `Backup requested on ${emergency.emergencyId} — review nearby available teams.`))
    ]);
    await audit(req.user, 'backup_requested', emergency, clean(req.body.reason));
    const recipients = [...new Set([...heads.map((head) => head._id), ...involvedOfficerIds, ...participantIds(emergency)].map((value) => value?._id || value))];
    emitEmergencyEvent('BACKUP_REQUESTED', { emergencyId: emergency._id, publicId: emergency.emergencyId, reason: clean(req.body.reason, 500) }, { userIds: recipients, roles: commandRoles });
    res.json({ success: true, emergency: emergencyForViewer(await populatedEmergency(emergency._id), req.user) });
  } catch (error) { next(error); }
}
export async function resolveEmergency(req, res, next) { req.body.status = 'resolved'; return updateStatus(req, res, next); }
export async function closeEmergency(req, res, next) { if (!commandAccess(req.user)) return res.status(403).json({ success: false, message: 'Only emergency command can close an incident.' }); req.body.status = 'closed'; return updateStatus(req, res, next); }

export async function dashboard(req, res, next) {
  try {
    if (!staffRoles.includes(req.user.role)) return res.status(403).json({ success: false, message: 'Emergency staff access is required.' });
    const scope = commandAccess(req.user) ? {} : { responseAssignments: { $in: await EmergencyResponseAssignment.find({ $or: [{ emergencyOfficer: req.user._id }, { fieldWorkers: req.user._id }] }).distinct('_id') } };
    const [statusRows, severityRows, recent, assignments] = await Promise.all([Emergency.aggregate([{ $match: scope }, { $group: { _id: '$status', count: { $sum: 1 } } }]), Emergency.aggregate([{ $match: { ...scope, status: { $in: activeEmergencyStatuses } } }, { $group: { _id: '$severity', count: { $sum: 1 } } }]), Emergency.find({ ...scope, status: { $in: activeEmergencyStatuses } }).populate('citizen', 'name').populate('responseAssignments').sort({ severity: -1, createdAt: -1 }).limit(12), EmergencyResponseAssignment.find(commandAccess(req.user) ? { status: { $in: ['assigned', 'accepted', 'en_route', 'on_scene', 'responding'] } } : { status: { $in: ['assigned', 'accepted', 'en_route', 'on_scene', 'responding'] }, $or: [{ emergencyOfficer: req.user._id }, { fieldWorkers: req.user._id }] }).populate('emergencyOfficer', 'name').populate('fieldWorkers', 'name').limit(10)]);
    const activeAssignmentCount = await EmergencyResponseAssignment.countDocuments(commandAccess(req.user) ? { status: { $in: ['assigned', 'accepted', 'en_route', 'on_scene', 'responding'] } } : { status: { $in: ['assigned', 'accepted', 'en_route', 'on_scene', 'responding'] }, $or: [{ emergencyOfficer: req.user._id }, { fieldWorkers: req.user._id }] });
    const statuses = Object.fromEntries(statusRows.map((row) => [row._id, row.count])); const severity = Object.fromEntries(severityRows.map((row) => [row._id, row.count]));
    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
    const resolvedToday = await Emergency.countDocuments({ ...scope, status: { $in: ['resolved', 'closed'] }, resolvedAt: { $gte: startOfDay } });
    const settings = await loadEmergencySettings();
    res.json({ success: true, stats: { total: activeEmergencyStatuses.reduce((sum, status) => sum + (statuses[status] || 0), 0), critical: severity.critical || 0, assigned: activeAssignmentCount, awaitingAssignment: (statuses.reported || 0) + (statuses.received || 0) + (statuses.verified || 0) + (statuses.assessing || 0), responding: (statuses.dispatched || 0) + (statuses.en_route || 0) + (statuses.responding || 0) + (statuses.escalated || 0) + (statuses.requires_backup || 0), onScene: statuses.on_scene || 0, resolvedToday }, recent: await Promise.all(recent.map((item) => emergencyWithSla(item, req.user, true, settings))), assignments });
  } catch (error) { next(error); }
}

export async function mapEmergencies(req, res, next) {
  try {
    if (!commandAccess(req.user)) return res.status(403).json({ success: false, message: 'Only emergency command can view global active incident locations.' });
    const filter = { 'location.latitude': { $ne: null }, 'location.longitude': { $ne: null } };
    if (req.query.category && await validCategory(req.query.category)) filter.category = req.query.category;
    if (req.query.status === 'all') {
      // Explicitly all statuses for historical command review.
    } else if (req.query.status && emergencyStatuses.includes(req.query.status)) {
      filter.status = req.query.status;
    } else {
      filter.status = { $in: activeEmergencyStatuses };
    }
    if (req.query.from || req.query.to) {
      filter.createdAt = {};
      if (req.query.from && !Number.isNaN(Date.parse(req.query.from))) filter.createdAt.$gte = new Date(req.query.from);
      if (req.query.to && !Number.isNaN(Date.parse(req.query.to))) {
        const to = new Date(req.query.to); to.setHours(23, 59, 59, 999); filter.createdAt.$lte = to;
      }
      if (!Object.keys(filter.createdAt).length) delete filter.createdAt;
    }
    const limit = Math.min(Math.max(Number(req.query.limit) || 500, 1), 1000);
    const [emergencyRows, total] = await Promise.all([
      Emergency.find(filter)
        .select('emergencyId title category severity status location createdAt assignedDepartment emergencyHead responseAssignments')
        .populate('assignedDepartment', 'name')
        .populate('emergencyHead', 'name role')
        .populate('responseAssignments', 'responseType status')
        .sort({ createdAt: -1 }).limit(limit).lean(),
      Emergency.countDocuments(filter)
    ]);
    res.set('Cache-Control', 'private, no-store');
    res.json({ success: true, emergencies: emergencyRows, pagination: { total, limit, returned: emergencyRows.length, truncated: total > emergencyRows.length } });
  } catch (error) { next(error); }
}
export async function hotspots(req, res, next) {
  try {
    // Aggregated, anonymized density data only — safe for any authenticated user (staff or citizen).
    const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 365);
    const minCount = Math.min(Math.max(Number(req.query.minCount) || 2, 1), 20);
    const since = new Date(Date.now() - days * 86400000);
    const filter = { createdAt: { $gte: since }, 'location.latitude': { $ne: null }, 'location.longitude': { $ne: null } };
    if (!commandAccess(req.user)) filter.visibility = 'standard';
    if (req.query.activeOnly === 'true' || req.query.activeOnly === true) filter.status = { $in: activeEmergencyStatuses };
    if (emergencyCategories.includes(req.query.category) || (req.query.category && await EmergencyCategory.exists({ key: req.query.category, active: true }))) filter.category = req.query.category;
    const [areas, totalReports] = await Promise.all([
      Emergency.aggregate([
        { $match: filter },
        { $group: { _id: { latitude: { $round: ['$location.latitude', 2] }, longitude: { $round: ['$location.longitude', 2] }, category: '$category' }, count: { $sum: 1 }, latestAt: { $max: '$createdAt' } } },
        { $match: { count: { $gte: minCount } } },
        { $sort: { count: -1 } },
        { $limit: 100 }
      ]),
      Emergency.countDocuments(filter)
    ]);
    res.set('Cache-Control', 'private, no-store');
    res.json({
      success: true,
      label: 'Reported Incident Area',
      note: 'Density is based on citizen reports in the selected period. It is not a guarantee of risk.',
      dateRangeDays: days,
      totalReports,
      insufficientData: areas.length === 0,
      message: areas.length ? undefined : 'No sufficient reported incident data for the selected period.',
      areas,
      activeOnly: req.query.activeOnly === 'true' || req.query.activeOnly === true
    });
  } catch (error) { next(error); }
}
export async function analytics(req, res, next) {
  try {
    if (!commandAccess(req.user)) return res.status(403).json({ success: false, message: 'Emergency command access is required.' });
    const [byCategory, bySeverity, byStatus, trend, response] = await Promise.all([
      Emergency.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
      Emergency.aggregate([{ $group: { _id: '$severity', count: { $sum: 1 } } }]),
      Emergency.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Emergency.aggregate([{ $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } }, { $sort: { _id: 1 } }, { $limit: 60 }]),
      // Real milestone timings only — null milestones are ignored by $avg, never fabricated.
      Emergency.aggregate([{
        $project: {
          dispatchMinutes: { $divide: [{ $subtract: ['$dispatchedAt', '$createdAt'] }, 60000] },
          acknowledgeMinutes: { $divide: [{ $subtract: ['$acknowledgedAt', '$createdAt'] }, 60000] },
          arrivalMinutes: { $divide: [{ $subtract: ['$arrivalAt', '$createdAt'] }, 60000] },
          responseMinutes: '$responseTimeMinutes',
          resolutionMinutes: { $divide: [{ $subtract: ['$resolvedAt', '$createdAt'] }, 60000] },
          hour: { $hour: '$createdAt' }
        }
      }, {
        $group: {
          _id: null,
          averageDispatchMinutes: { $avg: '$dispatchMinutes' },
          averageAcknowledgeMinutes: { $avg: '$acknowledgeMinutes' },
          averageArrivalMinutes: { $avg: '$arrivalMinutes' },
          averageResponseMinutes: { $avg: '$responseMinutes' },
          averageResolutionMinutes: { $avg: '$resolutionMinutes' },
          hourly: { $push: { hour: '$hour' } }
        }
      }])
    ]);
    const total = byCategory.reduce((sum, row) => sum + row.count, 0);
    const statusCounts = Object.fromEntries(byStatus.map((row) => [row._id, row.count]));
    const active = activeEmergencyStatuses.reduce((sum, key) => sum + (statusCounts[key] || 0), 0);
    const hourly = Array.from({ length: 24 }, (_, hour) => ({ hour, count: (response[0]?.hourly || []).filter((row) => row.hour === hour).length }));
    const metrics = response[0] || {};
    res.json({
      success: true,
      analytics: {
        total,
        active,
        resolved: statusCounts.resolved || 0,
        closed: statusCounts.closed || 0,
        byCategory,
        bySeverity,
        byStatus,
        trend,
        hourly,
        averageDispatchMinutes: metrics.averageDispatchMinutes ?? null,
        averageAcknowledgeMinutes: metrics.averageAcknowledgeMinutes ?? null,
        averageArrivalMinutes: metrics.averageArrivalMinutes ?? null,
        averageResponseMinutes: metrics.averageResponseMinutes ?? null,
        averageResolutionMinutes: metrics.averageResolutionMinutes ?? null
      }
    });
  } catch (error) { next(error); }
}
export async function emergencyTypes(req, res, next) { try { const configured = await EmergencyCategory.find({ active: true }).select('key label subcategories').sort({ label: 1 }).lean(); const keys = new Set(configured.map((category) => category.key)); const categories = [...emergencyTypeCatalog, ...configured.filter((category) => !keys.has(category.key) || !emergencyTypeCatalog.some((item) => item.key === category.key)).map((category) => ({ key: category.key, label: category.label, subcategories: category.subcategories.filter((item) => item.active !== false).map((item) => item.key) }))]; res.json({ success: true, categories }); } catch (error) { next(error); } }
export async function manageCategories(req, res, next) { try { if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Only Super Admin can manage emergency categories.' }); const categories = await EmergencyCategory.find().sort({ label: 1 }); res.json({ success: true, categories }); } catch (error) { next(error); } }

function categoryPayload(body) {
  const key = clean(body.key, 80).toLowerCase().replace(/\s+/g, '_');
  if (!/^[a-z0-9_]+$/.test(key) || !clean(body.label, 80)) return { error: 'A valid category key and label are required.' };
  const priority = ['low', 'medium', 'high', 'critical'].includes(body.priority) ? body.priority : 'medium';
  const color = /^#[0-9a-f]{6}$/i.test(String(body.color || '')) ? body.color : '#2563eb';
  const responseTargetMinutes = Number(body.responseTargetMinutes);
  const responseWarningMinutes = Number(body.responseWarningMinutes);
  const responseCriticalMinutes = Number(body.responseCriticalMinutes);
  if (![responseTargetMinutes, responseWarningMinutes, responseCriticalMinutes].every((value) => Number.isInteger(value) && value >= 1 && value <= 1440)) return { error: 'Response-time values must be whole minutes between 1 and 1440.' };
  if (responseWarningMinutes > responseTargetMinutes || responseCriticalMinutes > responseTargetMinutes) return { error: 'Warning and critical thresholds cannot exceed the target response time.' };
  const subcategories = Array.isArray(body.subcategories) ? body.subcategories.map((item) => ({ key: clean(typeof item === 'string' ? item : item.key, 80).toLowerCase().replace(/\s+/g, '_'), label: clean(typeof item === 'string' ? title(item) : item.label, 100), active: typeof item === 'object' ? item.active !== false : true })).filter((item) => /^[a-z0-9_]+$/.test(item.key) && item.label) : [];
  return { value: { key, label: clean(body.label, 80), description: clean(body.description, 300), icon: clean(body.icon || 'siren', 60) || 'siren', priority, color, subcategories, responseTargetMinutes, responseWarningMinutes, responseCriticalMinutes, responseTimeActive: typeof body.responseTimeActive === 'boolean' ? body.responseTimeActive : true, active: typeof body.active === 'boolean' ? body.active : true } };
}

export async function createCategory(req, res, next) { try { if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Only Super Admin can manage emergency categories.' }); const payload = categoryPayload(req.body); if (payload.error) return res.status(400).json({ success: false, message: payload.error }); if (await EmergencyCategory.exists({ key: payload.value.key })) return res.status(409).json({ success: false, message: 'A category with this key already exists.' }); const category = await EmergencyCategory.create({ ...payload.value, createdBy: req.user._id }); res.status(201).json({ success: true, category }); } catch (error) { next(error); } }

export async function updateCategory(req, res, next) { try { if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Only Super Admin can manage emergency categories.' }); if (!isId(req.params.id)) return res.status(404).json({ success: false, message: 'Category not found.' }); const existing = await EmergencyCategory.findById(req.params.id); if (!existing) return res.status(404).json({ success: false, message: 'Category not found.' }); const payload = categoryPayload({ ...existing.toObject(), ...req.body, key: existing.key }); if (payload.error) return res.status(400).json({ success: false, message: payload.error }); Object.assign(existing, payload.value); await existing.save(); res.json({ success: true, category: existing }); } catch (error) { next(error); } }

export async function deleteCategory(req, res, next) { try { if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Only Super Admin can manage emergency categories.' }); if (!isId(req.params.id)) return res.status(404).json({ success: false, message: 'Category not found.' }); const category = await EmergencyCategory.findById(req.params.id); if (!category) return res.status(404).json({ success: false, message: 'Category not found.' }); const usage = await Emergency.countDocuments({ category: category.key }); if (usage) return res.status(409).json({ success: false, message: `This category has ${usage} emergency record(s). Deactivate it instead of deleting historical data.` }); await category.deleteOne(); res.status(204).end(); } catch (error) { next(error); } }

export async function listContacts(req, res, next) { try { res.json({ success: true, contacts: await EmergencyContact.find({ citizen: req.user._id }).sort({ createdAt: -1 }) }); } catch (error) { next(error); } }
export async function createContact(req, res, next) { try { if (!clean(req.body.name, 100) || !clean(req.body.phone, 30)) return res.status(400).json({ success: false, message: 'Name and phone are required.' }); const contact = await EmergencyContact.create({ citizen: req.user._id, name: clean(req.body.name, 100), phone: clean(req.body.phone, 30), relationship: clean(req.body.relationship, 60), enabledForSos: req.body.enabledForSos !== false }); res.status(201).json({ success: true, contact }); } catch (error) { next(error); } }
export async function updateContact(req, res, next) { try { if (!isId(req.params.id)) return res.status(404).json({ success: false, message: 'Contact not found.' }); const contact = await EmergencyContact.findOneAndUpdate({ _id: req.params.id, citizen: req.user._id }, { name: clean(req.body.name, 100), phone: clean(req.body.phone, 30), relationship: clean(req.body.relationship, 60), enabledForSos: req.body.enabledForSos !== false }, { new: true, runValidators: true }); if (!contact) return res.status(404).json({ success: false, message: 'Contact not found.' }); res.json({ success: true, contact }); } catch (error) { next(error); } }
export async function deleteContact(req, res, next) { try { if (!isId(req.params.id)) return res.status(404).json({ success: false, message: 'Contact not found.' }); const result = await EmergencyContact.deleteOne({ _id: req.params.id, citizen: req.user._id }); if (!result.deletedCount) return res.status(404).json({ success: false, message: 'Contact not found.' }); res.status(204).end(); } catch (error) { next(error); } }

function alertPayload(body = {}) {
  const category = alertCategories.includes(body.category) ? body.category : 'public_safety';
  const status = alertStatuses.includes(body.status) ? body.status : 'active';
  const startAt = body.startAt ? new Date(body.startAt) : null;
  const endAt = body.endAt ? new Date(body.endAt) : null;
  if (startAt && Number.isNaN(startAt.getTime())) return { error: 'Alert start time is invalid.' };
  if (endAt && Number.isNaN(endAt.getTime())) return { error: 'Alert end time is invalid.' };
  if (startAt && endAt && endAt <= startAt) return { error: 'Alert end time must be after its start time.' };
  const latitude = body.location?.latitude === undefined || body.location?.latitude === null || body.location?.latitude === '' ? null : Number(body.location.latitude);
  const longitude = body.location?.longitude === undefined || body.location?.longitude === null || body.location?.longitude === '' ? null : Number(body.location.longitude);
  if ((latitude === null) !== (longitude === null) || (latitude !== null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180))) return { error: 'Alert coordinates must be a valid latitude/longitude pair.' };
  const radiusKm = body.radiusKm === undefined || body.radiusKm === null || body.radiusKm === '' ? null : Number(body.radiusKm);
  if (radiusKm !== null && (!Number.isFinite(radiusKm) || radiusKm < 0.1 || radiusKm > 100)) return { error: 'Alert radius must be between 0.1 and 100 km.' };
  return { value: { title: clean(body.title, 160), message: clean(body.message, 1000), category, severity: emergencySeverities.includes(body.severity) ? body.severity : 'medium', status, startAt, endAt, affectedArea: clean(body.affectedArea, 160), radiusKm, location: { address: clean(body.location?.address, 300), ...(latitude !== null ? { latitude, longitude } : {}) }, active: status === 'active' } };
}


function effectiveAlertState(payload, now = new Date()) {
  let status = payload.status;
  if (status === 'active' && payload.startAt && payload.startAt > now) status = 'scheduled';
  if (status === 'active' && payload.endAt && payload.endAt <= now) status = 'expired';
  return { ...payload, status, active: status === 'active' && (!payload.startAt || payload.startAt <= now) && (!payload.endAt || payload.endAt > now) };
}

async function deliverActiveAlert(alert) {
  if (!alert.active) return;
  const citizenRecipients = await User.find({ role: 'citizen', status: 'active' }).select('_id').lean();
  if (citizenRecipients.length) await Notification.insertMany(citizenRecipients.map((recipient) => ({ recipient: recipient._id, relatedType: 'system', relatedId: alert._id, type: 'system', message: `${alert.title}: ${alert.message}`.slice(0, 300) })));
}

export async function createAlertManaged(req, res, next) {
  try {
    if (!commandAccess(req.user)) return res.status(403).json({ success: false, message: 'Emergency command access is required.' });
    const payload = alertPayload(req.body);
    if (payload.error) return res.status(400).json({ success: false, message: payload.error });
    if (!payload.value.title || !payload.value.message) return res.status(400).json({ success: false, message: 'Alert title and message are required.' });
    const alert = await EmergencyAlert.create({ ...effectiveAlertState(payload.value), createdBy: req.user._id });
    await deliverActiveAlert(alert);
    await audit(req.user, 'emergency_alert_created', alert, alert.title, 'system');
    emitEmergencyEvent('EMERGENCY_ALERT_CREATED', { alertId: alert._id, title: alert.title, severity: alert.severity, status: alert.status }, { roles: ['citizen', ...staffRoles] });
    return res.status(201).json({ success: true, alert, delivery: alert.active ? 'in_app' : 'not_yet_active' });
  } catch (error) { next(error); }
}

export async function updateAlertManaged(req, res, next) {
  try {
    if (!commandAccess(req.user)) return res.status(403).json({ success: false, message: 'Emergency command access is required.' });
    if (!isId(req.params.id)) return res.status(404).json({ success: false, message: 'Alert not found.' });
    const existing = await EmergencyAlert.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: 'Alert not found.' });
    const body = { ...existing.toObject(), ...req.body };
    if (req.body.active !== undefined && req.body.status === undefined) body.status = req.body.active ? 'active' : 'cancelled';
    const payload = alertPayload(body);
    if (payload.error) return res.status(400).json({ success: false, message: payload.error });
    const wasActive = existing.active;
    Object.assign(existing, effectiveAlertState(payload.value));
    await existing.save();
    if (!wasActive && existing.active) await deliverActiveAlert(existing);
    await audit(req.user, existing.status === 'cancelled' ? 'emergency_alert_cancelled' : 'emergency_alert_updated', existing, existing.title, 'system');
    emitEmergencyEvent('EMERGENCY_ALERT_CREATED', { alertId: existing._id, title: existing.title, severity: existing.severity, status: existing.status }, { roles: ['citizen', ...staffRoles] });
    return res.json({ success: true, alert: existing, delivery: existing.active ? 'in_app' : 'not_active' });
  } catch (error) { next(error); }
}

export async function deleteAlertManaged(req, res, next) {
  try {
    if (!commandAccess(req.user)) return res.status(403).json({ success: false, message: 'Emergency command access is required.' });
    if (!isId(req.params.id)) return res.status(404).json({ success: false, message: 'Alert not found.' });
    const alert = await EmergencyAlert.findById(req.params.id);
    if (!alert) return res.status(404).json({ success: false, message: 'Alert not found.' });
    await alert.deleteOne();
    await audit(req.user, 'emergency_alert_deleted', { ...alert.toObject(), emergencyId: alert.title }, alert.title, 'system');
    emitEmergencyEvent('EMERGENCY_ALERT_CREATED', { alertId: alert._id, title: alert.title, severity: alert.severity, status: 'deleted' }, { roles: ['citizen', ...staffRoles] });
    res.status(204).end();
  } catch (error) { next(error); }
}

export async function createAlert(req, res, next) { try { if (!commandAccess(req.user)) return res.status(403).json({ success: false, message: 'Emergency command access is required.' }); if (!clean(req.body.title, 160) || !clean(req.body.message, 1000)) return res.status(400).json({ success: false, message: 'Alert title and message are required.' }); const alertLatitude = Number(req.body.location?.latitude); const alertLongitude = Number(req.body.location?.longitude); const hasAlertLatitude = req.body.location?.latitude !== undefined && req.body.location?.latitude !== null && req.body.location?.latitude !== ''; const hasAlertLongitude = req.body.location?.longitude !== undefined && req.body.location?.longitude !== null && req.body.location?.longitude !== ''; if (hasAlertLatitude !== hasAlertLongitude || (hasAlertLatitude && (!Number.isFinite(alertLatitude) || alertLatitude < -90 || alertLatitude > 90 || !Number.isFinite(alertLongitude) || alertLongitude < -180 || alertLongitude > 180))) return res.status(400).json({ success: false, message: 'Alert coordinates must be a valid latitude/longitude pair.' }); const alert = await EmergencyAlert.create({ createdBy: req.user._id, title: clean(req.body.title, 160), message: clean(req.body.message, 1000), category: clean(req.body.category, 80), severity: emergencySeverities.includes(req.body.severity) ? req.body.severity : 'medium', location: { address: clean(req.body.location?.address, 300), ...(hasAlertLatitude ? { latitude: alertLatitude, longitude: alertLongitude } : {}) } }); const citizenRecipients = await User.find({ role: 'citizen', status: 'active' }).select('_id').lean(); if (citizenRecipients.length) await Notification.insertMany(citizenRecipients.map((recipient) => ({ recipient: recipient._id, relatedType: 'system', relatedId: alert._id, type: 'system', message: `${alert.title}: ${alert.message}`.slice(0, 300) }))); await audit(req.user, 'emergency_alert_created', alert, alert.title, 'system'); emitEmergencyEvent('EMERGENCY_ALERT_CREATED', { alertId: alert._id, title: alert.title, severity: alert.severity }, { roles: ['citizen', ...staffRoles] }); res.status(201).json({ success: true, alert }); } catch (error) { next(error); } }
export async function updateAlert(req, res, next) { try { if (!commandAccess(req.user)) return res.status(403).json({ success: false, message: 'Emergency command access is required.' }); if (!isId(req.params.id)) return res.status(404).json({ success: false, message: 'Alert not found.' }); if (typeof req.body.active !== 'boolean') return res.status(400).json({ success: false, message: 'Provide an active boolean value.' }); const alert = await EmergencyAlert.findByIdAndUpdate(req.params.id, { active: req.body.active }, { new: true, runValidators: true }); if (!alert) return res.status(404).json({ success: false, message: 'Alert not found.' }); await audit(req.user, req.body.active === false ? 'emergency_alert_closed' : 'emergency_alert_updated', alert, alert.title, 'system'); res.json({ success: true, alert }); } catch (error) { next(error); } }
async function activateDueAlerts() {
  const now = new Date();
  const due = await EmergencyAlert.find({
    status: 'scheduled',
    startAt: { $ne: null, $lte: now },
    $or: [{ endAt: null }, { endAt: { $gt: now } }]
  }).select('_id');
  for (const record of due) {
    const activated = await EmergencyAlert.findOneAndUpdate(
      { _id: record._id, status: 'scheduled' },
      { $set: { status: 'active', active: true } },
      { new: true }
    );
    if (activated) {
      await deliverActiveAlert(activated);
      emitEmergencyEvent('EMERGENCY_ALERT_CREATED', { alertId: activated._id, title: activated.title, severity: activated.severity, status: activated.status }, { roles: ['citizen', ...staffRoles] });
    }
  }
  await EmergencyAlert.updateMany({ status: 'active', endAt: { $ne: null, $lte: now } }, { $set: { status: 'expired', active: false } });
}

export async function listAlerts(req, res, next) { try { await activateDueAlerts(); const filter = req.query.all === 'true' && commandAccess(req.user) ? {} : { active: true }; res.json({ success: true, alerts: await EmergencyAlert.find(filter).sort({ createdAt: -1 }).limit(50) }); } catch (error) { next(error); } }

/** Advisory classification helper for the "I'm not sure what type this is" flow. */
export async function classifyRequest(req, res, next) {
  try {
    const textTitle = clean(req.body.title, 140);
    const textDescription = clean(req.body.description, 2000);
    if (!textTitle && !textDescription) return res.status(400).json({ success: false, message: 'Provide a title or description to classify.' });
    const suggestion = suggestEmergencyClassification(textTitle, textDescription);
    res.json({ success: true, suggestion, note: 'Advisory suggestion only — Emergency Command makes the final classification.' });
  } catch (error) { next(error); }
}

/** Directory of assignable emergency responders (command only). */
export async function listAssignableResponders(req, res, next) {
  try {
    if (!commandAccess(req.user)) return res.status(403).json({ success: false, message: 'Emergency command access is required.' });
    const responders = await User.find({ role: { $in: ['emergency_officer', 'emergency_field_worker'] }, status: 'active' }).select('_id name role departmentName').sort({ role: 1, name: 1 }).lean();
    res.json({ success: true, responders });
  } catch (error) { next(error); }
}

/** Nearest available response teams for an incident: availability → type match → distance. */
export async function nearbyResponderTeams(req, res, next) {
  try {
    if (!commandAccess(req.user)) return res.status(403).json({ success: false, message: 'Emergency command access is required.' });
    const emergency = await scopedEmergency(req, res); if (!emergency) return;
    const suggestedTypes = suggestedTeamTypes(emergency.category);
    const teams = (await ResponseTeam.find({ active: true }).lean())
      .map((team) => ({
        ...team,
        distanceKm: haversineKm(emergency.location?.latitude, emergency.location?.longitude, team.baseLocation?.latitude, team.baseLocation?.longitude),
        typeMatch: suggestedTypes.includes(team.type)
      }))
      .sort((a, b) => {
        const availabilityRank = { available: 0, busy: 1, offline: 2 };
        if (availabilityRank[a.availability] !== availabilityRank[b.availability]) return availabilityRank[a.availability] - availabilityRank[b.availability];
        if (a.typeMatch !== b.typeMatch) return (a.typeMatch ? 0 : 1) - (b.typeMatch ? 0 : 1);
        if (a.distanceKm == null) return 1;
        if (b.distanceKm == null) return -1;
        return a.distanceKm - b.distanceKm;
      });
    res.json({ success: true, suggestedTypes, teams });
  } catch (error) { next(error); }
}

/** Live responder positions for one incident — command or participating citizen only. */
export async function responderPositions(req, res, next) {
  try {
    const emergency = await scopedEmergency(req, res); if (!emergency) return;
    const positions = await EmergencyResponderLocation.find({ emergency: emergency._id }).populate('responder', 'name role').sort({ recordedAt: -1 }).lean();
    const canSeeCoordinates = commandAccess(req.user) || ['emergency_officer', 'emergency_field_worker'].includes(req.user.role);
    const safePositions = canSeeCoordinates ? positions : positions.map((position) => ({ _id: position._id, responder: position.responder, recordedAt: position.recordedAt }));
    res.json({ success: true, positions: safePositions });
  } catch (error) { next(error); }
}

/** Global responder snapshot for the command center live map (staff only). */
export async function responderLocations(req, res, next) {
  try {
    if (!commandAccess(req.user)) return res.status(403).json({ success: false, message: 'Only emergency command can view global responder locations.' });
    const positions = await EmergencyResponderLocation.find().populate('responder', 'name role').populate('emergency', 'emergencyId category severity status location').sort({ recordedAt: -1 }).limit(200).lean();
    res.json({ success: true, positions });
  } catch (error) { next(error); }
}

/**
 * Limited community verification. Standard-visibility incidents only; restricted
 * incidents are visible solely to their reporter and emergency command. No private
 * incident details are returned — only aggregate confirmation counts.
 */
export async function communityVerify(req, res, next) {
  try {
    if (!isId(req.params.id)) return res.status(404).json({ success: false, message: 'Emergency not found.' });
    const emergency = await Emergency.findById(req.params.id).select('emergencyId status visibility citizen communityVerification').lean();
    if (!emergency) return res.status(404).json({ success: false, message: 'Emergency not found.' });
    const emergencyOwner = sameId(emergency.citizen, req.user._id);
    if (emergency.visibility === 'restricted' && !emergencyOwner && !commandAccess(req.user)) return res.status(404).json({ success: false, message: 'Emergency not found.' });
    if (['resolved', 'closed', 'cancelled', 'false_report'].includes(emergency.status)) return res.status(400).json({ success: false, message: 'This emergency is already closed.' });
    const { stillHappening, note = '' } = req.body;
    if (typeof stillHappening !== 'boolean' && !clean(note, 400)) return res.status(400).json({ success: false, message: 'Provide a verification option or a note.' });
    const update = { citizen: req.user._id, ...(typeof stillHappening === 'boolean' ? { vote: stillHappening ? 'still_happening' : 'resolved' } : {}), at: new Date() };
    const votes = (emergency.communityVerification?.votes || []).filter((vote) => String(vote.citizen) !== String(req.user._id));
    if (typeof stillHappening === 'boolean') votes.push({ citizen: req.user._id, vote: stillHappening ? 'still_happening' : 'resolved', at: new Date() });
    const notes = [...(emergency.communityVerification?.notes || [])];
    if (clean(note, 400)) notes.push({ citizen: req.user._id, note: clean(note, 400), at: new Date() });
    const stillHappeningCount = votes.filter((vote) => vote.vote === 'still_happening').length;
    const resolvedCount = votes.filter((vote) => vote.vote === 'resolved').length;
    await Emergency.updateOne({ _id: emergency._id }, { communityVerification: { votes, notes, stillHappening: stillHappeningCount, resolvedVotes: resolvedCount } });
    res.json({ success: true, message: 'Verification recorded.', communityVerification: { stillHappening: stillHappeningCount, resolvedVotes: resolvedCount, myVote: update.vote || null } });
  } catch (error) { next(error); }
}

const intelligenceDomains = {
  women: ['women_safety'],
  road: ['road_traffic'],
  security: ['security_crime'],
  emergency: emergencyCategories.filter((key) => key !== 'not_sure')
};

/** Public safety intelligence built strictly from real database records. */
export async function safetyIntelligence(req, res, next) {
  try {
    if (!commandAccess(req.user)) return res.status(403).json({ success: false, message: 'Only emergency command can view safety intelligence.' });
    const domain = intelligenceDomains[req.query.domain] ? req.query.domain : 'emergency';
    const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 365);
    const since = new Date(Date.now() - days * 86400000);
    const filter = { createdAt: { $gte: since }, category: { $in: intelligenceDomains[domain] } };
    const [totals, byCategory, bySubcategory, trend, density, timings] = await Promise.all([
      Emergency.aggregate([{ $match: filter }, { $group: { _id: null, count: { $sum: 1 }, restricted: { $sum: { $cond: [{ $eq: ['$visibility', 'restricted'] }, 1, 0] } } } }]),
      Emergency.aggregate([{ $match: filter }, { $group: { _id: '$category', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
      Emergency.aggregate([{ $match: filter }, { $group: { _id: '$subcategory', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 12 }]),
      Emergency.aggregate([{ $match: filter }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
      Emergency.aggregate([
        { $match: { ...filter, 'location.latitude': { $ne: null }, 'location.longitude': { $ne: null } } },
        { $group: { _id: { latitude: { $round: ['$location.latitude', 2] }, longitude: { $round: ['$location.longitude', 2] } }, count: { $sum: 1 }, latestAt: { $max: '$createdAt' } } },
        { $match: { count: { $gte: 2 } } }, { $sort: { count: -1 } }, { $limit: 50 }
      ]),
      Emergency.aggregate([{ $match: { ...filter, responseTimeMinutes: { $ne: null } } }, { $group: { _id: null, averageResponseMinutes: { $avg: '$responseTimeMinutes' }, averageResolutionMinutes: { $avg: { $divide: [{ $subtract: ['$resolvedAt', '$createdAt'] }, 60000] } } } }])
    ]);
    res.json({
      success: true,
      domain,
      dateRangeDays: days,
      label: 'Reported Incident Area',
      note: 'Aggregated report statistics only. Counts reflect citizen reports and are not a guarantee of risk.',
      total: totals[0]?.count || 0,
      restrictedCount: totals[0]?.restricted || 0,
      byCategory,
      bySubcategory,
      trend,
      densityAreas: density,
      averageResponseMinutes: timings[0]?.averageResponseMinutes ?? null,
      averageResolutionMinutes: timings[0]?.averageResolutionMinutes ?? null
    });
  } catch (error) { next(error); }
}

/** Fine-grained assignment lifecycle: accepted → en route → on scene → responding → completed. */
export async function updateAssignmentStatus(req, res, next) {
  try {
    const emergency = await scopedEmergency(req, res); if (!emergency) return;
    let assignment = emergency.responseAssignments.find((item) => String(item._id) === req.params.assignmentId);
    if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found.' });
    const command = commandAccess(req.user);
    const isOfficer = sameId(assignment.emergencyOfficer, req.user._id);
    const isWorker = assignment.fieldWorkers?.some((worker) => sameId(worker, req.user._id));
    if (!command && !isOfficer && !isWorker) return res.status(403).json({ success: false, message: 'You are not part of this response team.' });
    const { status, note = '', etaMinutes } = req.body;
    if (!assignmentStatuses.includes(status)) return res.status(400).json({ success: false, message: 'Invalid assignment status.' });
    if (!canTransitionAssignment(assignment.status, status)) return res.status(409).json({ success: false, message: `Invalid assignment transition from ${title(assignment.status)} to ${title(status)}.` });
    if (status === 'accepted' && !command && !isOfficer) return res.status(403).json({ success: false, message: 'Only the assigned officer or command can accept an assignment.' });
    if (status === 'cancelled' && !command) return res.status(403).json({ success: false, message: 'Only emergency command can cancel an assignment.' });
    if (etaMinutes !== undefined && etaMinutes !== null && (!Number.isFinite(Number(etaMinutes)) || Number(etaMinutes) < 0 || Number(etaMinutes) > 999)) return res.status(400).json({ success: false, message: 'ETA must be between 0 and 999 minutes.' });
    const previous = assignment.status;
    const assignmentUpdate = { status };
    const now = new Date();
    if (status === 'accepted' && !assignment.acceptedAt) { assignmentUpdate.acceptedAt = now; if (!emergency.acknowledgedAt) emergency.acknowledgedAt = now; }
    if (['en_route', 'on_scene', 'responding', 'completed'].includes(status) && !assignment.acceptedAt) assignmentUpdate.acceptedAt = now;
    if (status === 'en_route') { if (!emergency.enRouteAt) emergency.enRouteAt = now; if (['dispatched', 'requires_backup'].includes(emergency.status)) emergency.status = 'en_route'; }
    if (status === 'on_scene') {
      if (!assignment.arrivedAt) assignmentUpdate.arrivedAt = now;
      if (!emergency.arrivalAt) { emergency.arrivalAt = now; if (emergency.responseTimeMinutes == null) emergency.responseTimeMinutes = Math.round((now.getTime() - emergency.createdAt.getTime()) / 60000); }
      if (['dispatched', 'en_route', 'requires_backup'].includes(emergency.status)) emergency.status = 'on_scene';
    }
    if (status === 'responding' && ['dispatched', 'en_route', 'on_scene', 'requires_backup'].includes(emergency.status)) emergency.status = 'responding';
    if (status === 'completed' && !assignment.completedAt) assignmentUpdate.completedAt = now;
    if (status === 'accepted' && emergency.status === 'reported') emergency.status = 'received';
    if (etaMinutes !== undefined && etaMinutes !== null) assignmentUpdate.etaMinutes = Number(etaMinutes);
    const updatedAssignment = await EmergencyResponseAssignment.findOneAndUpdate(
      { _id: assignment._id, emergency: emergency._id, status: previous },
      { $set: assignmentUpdate },
      { new: true, runValidators: true }
    );
    if (!updatedAssignment) return res.status(409).json({ success: false, message: 'This response assignment changed while the update was being saved. Refresh and try again.' });
    assignment = updatedAssignment;
    emergency.activity.push({ action: `${assignment.responseType} team status changed from ${title(previous)} to ${title(status)}`, actorRole: req.user.role, note: clean(note, 500) });
    if (['completed', 'cancelled'].includes(status) && assignment.team) {
      const team = await ResponseTeam.findById(assignment.team);
      const otherActiveAssignments = await EmergencyResponseAssignment.countDocuments({ team: assignment.team, _id: { $ne: assignment._id }, status: { $in: ['assigned', 'accepted', 'en_route', 'on_scene', 'responding'] } });
      if (team && team.availability === 'busy' && otherActiveAssignments === 0) { team.availability = 'available'; await team.save(); }
    }
    await emergency.save();
    const citizenId = emergency.citizen?._id || emergency.citizen;
    const teamIds = [assignment.emergencyOfficer?._id, ...(assignment.fieldWorkers || []).map((worker) => worker?._id || worker)].filter(Boolean);
    await Promise.all([citizenId, ...teamIds].filter((id) => String(id) !== String(req.user._id)).map((id) => notify(id, emergency, `Response update on ${emergency.emergencyId}: ${assignment.responseType} team is now ${title(status)}.`)));
    await audit(req.user, 'assignment_status_changed', emergency, `${assignment.responseType}: ${previous} → ${status}`);
    emitEmergencyEvent(status === 'accepted' ? 'OFFICER_ACCEPTED' : 'EMERGENCY_STATUS_CHANGED', { emergencyId: emergency._id, publicId: emergency.emergencyId, assignmentId: assignment._id, status }, { userIds: [citizenId, ...teamIds], roles: commandRoles });
    res.json({ success: true, assignment, emergency: emergencyForViewer(await populatedEmergency(emergency._id), req.user) });
  } catch (error) { next(error); }
}

/** Officer (own assignment) or command adds field workers to an existing response branch. */
export async function addAssignmentWorkers(req, res, next) {
  try {
    const emergency = await scopedEmergency(req, res); if (!emergency) return;
    const assignment = emergency.responseAssignments.find((item) => String(item._id) === req.params.assignmentId);
    if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found.' });
    const command = commandAccess(req.user);
    if (!command && !sameId(assignment.emergencyOfficer, req.user._id)) return res.status(403).json({ success: false, message: 'Only the assigned officer or command can add field workers.' });
    if (!Array.isArray(req.body.fieldWorkerIds)) return res.status(400).json({ success: false, message: 'fieldWorkerIds must be an array.' });
    const requestedIds = [...new Set(req.body.fieldWorkerIds.map(String))];
    if (!requestedIds.length) return res.status(400).json({ success: false, message: 'Select at least one field worker.' });
    if (requestedIds.some((id) => !isId(id))) return res.status(400).json({ success: false, message: 'Select valid field worker IDs.' });
    const workers = await User.find({ _id: { $in: requestedIds }, role: 'emergency_field_worker', status: 'active' }).select('_id name');
    if (workers.length !== requestedIds.length) return res.status(400).json({ success: false, message: 'Select active emergency field workers.' });
    const existing = new Set(assignment.fieldWorkers.map(String));
    const added = workers.filter((worker) => !existing.has(String(worker._id)));
    if (!added.length) return res.status(400).json({ success: false, message: 'Those field workers are already assigned.' });
    assignment.fieldWorkers.push(...added.map((worker) => worker._id));
    await assignment.save();
    emergency.activity.push({ action: 'Field workers added to response team', actorRole: req.user.role, note: added.map((worker) => worker.name).join(', ') });
    await emergency.save();
    await Promise.all(added.map((worker) => notify(worker._id, emergency, `New field assignment: ${emergency.emergencyId} (${assignment.responseType}).`)));
    emitEmergencyEvent('FIELD_WORKER_ASSIGNED', { emergencyId: emergency._id, publicId: emergency.emergencyId, assignmentId: assignment._id, fieldWorkerIds: added.map((worker) => worker._id) }, { userIds: added.map((worker) => worker._id), roles: commandRoles });
    await audit(req.user, 'emergency_assigned', emergency, `Field workers added to ${assignment.responseType}: ${added.length}`);
    res.json({ success: true, assignment, emergency: emergencyForViewer(await populatedEmergency(emergency._id), req.user) });
  } catch (error) { next(error); }
}

/** Authenticated evidence download — evidence is never served from public static storage. */
export async function downloadEvidence(req, res, next) {
  try {
    const emergency = await scopedEmergency(req, res); if (!emergency) return;
    const filename = path.basename(String(req.params.filename || ''));
    const record = emergency.evidence.find((item) => item.filename === filename);
    if (!record) return res.status(404).json({ success: false, message: 'Evidence file not found.' });
    res.sendFile(path.join(emergencyUploadDir, filename), (error) => {
      if (error && !res.headersSent) res.status(404).json({ success: false, message: 'Evidence file is unavailable.' });
    });
  } catch (error) { next(error); }
}
