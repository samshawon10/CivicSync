import mongoose from 'mongoose';
import CivicService from '../models/CivicService.js';
import CivicServiceCategory from '../models/CivicServiceCategory.js';
import CivicServiceSave from '../models/CivicServiceSave.js';
import ActivityLog from '../models/ActivityLog.js';
import { emitDepartmentEvent } from '../realtime/emergencyRealtime.js';
import { reportCategories, reportDepartments } from '../config/reportOptions.js';
import { isPubliclyReadable, missingInformation, normalizeService, parseNearby, publishBlockers, serviceStatuses } from '../services/civicServiceRules.js';

const id = (value) => mongoose.Types.ObjectId.isValid(value);
const escapeRegex = (value = '') => String(value).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const isAdmin = (user) => user.role === 'admin';

/** Public shape. `missing` tells the UI exactly what has not been recorded. */
const present = (service, saved = false) => {
  const row = service.toObject ? service.toObject() : service;
  return { ...row, saved, missing: missingInformation(row) };
};

async function log(req, action, service) {
  await ActivityLog.create({
    admin: req.user._id,
    actorRole: req.user.role,
    action,
    targetType: 'civic_service',
    targetId: service._id,
    targetName: service.name,
    description: `${service.name} · ${service.status}`,
    metadata: { status: service.status, category: service.category },
    result: 'success'
  });
}

/** Catalogue changes are civic information, so staff are told over realtime. */
function announce(event, service) {
  emitDepartmentEvent(event, { serviceId: service._id, name: service.name, status: service.status, category: service.category }, {
    roles: ['citizen', 'department_head', 'department_officer', 'officer'],
    department: service.departmentName || ''
  });
}

export async function listCategories(req, res, next) {
  try {
    const filter = isAdmin(req.user) ? {} : { active: true };
    res.json({ success: true, categories: await CivicServiceCategory.find(filter).sort({ order: 1, label: 1 }).lean() });
  } catch (error) { next(error); }
}

export async function createCategory(req, res, next) {
  try {
    const key = String(req.body.key || '').trim().toLowerCase().slice(0, 60);
    const label = String(req.body.label || '').trim().slice(0, 80);
    if (!key || !label) return res.status(400).json({ success: false, message: 'A category key and label are required.' });
    const category = await CivicServiceCategory.findOneAndUpdate(
      { key },
      { key, label, description: String(req.body.description || '').trim().slice(0, 300), icon: String(req.body.icon || 'fileText').trim().slice(0, 40), order: Number(req.body.order) || 0, active: req.body.active !== false },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.status(201).json({ success: true, category });
  } catch (error) { next(error); }
}

async function savedServiceIds(userId, rows) {
  const saves = await CivicServiceSave.find({ user: userId, service: { $in: rows.map((row) => row._id) } }).select('service').lean();
  return new Set(saves.map((row) => String(row.service)));
}

/**
 * Service discovery. Citizens only ever receive `published` records; the Super
 * Admin may filter by any status. Nearby search uses the geospatial index and is
 * therefore mutually exclusive with the text filter.
 */
export async function listServices(req, res, next) {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50);
    const page = Math.max(Number(req.query.page) || 1, 1);
    const filter = isAdmin(req.user) ? {} : { status: 'published' };
    if (isAdmin(req.user) && serviceStatuses.includes(req.query.status)) filter.status = req.query.status;
    if (req.query.category) filter.category = String(req.query.category).trim().toLowerCase();
    if (req.query.departmentName) filter.departmentName = String(req.query.departmentName).trim();

    const term = String(req.query.q || '').trim();
    const nearby = parseNearby(req.query);
    if (nearby.error) return res.status(400).json({ success: false, message: nearby.error });
    if (nearby.near && term) return res.status(400).json({ success: false, message: 'Choose either a text search or a nearby search, not both.' });
    if (term) {
      const expression = new RegExp(escapeRegex(term), 'i');
      filter.$or = [{ name: expression }, { summary: expression }, { description: expression }, { 'location.area': expression }];
    }
    if (nearby.near) {
      // $near cannot be combined with $or/countDocuments, so nearby results are a
      // bounded distance-ordered list rather than a paginated set.
      filter['location.point'] = { $near: { $geometry: { type: 'Point', coordinates: [nearby.near.longitude, nearby.near.latitude] }, $maxDistance: nearby.near.radiusKm * 1000 } };
      const rows = await CivicService.find(filter).limit(limit).lean();
      const savedIds = await savedServiceIds(req.user._id, rows);
      return res.json({ success: true, services: rows.map((row) => present(row, savedIds.has(String(row._id)))), total: rows.length, nearby: nearby.near, pagination: { page: 1, limit, total: rows.length, pages: 1 } });
    }

    const [rows, total] = await Promise.all([
      CivicService.find(filter).sort({ name: 1 }).skip((page - 1) * limit).limit(limit).lean(),
      CivicService.countDocuments(filter)
    ]);
    const savedIds = await savedServiceIds(req.user._id, rows);
    res.json({
      success: true,
      services: rows.map((row) => present(row, savedIds.has(String(row._id)))),
      total,
      nearby: null,
      pagination: { page, limit, total, pages: Math.max(Math.ceil(total / limit), 1) }
    });
  } catch (error) { next(error); }
}

export async function getService(req, res, next) {
  try {
    if (!id(req.params.id)) return res.status(404).json({ success: false, message: 'Service not found.' });
    const service = await CivicService.findById(req.params.id).lean();
    if (!service) return res.status(404).json({ success: false, message: 'Service not found.' });
    if (!isPubliclyReadable(service) && !isAdmin(req.user)) return res.status(404).json({ success: false, message: 'Service not found.' });
    const saved = Boolean(await CivicServiceSave.exists({ user: req.user._id, service: service._id }));
    res.json({ success: true, service: present(service, saved) });
  } catch (error) { next(error); }
}

export async function toggleSaveService(req, res, next) {
  try {
    if (!id(req.params.id)) return res.status(404).json({ success: false, message: 'Service not found.' });
    const service = await CivicService.findOne({ _id: req.params.id, status: 'published' }).select('_id');
    if (!service) return res.status(404).json({ success: false, message: 'Service not found.' });
    const existing = await CivicServiceSave.findOne({ user: req.user._id, service: service._id });
    if (existing) await existing.deleteOne();
    else await CivicServiceSave.create({ user: req.user._id, service: service._id });
    res.json({ success: true, saved: !existing });
  } catch (error) { next(error); }
}

export async function listSavedServices(req, res, next) {
  try {
    const saves = await CivicServiceSave.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(100).lean();
    const services = await CivicService.find({ _id: { $in: saves.map((row) => row.service) }, status: 'published' }).lean();
    res.json({ success: true, services: services.map((service) => present(service, true)) });
  } catch (error) { next(error); }
}

export async function createService(req, res, next) {
  try {
    const { value, error } = normalizeService(req.body);
    if (error) return res.status(400).json({ success: false, message: error });
    if (!value.name) return res.status(400).json({ success: false, message: 'A service name is required.' });
    if (value.slug && await CivicService.exists({ slug: value.slug })) return res.status(409).json({ success: false, message: 'A service with that name already exists.' });
    const service = await CivicService.create({ ...value, status: 'draft', createdBy: req.user._id, updatedBy: req.user._id });
    await log(req, 'civic_service_created', service);
    res.status(201).json({ success: true, service: present(service) });
  } catch (error) { next(error); }
}

export async function updateService(req, res, next) {
  try {
    if (!id(req.params.id)) return res.status(404).json({ success: false, message: 'Service not found.' });
    const { value, error } = normalizeService(req.body);
    if (error) return res.status(400).json({ success: false, message: error });
    const service = await CivicService.findById(req.params.id);
    if (!service) return res.status(404).json({ success: false, message: 'Service not found.' });
    if (value.slug && value.slug !== service.slug && await CivicService.exists({ slug: value.slug, _id: { $ne: service._id } })) {
      return res.status(409).json({ success: false, message: 'Another service already uses that name.' });
    }
    Object.assign(service, value, { updatedBy: req.user._id });
    await service.save();
    await log(req, 'civic_service_updated', service);
    announce('SERVICE_UPDATED', service);
    res.json({ success: true, service: present(service) });
  } catch (error) { next(error); }
}

/** Publishing is blocked until the essentials exist (see civicServiceRules). */
export async function publishService(req, res, next) {
  try {
    if (!id(req.params.id)) return res.status(404).json({ success: false, message: 'Service not found.' });
    const service = await CivicService.findById(req.params.id);
    if (!service) return res.status(404).json({ success: false, message: 'Service not found.' });
    const blockers = publishBlockers(service.toObject());
    if (blockers.length) return res.status(400).json({ success: false, message: `Cannot publish yet. ${blockers.join(' ')}`, blockers });
    service.status = 'published';
    service.publishedAt = service.publishedAt || new Date();
    service.updatedBy = req.user._id;
    await service.save();
    await log(req, 'civic_service_published', service);
    announce('SERVICE_UPDATED', service);
    res.json({ success: true, service: present(service) });
  } catch (error) { next(error); }
}

export async function archiveService(req, res, next) {
  try {
    if (!id(req.params.id)) return res.status(404).json({ success: false, message: 'Service not found.' });
    const service = await CivicService.findById(req.params.id);
    if (!service) return res.status(404).json({ success: false, message: 'Service not found.' });
    service.status = 'archived';
    service.updatedBy = req.user._id;
    await service.save();
    await log(req, 'civic_service_archived', service);
    announce('SERVICE_UPDATED', service);
    res.json({ success: true, service: present(service) });
  } catch (error) { next(error); }
}

/**
 * Service -> Case hand-off (spec section 30).
 *
 * Returns a prefill for the EXISTING citizen report form instead of creating a
 * case here, so one report workflow (and its validation) remains the only way a
 * case enters the system. The citizen confirms in the form and `origin` records
 * which service the case came from.
 */
export async function serviceRequestPrefill(req, res, next) {
  try {
    if (!id(req.params.id)) return res.status(404).json({ success: false, message: 'Service not found.' });
    const service = await CivicService.findOne({ _id: req.params.id, status: 'published' }).lean();
    if (!service) return res.status(404).json({ success: false, message: 'Service not found.' });
    if (!service.requestEnabled) return res.status(400).json({ success: false, message: 'This service does not accept requests through CivicSync yet.' });
    const category = reportCategories.includes(service.category) ? service.category : '';
    const departmentName = reportDepartments.includes(service.requestDepartmentName) ? service.requestDepartmentName : '';
    res.json({
      success: true,
      prefill: {
        title: `${service.name} request`,
        category,
        departmentName,
        area: service.location?.area || '',
        address: service.location?.address || '',
        office: service.contact?.office || '',
        requiredDocuments: service.requiredDocuments || [],
        origin: { type: 'service', serviceId: service._id, label: service.name }
      },
      notes: [
        'Submitting this creates a normal civic case through the existing report workflow.',
        category ? '' : 'Choose the closest case category yourself — this service category has no direct case equivalent.',
        departmentName ? '' : 'Choose the handling department yourself — this service is not mapped to a case department yet.'
      ].filter(Boolean)
    });
  } catch (error) { next(error); }
}
