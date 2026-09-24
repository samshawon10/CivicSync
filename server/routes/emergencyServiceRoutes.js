import { Router } from 'express';
import mongoose from 'mongoose';
import SafetyFacility from '../models/SafetyFacility.js';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';
import { haversineKm } from '../services/emergencyIntelligence.js';

const facilityTypes = ['hospital', 'police', 'fire_station', 'ambulance', 'shelter', 'safe_point'];
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
      phone: clean(body.phone, 30),
      ...(typeof body.available === 'boolean' ? { available: body.available } : {}),
      ...(typeof body.active === 'boolean' ? { active: body.active } : {})
    }
  };
}

const router = Router();
router.use(requireAuth);

router.get('/nearby', async (req, res, next) => {
  try {
    const latitude = Number(req.query.lat);
    const longitude = Number(req.query.lng);
    const filter = { active: true };
    if (facilityTypes.includes(req.query.type)) filter.type = req.query.type;
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    let facilities = await SafetyFacility.find(filter).sort({ name: 1 }).limit(limit).lean();
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      facilities = facilities
        .map((facility) => ({ ...facility, distanceKm: haversineKm(latitude, longitude, facility.latitude, facility.longitude) }))
        .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
    }
    res.json({ success: true, facilities, note: Number.isFinite(latitude) && Number.isFinite(longitude) ? undefined : 'Send lat/lng to sort by distance.' });
  } catch (error) { next(error); }
});

router.get('/', async (req, res, next) => {
  try {
    const filter = {};
    if (facilityTypes.includes(req.query.type)) filter.type = req.query.type;
    if (req.query.active !== 'false' && req.user.role !== 'admin') filter.active = true;
    res.json({ success: true, facilities: await SafetyFacility.find(filter).sort({ type: 1, name: 1 }) });
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