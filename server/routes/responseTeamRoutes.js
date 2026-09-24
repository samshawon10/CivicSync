import { Router } from 'express';
import mongoose from 'mongoose';
import ResponseTeam from '../models/ResponseTeam.js';
import User from '../models/User.js';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';

const teamTypes = ['medical', 'fire', 'security', 'traffic', 'disaster', 'rescue', 'infrastructure', 'other'];
const managerRoles = ['admin', 'emergency_department_head'];
const isId = (value) => mongoose.Types.ObjectId.isValid(value);
const clean = (value, max = 300) => String(value || '').trim().slice(0, max);

function buildValue(body) {
  const latitude = body.baseLatitude !== undefined ? Number(body.baseLatitude) : body.baseLocation?.latitude !== undefined ? Number(body.baseLocation.latitude) : null;
  const longitude = body.baseLongitude !== undefined ? Number(body.baseLongitude) : body.baseLocation?.longitude !== undefined ? Number(body.baseLocation.longitude) : null;
  if (!clean(body.name, 120) || !teamTypes.includes(body.type)) return { error: 'A team name and valid type are required.' };
  if ((latitude === null) !== (longitude === null)) return { error: 'Provide both base coordinates or omit both.' };
  if ((latitude !== null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) || (longitude !== null && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180))) return { error: 'Base location coordinates are invalid.' };
  return {
    value: {
      name: clean(body.name, 120),
      type: body.type,
      phone: clean(body.phone, 30),
      baseLocation: { address: clean(body.baseLocation?.address ?? body.baseAddress, 300), latitude, longitude },
      ...(typeof body.availability === 'string' && ['available', 'busy', 'offline'].includes(body.availability) ? { availability: body.availability } : {}),
      ...(typeof body.active === 'boolean' ? { active: body.active } : {})
    }
  };
}

const router = Router();
router.use(requireAuth);

router.get('/', requireRole('admin', 'emergency_department_head', 'emergency_department_officer', 'emergency_officer'), async (req, res, next) => {
  try {
    const filter = req.user.role === 'admin' && req.query.all === 'true' ? {} : { active: true };
    if (teamTypes.includes(req.query.type)) filter.type = req.query.type;
    const teams = await ResponseTeam.find(filter).populate('members.user', 'name role phone').sort({ type: 1, name: 1 });
    res.json({ success: true, teams });
  } catch (error) { next(error); }
});

router.post('/', requireRole(...managerRoles), async (req, res, next) => {
  try {
    const { error, value } = buildValue(req.body);
    if (error) return res.status(400).json({ success: false, message: error });
    const rawMemberIds = req.body.memberIds ?? [];
    if (!Array.isArray(rawMemberIds)) return res.status(400).json({ success: false, message: 'memberIds must be an array.' });
    const requestedMemberIds = [...new Set(rawMemberIds.map(String))];
    if (requestedMemberIds.some((id) => !isId(id))) return res.status(400).json({ success: false, message: 'Select valid response team member IDs.' });
    const validMembers = await User.find({ _id: { $in: requestedMemberIds }, role: { $in: ['emergency_officer', 'emergency_field_worker'] }, status: 'active' }).select('_id');
    if (validMembers.length !== requestedMemberIds.length) return res.status(400).json({ success: false, message: 'Response team members must be active emergency responders.' });
    const team = await ResponseTeam.create({ ...value, members: validMembers.map((user) => ({ user: user._id })), createdBy: req.user._id });
    res.status(201).json({ success: true, team });
  } catch (error) { next(error); }
});

router.patch('/:id', requireRole(...managerRoles), async (req, res, next) => {
  try {
    if (!isId(req.params.id)) return res.status(404).json({ success: false, message: 'Response team not found.' });
    const team = await ResponseTeam.findById(req.params.id);
    if (!team) return res.status(404).json({ success: false, message: 'Response team not found.' });
    const { error, value } = buildValue({ ...team.toObject(), ...req.body, baseLocation: { ...team.baseLocation.toObject?.(), ...(req.body.baseLocation || {}) } });
    if (error) return res.status(400).json({ success: false, message: error });
    Object.assign(team, value);
    if (req.body.memberIds !== undefined) {
      if (!Array.isArray(req.body.memberIds)) return res.status(400).json({ success: false, message: 'memberIds must be an array.' });
      const requestedMemberIds = [...new Set(req.body.memberIds.map(String))];
      if (requestedMemberIds.some((id) => !isId(id))) return res.status(400).json({ success: false, message: 'Select valid response team member IDs.' });
      const validMembers = await User.find({ _id: { $in: requestedMemberIds }, role: { $in: ['emergency_officer', 'emergency_field_worker'] }, status: 'active' }).select('_id');
      if (validMembers.length !== requestedMemberIds.length) return res.status(400).json({ success: false, message: 'Response team members must be active emergency responders.' });
      team.members = validMembers.map((user) => ({ user: user._id }));
    }
    await team.save();
    res.json({ success: true, team });
  } catch (error) { next(error); }
});

router.delete('/:id', requireRole('admin'), async (req, res, next) => {
  try {
    if (!isId(req.params.id)) return res.status(404).json({ success: false, message: 'Response team not found.' });
    await ResponseTeam.deleteOne({ _id: req.params.id });
    res.status(204).end();
  } catch (error) { next(error); }
});

export default router;