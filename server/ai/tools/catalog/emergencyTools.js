/**
 * Emergency & responder tools (task §7).
 *
 * Emergency operations are strictly scoped:
 *   - Command roles (Super Admin, Emergency Head) see every incident and responder pool.
 *   - Responder roles (Emergency Officer, Emergency Field Worker) see ONLY the
 *     incidents they are assigned to (enforced via scope.js `emergencyScopeFilter`).
 *   - Citizen sees only emergencies they created.
 *
 * All tools are read-only advisory. The assistant NEVER dispatches, escalates,
 * or transitions an incident — these are human-command decisions executed in the
 * Emergency Command Center (§36).
 */
import mongoose from 'mongoose';
import Emergency from '../../../models/Emergency.js';
import EmergencyResponseAssignment from '../../../models/EmergencyResponseAssignment.js';
import ResponseTeam from '../../../models/ResponseTeam.js';
import User from '../../../models/User.js';
import { suggestEmergencyClassification } from '../../../services/emergencyIntelligence.js';
import { TOOL_RISK } from '../toolRegistry.js';
import { canViewEmergency, emergencyScopeFilter, emergencySummary, isEmergencyCommand } from '../scope.js';
import { emergencyPath } from '../paths.js';

const isId = (value) => mongoose.Types.ObjectId.isValid(value);
const emergencyAllStaff = ['admin', 'emergency_department_head', 'emergency_department_officer', 'emergency_officer', 'emergency_field_worker'];
const emergencyCommand = ['admin', 'emergency_department_head'];

export const emergencyTools = [
  {
    name: 'getIncidentBriefing',
    category: 'emergency',
    risk: TOOL_RISK.read,
    description: 'Operational briefing for one emergency: severity, status, location, responders on scene, active assignments, and timeline.',
    inputs: 'emergencyId:string',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['emergencyId'],
      properties: { emergencyId: { type: 'string', minLength: 4, maxLength: 40 } }
    },
    roles: emergencyAllStaff,
    permission: { resource: 'emergencies', action: 'view' },
    async handler({ user, input }) {
      const query = isId(input.emergencyId)
        ? { _id: input.emergencyId }
        : { emergencyId: String(input.emergencyId).trim().toUpperCase() };
      const incident = await Emergency.findOne(query)
        .populate('assignedDepartment', 'name')
        .populate('emergencyHead', 'name')
        .populate({
          path: 'responseAssignments',
          populate: [
            { path: 'emergencyOfficer', select: 'name role phone' },
            { path: 'fieldWorkers', select: 'name role phone' },
            { path: 'team', select: 'name type availability' }
          ]
        })
        .lean();
      if (!incident || !canViewEmergency(user, incident)) {
        return { data: null, note: 'No emergency matches that reference in your authorized scope.' };
      }
      const summary = emergencySummary(incident, user, { detail: true });
      return {
        data: summary,
        citations: [{
          type: 'emergency',
          id: String(incident._id),
          label: `${incident.emergencyId || 'EMERGENCY'} · ${incident.title}`,
          path: emergencyPath(user, incident._id)
        }]
      };
    }
  },
  {
    name: 'listActiveIncidents',
    category: 'emergency',
    risk: TOOL_RISK.read,
    description: 'Active emergencies in the caller authorized scope, ordered by severity and time.',
    inputs: 'severity?:string, category?:string, limit?:number',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
        category: { type: 'string', maxLength: 40 },
        limit: { type: 'integer', minimum: 1, maximum: 20 }
      }
    },
    roles: emergencyAllStaff,
    permission: { resource: 'emergencies', action: 'view' },
    async handler({ user, input }) {
      const scope = await emergencyScopeFilter(user);
      if (!scope) return { data: { incidents: [], total: 0 }, note: 'No emergency scope available.' };
      const filter = {
        ...scope,
        status: { $in: ['reported', 'verified', 'dispatched', 'in_progress'] }
      };
      if (input.severity) filter.severity = input.severity;
      if (input.category) filter.category = input.category;
      const incidents = await Emergency.find(filter)
        .select('emergencyId title category severity status location createdAt assignedDepartment')
        .populate('assignedDepartment', 'name')
        .sort({ severity: 1, createdAt: -1 })
        .limit(Math.min(Number(input.limit) || 10, 20))
        .lean();
      return {
        data: {
          incidents: incidents.map((item) => ({
            id: String(item._id),
            reference: item.emergencyId,
            title: item.title,
            category: item.category,
            severity: item.severity,
            status: item.status,
            address: item.location?.address || '',
            department: item.assignedDepartment?.name || null,
            reportedAt: item.createdAt
          })),
          total: incidents.length,
          note: incidents.length ? undefined : 'No active emergencies match the criteria.'
        },
        citations: incidents.map((item) => ({
          type: 'emergency',
          id: String(item._id),
          label: `${item.emergencyId} · ${item.title}`,
          path: emergencyPath(user, item._id)
        }))
      };
    }
  },
  {
    name: 'getMyResponderAssignments',
    category: 'emergency',
    risk: TOOL_RISK.read,
    description: 'Active emergency assignments dispatched to this responder, including team role, ETA, and incident status.',
    inputs: '(none)',
    inputSchema: { type: 'object', additionalProperties: false, properties: {} },
    roles: emergencyAllStaff,
    permission: { resource: 'assignments', action: 'view' },
    async handler({ user }) {
      const isCmd = isEmergencyCommand(user);
      const filter = isCmd
        ? { status: { $in: ['assigned', 'accepted', 'en_route', 'on_scene', 'responding'] } }
        : {
            $or: [{ emergencyOfficer: user._id }, { fieldWorkers: user._id }],
            status: { $in: ['assigned', 'accepted', 'en_route', 'on_scene', 'responding'] }
          };
      const assignments = await EmergencyResponseAssignment.find(filter)
        .populate('emergency', 'emergencyId title category severity status location')
        .populate('team', 'name type')
        .populate('emergencyOfficer', 'name role phone')
        .sort({ updatedAt: -1 })
        .limit(15)
        .lean();
      return {
        data: {
          assignments: assignments.map((a) => ({
            id: String(a._id),
            emergencyReference: a.emergency?.emergencyId || null,
            emergencyTitle: a.emergency?.title || null,
            severity: a.emergency?.severity || null,
            status: a.status,
            responseType: a.responseType,
            teamName: a.team?.name || a.responseTeam || null,
            address: a.emergency?.location?.address || '',
            etaMinutes: a.etaMinutes ?? null,
            assignedAt: a.assignedAt,
            acceptedAt: a.acceptedAt,
            notes: a.notes || ''
          })),
          note: assignments.length ? undefined : 'No active responder assignments found.'
        },
        citations: assignments.filter((a) => a.emergency).map((a) => ({
          type: 'emergency',
          id: String(a.emergency._id),
          label: `${a.emergency.emergencyId} · ${a.emergency.title}`,
          path: emergencyPath(user, a.emergency._id)
        }))
      };
    }
  },
  {
    name: 'getAvailableResponseTeams',
    category: 'emergency',
    risk: TOOL_RISK.read,
    description: 'List available response teams and active responder rosters for dispatch coordination. Command-only.',
    inputs: 'type?:string',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        type: { type: 'string', enum: ['medical', 'fire', 'security', 'traffic', 'disaster', 'rescue', 'infrastructure', 'other'] }
      }
    },
    roles: emergencyCommand,
    permission: { resource: 'teams', action: 'view' },
    async handler({ user, input }) {
      const filter = { active: true };
      if (input.type) filter.type = input.type;
      const teams = await ResponseTeam.find(filter)
        .populate('members.user', 'name role status')
        .sort({ availability: 1, name: 1 })
        .lean();
      return {
        data: {
          teams: teams.map((team) => ({
            id: String(team._id),
            name: team.name,
            type: team.type,
            availability: team.availability,
            phone: team.phone || '',
            baseAddress: team.baseLocation?.address || '',
            memberCount: (team.members || []).length,
            activeMembers: (team.members || [])
              .filter((m) => m.user?.status === 'active')
              .map((m) => ({ name: m.user.name, role: m.role || m.user.role }))
          })),
          note: 'Dispatching teams is performed in the Emergency Command Center by authorized heads.'
        },
        citations: []
      };
    }
  },
  {
    name: 'triageEmergencyIncident',
    category: 'emergency',
    risk: TOOL_RISK.read,
    description: 'Deterministic rule-based triage assessment for emergency free text: recommended severity, category, subcategory and required response teams.',
    inputs: 'title:string, description?:string',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['title'],
      properties: {
        title: { type: 'string', minLength: 3, maxLength: 200 },
        description: { type: 'string', maxLength: 3000 }
      }
    },
    roles: emergencyCommand,
    permission: { resource: 'emergencies', action: 'view' },
    async handler({ input }) {
      const suggestion = suggestEmergencyClassification(input.title, input.description || '');
      return {
        data: {
          engine: 'civicsync_emergency_rules_v1',
          classification: suggestion,
          note: 'Advisory classification only. Emergency Command makes all binding triage and severity decisions.'
        },
        citations: []
      };
    }
  }

];
