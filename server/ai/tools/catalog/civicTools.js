/**
 * Civic reference tools (task §21, §35). Read-only and deterministic.
 *
 * `classifyCivicIssue` and the emergency classification tool expose the
 * platform's EXISTING rule engines (services/civicIntelligenceRules.js and
 * services/emergencyIntelligence.js). Rules stay the source of truth for
 * classification, routing and severity; the LLM only explains them (§35, §36).
 */
import SafetyFacility from '../../../models/SafetyFacility.js';
import EmergencyAlert from '../../../models/EmergencyAlert.js';
import Department from '../../../models/Department.js';
import Report from '../../../models/Report.js';
import Emergency from '../../../models/Emergency.js';
import CivicService from '../../../models/CivicService.js';
import { analyzeCivicQuery, CIVIC_ADVISORY_DISCLAIMER } from '../../../services/civicIntelligenceRules.js';
import { emergencyTypeCatalog } from '../../../config/emergencyOptions.js';
import { departmentSlaTargets } from '../../../services/departmentSla.js';
import { reportCategories, reportDepartments, reportPriorities, reportStatuses } from '../../../config/reportOptions.js';
import { TOOL_RISK } from '../toolRegistry.js';
import { facilityPath, alertPath, directoryPath } from '../paths.js';

const allRoles = ['citizen', 'admin', 'department_head', 'department_officer', 'officer', 'field_worker', 'emergency_department_head', 'emergency_department_officer', 'emergency_officer', 'emergency_field_worker'];

/** Great-circle distance in km (same formula as services/emergencyIntelligence.js). */
function distanceKm(lat1, lon1, lat2, lon2) {
  if (![lat1, lon1, lat2, lon2].every((value) => Number.isFinite(Number(value)))) return null;
  const toRad = (value) => (Number(value) * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
}

export const civicTools = [
  {
    name: 'getNearbyFacilities',
    category: 'civic',
    risk: TOOL_RISK.read,
    description: 'Registered safety facilities, optionally sorted by distance from a point and filtered by facility type.',
    inputs: 'type?:string, latitude?:number, longitude?:number, radiusKm?:number, limit?:number',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        type: { type: 'string', maxLength: 40 },
        latitude: { type: 'number', minimum: -90, maximum: 90 },
        longitude: { type: 'number', minimum: -180, maximum: 180 },
        radiusKm: { type: 'number', minimum: 0.5, maximum: 50 },
        limit: { type: 'integer', minimum: 1, maximum: 20 }
      }
    },
    roles: allRoles,
    permission: { resource: 'services', action: 'view' },
    async handler({ input }) {
      const filter = { active: true };
      if (input.type) filter.type = input.type;
      const rows = await SafetyFacility.find(filter)
        .select('name type address latitude longitude phone emergencyPhone openingHours status available emergencyServiceAvailable')
        .limit(120)
        .lean();
      const withDistance = rows.map((row) => ({
        id: String(row._id),
        name: row.name,
        type: row.type,
        address: row.address || '',
        phone: row.emergencyPhone || row.phone || '',
        openingHours: row.openingHours || null,
        status: row.status,
        available: row.available,
        distanceKm: distanceKm(input.latitude, input.longitude, row.latitude, row.longitude)
      }));
      const nearby = input.latitude !== undefined && input.longitude !== undefined;
      if (nearby) {
        withDistance.sort((left, right) => (left.distanceKm ?? 9999) - (right.distanceKm ?? 9999));
      }
      const limited = withDistance
        .filter((row) => !nearby || input.radiusKm === undefined || (row.distanceKm !== null && row.distanceKm <= input.radiusKm))
        .slice(0, Math.min(Number(input.limit) || 8, 20));
      return {
        data: {
          facilities: limited,
          basis: nearby ? 'Sorted by straight-line distance from the supplied point.' : 'Registry order (no location supplied by the user).',
          note: limited.length ? undefined : 'No registered/active facility matches those filters.'
        },
        citations: limited.map((row) => ({ type: 'facility', id: row.id, label: row.name, path: facilityPath() }))
      };
    }
  },

  {
    name: 'getSafetyAlerts',
    category: 'civic',
    risk: TOOL_RISK.read,
    description: 'Active public safety alerts and advisories published by the platform.',
    inputs: 'category?:string, limit?:number',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: { category: { type: 'string', maxLength: 40 }, limit: { type: 'integer', minimum: 1, maximum: 15 } }
    },
    roles: allRoles,
    permission: { resource: 'alerts', action: 'view' },
    async handler({ input }) {
      const filter = { active: true, status: 'active' };
      if (input.category) filter.category = input.category;
      const rows = await EmergencyAlert.find(filter)
        .select('title message category severity affectedArea radiusKm startAt endAt createdAt')
        .sort({ createdAt: -1 })
        .limit(Math.min(Number(input.limit) || 6, 15))
        .lean();
      return {
        data: {
          alerts: rows.map((row) => ({ id: String(row._id), title: row.title, message: row.message, category: row.category, severity: row.severity, affectedArea: row.affectedArea || '', startAt: row.startAt, endAt: row.endAt, publishedAt: row.createdAt })),
          note: rows.length ? undefined : 'No active public safety alert is currently published.'
        },
        citations: rows.map((row) => ({ type: 'alert', id: String(row._id), label: row.title, path: alertPath() }))
      };
    }
  },
  {
    name: 'getCivicInformation',
    category: 'civic',
    risk: TOOL_RISK.read,
    description: 'Platform reference information: report categories, departments, priorities, case statuses, SLA targets, emergency type catalogue and public transparency totals.',
    inputs: 'include?:string[]',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: { include: { type: 'array', maxItems: 8, items: { enum: ['categories', 'departments', 'priorities', 'statuses', 'sla', 'emergencyTypes', 'transparency'] } } }
    },
    roles: allRoles,
    async handler({ input }) {
      const wanted = new Set(input.include?.length ? input.include : ['categories', 'departments', 'priorities', 'statuses', 'sla']);
      const data = {};
      if (wanted.has('categories')) data.reportCategories = reportCategories;
      if (wanted.has('departments')) data.departments = reportDepartments;
      if (wanted.has('priorities')) data.priorities = reportPriorities;
      if (wanted.has('statuses')) data.caseStatuses = reportStatuses;
      if (wanted.has('sla')) data.slaTargetsMinutes = departmentSlaTargets;
      if (wanted.has('emergencyTypes')) data.emergencyTypes = emergencyTypeCatalog.map((item) => ({ key: item.key, label: item.label }));
      if (wanted.has('transparency')) {
        // Public aggregate counts only — the same numbers as /api/intelligence/transparency.
        const [totalReports, resolved, activeAlerts, facilities, services] = await Promise.all([
          Report.countDocuments(),
          Report.countDocuments({ status: 'resolved' }),
          EmergencyAlert.countDocuments({ active: true }),
          SafetyFacility.countDocuments({ active: true }),
          CivicService.countDocuments({ status: 'published' })
        ]);
        data.transparency = { totalReports, resolvedReports: resolved, activeAlerts, registeredFacilities: facilities, publishedServices: services };
      }
      return { data, citations: [] };
    }
  },
  {
    name: 'getDepartmentDirectory',
    category: 'civic',
    risk: TOOL_RISK.read,
    description: 'Active civic department directory with contact details recorded on the platform.',
    inputs: 'limit?:number',
    inputSchema: { type: 'object', additionalProperties: false, properties: { limit: { type: 'integer', minimum: 1, maximum: 50 } } },
    roles: allRoles,
    async handler({ input }) {
      const rows = await Department.find({ status: 'active' })
        .select('name type scope description contactNumber email address')
        .sort({ name: 1 })
        .limit(Math.min(Number(input.limit) || 25, 50))
        .lean();
      return {
        data: {
          departments: rows.map((row) => ({ id: String(row._id), name: row.name, type: row.type || '', scope: row.scope, description: row.description || '', contactNumber: row.contactNumber || '', email: row.email || '', address: row.address || '' })),
          note: rows.length ? undefined : 'No active department is registered.'
        },
        citations: rows.map((row) => ({ type: 'department', id: String(row._id), label: row.name, path: directoryPath() }))
      };
    }
  },
  {
    name: 'classifyCivicIssue',
    category: 'civic',
    risk: TOOL_RISK.read,
    description: 'Deterministic CivicSync rule-engine triage for a civic issue description: suggested department, category, related services and reporting guidance.',
    inputs: 'text:string',
    inputSchema: { type: 'object', additionalProperties: false, required: ['text'], properties: { text: { type: 'string', minLength: 4, maxLength: 600 } } },
    roles: allRoles,
    permission: { resource: 'services', action: 'view' },
    async handler({ input }) {
      const analysis = analyzeCivicQuery(input.text);
      return {
        data: {
          ...analysis,
          disclaimer: CIVIC_ADVISORY_DISCLAIMER,
          engine: 'civicsync_rules_v1',
          confident: Boolean(analysis.matched),
          note: 'Produced by the CivicSync deterministic rule engine, not by the language model.'
        },
        citations: []
      };
    }
  }
];

export { distanceKm };
