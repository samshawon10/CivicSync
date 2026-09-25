/**
 * Context Engine (task §11, §13).
 *
 * Injects role-authorized civic ground truth into prompt context before tool execution.
 * Pre-retrieves scoped records so the model can ground its answers deterministically.
 */
import Report from '../../models/Report.js';
import Emergency from '../../models/Emergency.js';
import EmergencyResponseAssignment from '../../models/EmergencyResponseAssignment.js';
import EmergencyAlert from '../../models/EmergencyAlert.js';
import ResponseTeam from '../../models/ResponseTeam.js';
import CivicService from '../../models/CivicService.js';
import SafetyFacility from '../../models/SafetyFacility.js';
import { calculateDepartmentSla } from '../../services/departmentSla.js';
import { getReportNextAction } from '../../services/nextAction.js';
import { reportScopeFilter, emergencyScopeFilter, departmentNameFor, caseSummary } from '../tools/scope.js';
import { casePath, emergencyPath } from '../tools/paths.js';

export async function buildContextForUser({ user, pageContext = {} } = {}) {
  if (!user || !user.role) {
    return { contextText: '{}', verifiedData: {}, citations: [] };
  }

  const role = user.role;
  const verifiedData = {};
  const citations = [];

  try {
    // 1. If pageContext specifies a caseId or emergencyId, fetch directly
    if (pageContext?.caseId) {
      const scope = await reportScopeFilter(user);
      if (scope) {
        const directCase = await Report.findOne({ ...scope, _id: pageContext.caseId })
          .populate('department', 'name')
          .lean();
        if (directCase) {
          const sla = calculateDepartmentSla(directCase);
          const nextAction = getReportNextAction(directCase);
          const summary = caseSummary({ ...directCase, sla, nextAction }, { viewer: user });
          verifiedData.currentFocusCase = summary;
          citations.push({
            type: 'case',
            id: String(directCase._id),
            label: `${summary.reference || 'CASE'} · ${directCase.title}`,
            path: casePath(user, directCase._id)
          });
        }
      }
    }
    if (pageContext?.emergencyId) {
      const scope = await emergencyScopeFilter(user);
      if (scope) {
        const directEmergency = await Emergency.findOne({ ...scope, _id: pageContext.emergencyId })
          .populate('assignedDepartment', 'name')
          .lean();
        if (directEmergency) {
          verifiedData.currentFocusEmergency = {
            id: String(directEmergency._id),
            reference: directEmergency.emergencyId,
            title: directEmergency.title,
            category: directEmergency.category,
            severity: directEmergency.severity,
            status: directEmergency.status,
            address: directEmergency.location?.address || ''
          };
          citations.push({
            type: 'emergency',
            id: String(directEmergency._id),
            label: `${directEmergency.emergencyId} · ${directEmergency.title}`,
            path: emergencyPath(user, directEmergency._id)
          });
        }
      }
    }

    // 2. Role-specific context pre-fetching
    if (role === 'citizen') {
      const myReports = await Report.find({ citizen: user._id }).sort({ updatedAt: -1 }).limit(5).lean();
      const activeAlerts = await EmergencyAlert.find({ active: true, status: 'active' }).select('title message category severity affectedArea').sort({ createdAt: -1 }).limit(3).lean();
      verifiedData.myRecentCases = myReports.map((r) => caseSummary(r, { viewer: user }));
      verifiedData.activeAlerts = activeAlerts.map((a) => ({ id: String(a._id), title: a.title, severity: a.severity, category: a.category, area: a.affectedArea || '' }));
      for (const r of myReports) {
        citations.push({ type: 'case', id: String(r._id), label: `CASE-${String(r._id).slice(-6).toUpperCase()} · ${r.title}`, path: casePath(user, r._id) });
      }
    } else if (role === 'department_head' || role === 'department_officer') {
      const scope = await reportScopeFilter(user);
      if (scope) {
        const recentCases = await Report.find(scope).sort({ updatedAt: -1 }).limit(6).lean();
        const evaluated = recentCases.map((r) => ({ ...r, sla: calculateDepartmentSla(r), nextAction: getReportNextAction(r) }));
        verifiedData.department = departmentNameFor(user);
        verifiedData.activeCases = evaluated.map((r) => caseSummary(r, { viewer: user }));
        for (const r of evaluated) {
          citations.push({ type: 'case', id: String(r._id), label: `CASE-${String(r._id).slice(-6).toUpperCase()} · ${r.title}`, path: casePath(user, r._id) });
        }
      }
    } else if (role === 'field_worker') {
      const myTasks = await Report.find({ assignedFieldWorker: user._id, status: { $in: ['assigned', 'in_progress'] } }).sort({ priority: 1, updatedAt: -1 }).limit(5).lean();
      verifiedData.myAssignedTasks = myTasks.map((t) => caseSummary(t, { viewer: user }));
      for (const t of myTasks) {
        citations.push({ type: 'case', id: String(t._id), label: `CASE-${String(t._id).slice(-6).toUpperCase()} · ${t.title}`, path: casePath(user, t._id) });
      }
    } else if (role === 'emergency_department_head') {
      const activeEmergencies = await Emergency.find({ status: { $in: ['reported', 'verified', 'dispatched', 'in_progress'] } }).select('emergencyId title category severity status location createdAt').sort({ severity: 1, createdAt: -1 }).limit(6).lean();
      const availableTeams = await ResponseTeam.find({ active: true, availability: 'available' }).select('name type').limit(6).lean();
      verifiedData.activeEmergencies = activeEmergencies.map((e) => ({ id: String(e._id), reference: e.emergencyId, title: e.title, severity: e.severity, status: e.status }));
      verifiedData.availableResponseTeams = availableTeams.map((t) => ({ id: String(t._id), name: t.name, type: t.type }));
      for (const e of activeEmergencies) {
        citations.push({ type: 'emergency', id: String(e._id), label: `${e.emergencyId} · ${e.title}`, path: emergencyPath(user, e._id) });
      }
    } else if (role === 'emergency_officer' || role === 'emergency_field_worker') {
      const assignments = await EmergencyResponseAssignment.find({
        $or: [{ emergencyOfficer: user._id }, { fieldWorkers: user._id }],
        status: { $in: ['assigned', 'accepted', 'en_route', 'on_scene', 'responding'] }
      }).populate('emergency', 'emergencyId title category severity status location').sort({ updatedAt: -1 }).limit(5).lean();
      verifiedData.myActiveAssignments = assignments.map((a) => ({ id: String(a._id), reference: a.emergency?.emergencyId || null, title: a.emergency?.title || null, severity: a.emergency?.severity || null, status: a.status, etaMinutes: a.etaMinutes ?? null }));
      for (const a of assignments) {
        if (a.emergency) citations.push({ type: 'emergency', id: String(a.emergency._id), label: `${a.emergency.emergencyId} · ${a.emergency.title}`, path: emergencyPath(user, a.emergency._id) });
      }
    } else if (role === 'admin') {
      const [caseCount, emergencyCount, facilityCount, serviceCount] = await Promise.all([
        Report.countDocuments(),
        Emergency.countDocuments({ status: { $in: ['reported', 'verified', 'dispatched', 'in_progress'] } }),
        SafetyFacility.countDocuments({ active: true }),
        CivicService.countDocuments({ status: 'published' })
      ]);
      verifiedData.platformOverview = { totalReports: caseCount, activeEmergencies: emergencyCount, safetyFacilities: facilityCount, publishedServices: serviceCount };
    }

  } catch (err) {
    console.error('[contextEngine] error retrieving grounding context:', err);
  }

  const contextText = JSON.stringify(verifiedData, null, 2);
  return { contextText, verifiedData, citations };
}
