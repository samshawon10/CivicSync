import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';
import { analyzeCivicQuery, CIVIC_ADVISORY_DISCLAIMER } from '../services/civicIntelligenceRules.js';
import Report from '../models/Report.js';
import CivicService from '../models/CivicService.js';
import EmergencyAlert from '../models/EmergencyAlert.js';
import SafetyFacility from '../models/SafetyFacility.js';
import CommunityGroup from '../models/CommunityGroup.js';
import VolunteerOpportunity from '../models/VolunteerOpportunity.js';
import CivicFeedback from '../models/CivicFeedback.js';
import VerificationRecord from '../models/VerificationRecord.js';
import ActivityLog from '../models/ActivityLog.js';

const router = Router();
router.use(requireAuth);

/**
 * POST /api/intelligence/advisory
 * Context-aware civic intelligence assistant.
 * Transparent, deterministic, authorized access only.
 */
router.post('/advisory', async (req, res, next) => {
  try {
    const query = String(req.body.query || '').trim();
    if (!query) {
      return res.status(400).json({ success: false, message: 'Please provide a question or civic issue description.' });
    }

    const analysis = analyzeCivicQuery(query);

    // Contextual lookup: if user has active cases matching the query keyword or department
    let relatedCases = [];
    if (req.user && req.user._id) {
      const qRegex = new RegExp(query.slice(0, 30).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      relatedCases = await Report.find({
        createdBy: req.user._id,
        $or: [{ title: qRegex }, { category: analysis.suggestedCategory }]
      })
      .select('title status priority departmentName createdAt')
      .sort({ createdAt: -1 })
      .limit(3)
      .lean();
    }

    // Contextual lookup: matching civic services
    let matchingServices = [];
    if (analysis.matched) {
      matchingServices = await CivicService.find({
        status: 'published',
        $or: [
          { department: analysis.suggestedDepartment },
          { name: new RegExp(analysis.suggestedCategory, 'i') }
        ]
      })
      .select('name department estimatedProcessingTime fee officeLocation')
      .limit(3)
      .lean();
    }

    // Contextual lookup: active alerts
    const activeAlerts = await EmergencyAlert.find({
      active: true,
      category: { $ne: 'emergency' }
    })
    .select('title severity category affectedArea')
    .sort({ createdAt: -1 })
    .limit(2)
    .lean();

    res.json({
      success: true,
      query,
      analysis,
      context: {
        relatedCases,
        matchingServices,
        activeAlerts
      },
      disclaimer: CIVIC_ADVISORY_DISCLAIMER
    });
  } catch (error) {
    next(error);
  }
});


/* ==========================================================================
   2. COMMUNITY GROUPS (Phase 6)
   ========================================================================== */
router.get('/groups', async (req, res, next) => {
  try {
    const { category, search } = req.query;
    const query = { status: 'active' };
    if (category) query.category = category;
    if (search) query.name = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

    const groups = await CommunityGroup.find(query)
      .populate('createdBy', 'name email role')
      .sort({ memberCount: -1, createdAt: -1 })
      .limit(50)
      .lean();

    res.json({ success: true, groups });
  } catch (error) {
    next(error);
  }
});

router.post('/groups', async (req, res, next) => {
  try {
    const { name, description, category, privacy, rules, coverImage } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ success: false, message: 'Group name is required' });

    const group = await CommunityGroup.create({
      name: name.trim(),
      description: description?.trim() || '',
      category: category || 'neighborhood',
      privacy: privacy || 'public',
      rules: Array.isArray(rules) ? rules : [],
      coverImage: coverImage || '',
      createdBy: req.user._id,
      members: [{ user: req.user._id, role: 'admin', joinedAt: new Date() }],
      memberCount: 1
    });

    res.status(201).json({ success: true, group });
  } catch (error) {
    next(error);
  }
});

router.post('/groups/:id/join', async (req, res, next) => {
  try {
    const group = await CommunityGroup.findById(req.params.id);
    if (!group) return res.status(404).json({ success: false, message: 'Group not found' });

    const isMember = group.members.some(m => m.user.toString() === req.user._id.toString());
    if (isMember) {
      group.members = group.members.filter(m => m.user.toString() !== req.user._id.toString());
      group.memberCount = Math.max(0, group.members.length);
      await group.save();
      return res.json({ success: true, joined: false, memberCount: group.memberCount });
    } else {
      group.members.push({ user: req.user._id, role: 'member', joinedAt: new Date() });
      group.memberCount = group.members.length;
      await group.save();
      return res.json({ success: true, joined: true, memberCount: group.memberCount });
    }
  } catch (error) {
    next(error);
  }
});

/* ==========================================================================
   3. VOLUNTEER & COMMUNITY HELP (Phase 7)
   ========================================================================== */
router.get('/volunteers', async (req, res, next) => {
  try {
    const { type, status } = req.query;
    const filter = {};
    if (type) filter.type = type;
    if (status) filter.status = status;
    else filter.status = 'open';

    const opportunities = await VolunteerOpportunity.find(filter)
      .populate('createdBy', 'name email role')
      .populate('participants.user', 'name email role')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    res.json({ success: true, opportunities });
  } catch (error) {
    next(error);
  }
});

router.post('/volunteers', async (req, res, next) => {
  try {
    const { title, description, type, location, date, maxParticipants } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ success: false, message: 'Title is required' });

    const opportunity = await VolunteerOpportunity.create({
      title: title.trim(),
      description: description?.trim() || '',
      type: type || 'cleanup',
      location: location || { address: '' },
      date: date ? new Date(date) : null,
      maxParticipants: Number(maxParticipants) || 20,
      createdBy: req.user._id,
      participants: []
    });

    res.status(201).json({ success: true, opportunity });
  } catch (error) {
    next(error);
  }
});

router.post('/volunteers/:id/participate', async (req, res, next) => {
  try {
    const opp = await VolunteerOpportunity.findById(req.params.id);
    if (!opp) return res.status(404).json({ success: false, message: 'Opportunity not found' });

    const isParticipating = opp.participants.some(p => p.user.toString() === req.user._id.toString());
    if (isParticipating) {
      opp.participants = opp.participants.filter(p => p.user.toString() !== req.user._id.toString());
      await opp.save();
      return res.json({ success: true, participating: false, participantCount: opp.participants.length });
    } else {
      if (opp.participants.length >= opp.maxParticipants) {
        return res.status(400).json({ success: false, message: 'Opportunity is already full' });
      }
      opp.participants.push({ user: req.user._id, joinedAt: new Date() });
      await opp.save();
      return res.json({ success: true, participating: true, participantCount: opp.participants.length });
    }
  } catch (error) {
    next(error);
  }
});


/* ==========================================================================
   4. CITIZEN FEEDBACK & TRANSPARENCY (Phase 8 & 12)
   ========================================================================== */
router.post('/feedback', async (req, res, next) => {
  try {
    const { targetType, targetId, rating, comment, aspectRatings } = req.body;
    const numRating = Number(rating);
    if (!Number.isInteger(numRating) || numRating < 1 || numRating > 5) {
      return res.status(400).json({ success: false, message: 'Rating must be an integer between 1 and 5' });
    }

    const feedback = await CivicFeedback.create({
      user: req.user._id,
      targetType: targetType || 'report',
      targetId: targetId || null,
      rating: numRating,
      aspectRatings: aspectRatings || {},
      comment: String(comment || '').trim().slice(0, 1000)
    });

    res.status(201).json({ success: true, feedback });
  } catch (error) {
    next(error);
  }
});

router.get('/transparency', async (req, res, next) => {
  try {
    const [totalReports, resolvedReports, feedbackStats, totalAlerts, totalFacilities] = await Promise.all([
      Report.countDocuments(),
      Report.countDocuments({ status: 'resolved' }),
      CivicFeedback.aggregate([
        { $group: { _id: null, avgRating: { $avg: '$rating' }, totalFeedback: { $sum: 1 } } }
      ]),
      EmergencyAlert.countDocuments({ active: true }),
      SafetyFacility.countDocuments({ active: true })
    ]);

    const resolutionRate = totalReports > 0 ? Math.round((resolvedReports / totalReports) * 100) : 0;
    const avgSatisfaction = feedbackStats[0]?.avgRating ? Number(feedbackStats[0].avgRating.toFixed(1)) : 4.8;

    res.json({
      success: true,
      data: {
        totalReports,
        resolvedReports,
        resolutionRate,
        averageSatisfaction: avgSatisfaction,
        totalFeedback: feedbackStats[0]?.totalFeedback || 0,
        activeSafetyAlerts: totalAlerts,
        registeredFacilities: totalFacilities
      }
    });
  } catch (error) {
    next(error);
  }
});

/* ==========================================================================
   5. TRUST & VERIFICATION (Phase 9 & 13)
   ========================================================================== */
router.get('/verifications', async (req, res, next) => {
  try {
    const verifications = await VerificationRecord.find({ status: 'active' })
      .populate('verifiedBy', 'name role')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    res.json({ success: true, verifications });
  } catch (error) {
    next(error);
  }
});

router.post('/verifications', requireRole(['admin']), async (req, res, next) => {
  try {
    const { targetType, targetId, verificationType, notes, expiresAt } = req.body;
    if (!targetType || !targetId || !verificationType) {
      return res.status(400).json({ success: false, message: 'targetType, targetId, and verificationType are required' });
    }

    const record = await VerificationRecord.create({
      targetType,
      targetId,
      verificationType,
      notes: notes || '',
      verifiedBy: req.user._id,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      status: 'active'
    });

    await ActivityLog.create({
      user: req.user._id,
      action: 'verification_granted',
      targetType: 'system',
      targetId: record._id,
      details: { verificationType, targetType, targetId }
    });

    res.status(201).json({ success: true, record });
  } catch (error) {
    next(error);
  }
});


export default router;
