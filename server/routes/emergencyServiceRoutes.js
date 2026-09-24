import { Router } from 'express';
import mongoose from 'mongoose';
import SafetyFacility from '../models/SafetyFacility.js';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';
import { haversineKm } from '../services/emergencyIntelligence.js';
import { facilityGroups, facilityPoint, facilityTypeLabels, facilityTypes, nearestHelpTypes } from '../config/facilityOptions.js';
const managerRoles = ['admin', 'emergency_department_head'];
const isId = (value) => mongoose.Types.ObjectId.isValid(value);
const clean = (value, max = 300) => String(value || '').trim().slice(0, max);

function payload(body) {
  const latitude = Number(body.latitude);
  const longitude = Number(body.longitude);
  if (!clean(body.name, 140) || !facilityTypes.includes(body.type)) return { error: 'A facility name and valid type are required.' };
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) return { error: 'Valid latitude and longitude are required.' };
  return {
    value: {
      name: clean(body.name, 140),
      type: body.type,
      address: clean(body.address, 300),
      latitude,
      longitude,
      location: facilityPoint(latitude, longitude),
      status: ['operational', 'degraded', 'offline'].includes(body.status) ? body.status : 'operational',
      emergencyServiceAvailable: typeof body.emergencyServiceAvailable === 'boolean' ? body.emergencyServiceAvailable : true,
      description: clean(body.description, 1000),
      openingHours: clean(body.openingHours, 160),
      email: clean(body.email, 120),
      emergencyPhone: clean(body.emergencyPhone, 30),
      phone: clean(body.phone, 30),
      ...(typeof body.available === 'boolean' ? { available: body.available } : {}),
      ...(typeof body.active === 'boolean' ? { active: body.active } : {})
    }
  };
}

const router = Router();
router.use(requireAuth);

router.get('/catalog', (req, res) => {
  res.json({
    success: true,
    groups: facilityGroups,
    types: facilityTypes.map((type) => ({ type, label: facilityTypeLabels[type] })),
    nearestHelpTypes
  });
});

router.get('/nearby', async (req, res, next) => {
  try {
    const latitude = Number(req.query.lat);
    const longitude = Number(req.query.lng);
    const hasLocation = Number.isFinite(latitude) && Number.isFinite(longitude);
    if ((req.query.lat !== undefined || req.query.lng !== undefined) && !hasLocation) {
      return res.status(400).json({ success: false, message: 'Valid lat and lng are required for a nearby search.' });
    }
    const filter = { active: true };
    if (facilityTypes.includes(req.query.type)) filter.type = req.query.type;
    const requestedTypes = (Array.isArray(req.query.types) ? req.query.types : String(req.query.types || '').split(','))
      .map((type) => String(type).trim()).filter((type) => facilityTypes.includes(type));
    if (requestedTypes.length) filter.type = { $in: requestedTypes };
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const nearestPerType = req.query.nearestPerType === 'true' || req.query.nearestPerType === true;
    let facilities;
    let queryMode = 'catalog';
    if (hasLocation && nearestPerType) {
      const perType = [];
      let usedLegacy = false;
      let pendingIndex = false;
      for (const type of requestedTypes) {
        const typeFilter = { ...filter, type };
        let nearest = [];
        try {
          nearest = await SafetyFacility.aggregate([
            { $geoNear: { near: { type: 'Point', coordinates: [longitude, latitude] }, key: 'location', distanceField: 'distanceMeters', spherical: true, query: typeFilter } },
            { $limit: 1 }
          ]);
        } catch (error) {
          if (![27, 291].includes(error.code)) throw error;
          pendingIndex = true;
        }
        if (!nearest.length) {
          const legacy = await SafetyFacility.find({ ...typeFilter, $or: [{ location: { $exists: false } }, { location: null }] }).limit(200).lean();
          if (legacy.length) {
            const closest = legacy
              .map((facility) => ({ ...facility, distanceMeters: haversineKm(latitude, longitude, facility.latitude, facility.longitude) * 1000 }))
              .sort((a, b) => a.distanceMeters - b.distanceMeters)[0];
            nearest = [closest];
            usedLegacy = true;
          }
        }
        if (nearest.length) perType.push(nearest[0]);
      }
      facilities = perType.sort((a, b) => a.distanceMeters - b.distanceMeters);
      queryMode = pendingIndex ? (usedLegacy ? 'legacy_pending_geo_index' : 'empty_pending_geo_index') : (usedLegacy ? 'geospatial_with_legacy_fallback' : 'geospatial');
    } else if (hasLocation) {
      // New and migrated facilities use MongoDB's 2dsphere index. The bounded
      // legacy query is transitional: it prevents old rows disappearing before
      // `npm run geo:backfill` has been run, or while a deployment is creating
      // the index for the first time.
      try {
        facilities = await SafetyFacility.aggregate([
          { $geoNear: { near: { type: 'Point', coordinates: [longitude, latitude] }, key: 'location', distanceField: 'distanceMeters', spherical: true, query: filter } },
          { $limit: limit }
        ]);
        queryMode = 'geospatial';
      } catch (error) {
        if (![27, 291].includes(error.code)) throw error;
        facilities = [];
        queryMode = 'legacy_pending_geo_index';
      }
      if (facilities.length < limit) {
        const legacyFilter = { ...filter, $or: [{ location: { $exists: false } }, { location: null }] };
        const legacy = await SafetyFacility.find(legacyFilter).limit(limit * 2).lean();
        for (const facility of legacy) facilities.push({ ...facility, distanceMeters: haversineKm(latitude, longitude, facility.latitude, facility.longitude) * 1000 });
        facilities.sort((a, b) => (a.distanceMeters ?? Infinity) - (b.distanceMeters ?? Infinity));
        facilities = facilities.slice(0, limit);
        if (legacy.length && queryMode === 'geospatial') queryMode = 'geospatial_with_legacy_fallback';
      }
    } else {
      facilities = await SafetyFacility.find(filter).sort({ name: 1 }).limit(limit).lean();
    }
    const output = facilities.map((facility) => ({ ...facility, distanceKm: Number.isFinite(facility.distanceMeters) ? Math.round(facility.distanceMeters / 100) / 10 : null }));
    res.json({ success: true, facilities: output, queryMode, note: hasLocation ? undefined : 'Send lat/lng to sort by actual geographic distance.' });
  } catch (error) { next(error); }
});

router.get('/', async (req, res, next) => {
  try {
    const filter = {};
    if (facilityTypes.includes(req.query.type)) filter.type = req.query.type;
    if (req.query.active !== 'false' && req.user.role !== 'admin') filter.active = true;
    const search = clean(req.query.search, 140).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (search) filter.$or = [{ name: new RegExp(search, 'i') }, { address: new RegExp(search, 'i') }];
    const limit = Math.min(Math.max(Number(req.query.limit) || 300, 1), 500);
    res.json({ success: true, facilities: await SafetyFacility.find(filter).sort({ type: 1, name: 1 }).limit(limit) });
  } catch (error) { next(error); }
});

router.post('/', requireRole(...managerRoles), async (req, res, next) => {
  try {
    const { error, value } = payload(req.body);
    if (error) return res.status(400).json({ success: false, message: error });
    const facility = await SafetyFacility.create({ ...value, createdBy: req.user._id });
    res.status(201).json({ success: true, facility });
  } catch (error) { next(error); }
});

router.patch('/:id', requireRole(...managerRoles), async (req, res, next) => {
  try {
    if (!isId(req.params.id)) return res.status(404).json({ success: false, message: 'Facility not found.' });
    const existing = await SafetyFacility.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: 'Facility not found.' });
    const { error, value } = payload({ ...existing.toObject(), ...req.body });
    if (error) return res.status(400).json({ success: false, message: error });
    Object.assign(existing, value);
    await existing.save();
    res.json({ success: true, facility: existing });
  } catch (error) { next(error); }
});

router.delete('/:id', requireRole('admin'), async (req, res, next) => {
  try {
    if (!isId(req.params.id)) return res.status(404).json({ success: false, message: 'Facility not found.' });
    await SafetyFacility.deleteOne({ _id: req.params.id });
    res.status(204).end();
  } catch (error) { next(error); }
});

export default router;