/**
 * Department operations tools (task §7) — Department Head / Officer / Field Worker.
 *
 * All reads are department-scoped and reuse the platform's own deterministic
 * engines: services/departmentSla.js for SLA position, services/nextAction.js for
 * workflow ownership and services/departmentTeamScoring.js for allocation
 * recommendations. The AI reports the same numbers the dashboard does and never
 * mutates a case (§36).
 */
import Report from '../../../models/Report.js';
import User from '../../../models/User.js';
import DepartmentTeam from '../../../models/DepartmentTeam.js';
import DepartmentTask from '../../../models/DepartmentTask.js';
import DepartmentResource from '../../../models/DepartmentResource.js';
import { calculateDepartmentSla } from '../../../services/departmentSla.js';
import { getReportNextAction } from '../../../services/nextAction.js';
import { activeTaskStatuses, scoreTeamsForCase, taskCountsByTeam } from '../../../services/departmentTeamScoring.js';
import { TOOL_RISK } from '../toolRegistry.js';
import { caseSummary, departmentNameFor, reportScopeFilter } from '../scope.js';
import { casePath } from '../paths.js';

const operational = ['admin', 'department_head', 'department_officer', 'officer', 'field_worker'];
const CASE_SELECT = 'title category departmentName priority status dueAt escalation assignedOfficer assignedFieldWorker assignedTeam activeTask createdAt updatedAt sla';
const caseReference = (id) => `CASE-${String(id).slice(-6).toUpperCase()}`;
const cite = (user, row) => ({ type: 'case', id: String(row._id), label: `${caseReference(row._id)} · ${row.title}`, path: casePath(user, row._id) });
const populate = (query) => query
  .populate('assignedOfficer', 'name')
  .populate('assignedFieldWorker', 'name')
  .populate('assignedTeam', 'name status')
  .populate('activeTask');

export const departmentTools = [
  {
    name: 'getDepartmentCases',
    category: 'department',
    risk: TOOL_RISK.read,
    description: 'Cases in the caller\'s department scope, filterable by status, priority, category, overdue or escalated.',
    inputs: 'status?:string, priority?:string, category?:string, overdue?:boolean, escalated?:boolean, limit?:number',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        status: { type: 'string', enum: ['pending', 'verified', 'assigned', 'in_progress', 'under_review', 'completed', 'closed'] },
        priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
        category: { type: 'string', maxLength: 60 },
        overdue: { type: 'boolean' },
        escalated: { type: 'boolean' },
        limit: { type: 'integer', minimum: 1, maximum: 30 }
      }
    },
    roles: operational,
    permission: { resource: 'cases', action: 'view' },
    requiresDepartment: true,
    async handler({ user, input }) {
      const filter = reportScopeFilter(user);
      if (!filter) return { data: null, note: 'This account has no department case scope.' };
      const query = { ...filter };
      if (input.status) query.status = input.status;
      if (input.priority) query.priority = input.priority;
      if (input.category) query.category = input.category;
      if (input.escalated) { query['escalation.isEscalated'] = true; query['escalation.resolvedAt'] = null; }
      if (input.overdue) { query.dueAt = { $lt: new Date(), $ne: null }; query.$and = [...(query.$and || []), { status: { $nin: ['completed', 'closed'] } }]; }
      const rows = await populate(Report.find(query).select(CASE_SELECT).sort({ updatedAt: -1 }).limit(Math.min(Number(input.limit) || 15, 30))).lean();
      return {
        data: {
          department: departmentNameFor(user) || null,
          cases: rows.map((row) => caseSummary({ ...row, sla: calculateDepartmentSla(row), nextAction: getReportNextAction(row) }, { viewer: user })),
          total: rows.length,
          note: rows.length ? undefined : 'No case in your authorized scope matches those filters.'
        },
        citations: rows.map((row) => cite(user, row))
      };
    }
  },
  {
    name: 'getSLAStatus',
    category: 'department',
    risk: TOOL_RISK.read,
    description: 'Computed SLA position (response, arrival, resolution) for authorized open cases, highlighting breach and warning states.',
    inputs: 'state?:string, limit?:number',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: { state: { type: 'string', enum: ['breached', 'warning', 'all'] }, limit: { type: 'integer', minimum: 1, maximum: 30 } }
    },
    roles: ['admin', 'department_head', 'department_officer', 'officer'],
    permission: { resource: 'cases', action: 'view' },
    requiresDepartment: true,
    async handler({ user, input }) {
      const filter = reportScopeFilter(user);
      if (!filter) return { data: null, note: 'This account has no department case scope.' };
      const rows = await Report.find({ ...filter, status: { $nin: ['completed', 'closed'] } })
        .select('title status priority dueAt departmentName createdAt sla assignedOfficer')
        .populate('assignedOfficer', 'name')
        .sort({ dueAt: 1 })
        .limit(120)
        .lean();
      const evaluated = rows.map((row) => ({ row, sla: calculateDepartmentSla(row), nextAction: getReportNextAction(row) }));
      const wanted = input.state && input.state !== 'all' ? input.state : null;
      const filtered = (wanted ? evaluated.filter((item) => item.sla?.overallStatus === wanted) : evaluated).slice(0, Math.min(Number(input.limit) || 15, 30));
      return {
        data: {
          basis: 'CivicSync department SLA targets evaluated against live milestone data (services/departmentSla.js).',
          totals: {
            evaluated: evaluated.length,
            breached: evaluated.filter((item) => item.sla?.overallStatus === 'breached').length,
            warning: evaluated.filter((item) => item.sla?.overallStatus === 'warning').length
          },
          cases: filtered.map((item) => ({
            reference: caseReference(item.row._id),
            id: String(item.row._id),
            title: item.row.title,
            status: item.row.status,
            priority: item.row.priority,
            officer: item.row.assignedOfficer?.name || null,
            overallStatus: item.sla?.overallStatus || 'unknown',
            response: item.sla?.response || null,
            arrival: item.sla?.arrival || null,
            resolution: item.sla?.resolution || null,
            nextAction: item.nextAction || null
          }))
        },
        citations: filtered.map((item) => cite(user, item.row))
      };
    }
  },
  {
    name: 'getDepartmentWorkload',
    category: 'department',
    risk: TOOL_RISK.read,
    description: 'Department workload picture: case status mix, live officer/field-worker load, team status mix, task states and open escalations.',
    inputs: '(none)',
    inputSchema: { type: 'object', additionalProperties: false, properties: {} },
    roles: ['admin', 'department_head', 'department_officer'],
    permission: { resource: 'cases', action: 'view' },
    requiresDepartment: true,
    async handler({ user }) {
      const departmentName = departmentNameFor(user);
      if (!departmentName) return { data: null, note: 'This account has no department assignment.' };
      const filter = reportScopeFilter(user) || { departmentName };
      const [statusRows, priorityRows, staff, teamRows, taskRows, escalationCount, overdueCount] = await Promise.all([
        Report.aggregate([{ $match: filter }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
        Report.aggregate([{ $match: filter }, { $group: { _id: '$priority', count: { $sum: 1 } } }]),
        User.find({ departmentName, status: 'active', role: { $in: ['department_officer', 'officer', 'field_worker'] } }).select('name role').lean(),
        DepartmentTeam.aggregate([{ $match: { departmentName, active: true } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
        DepartmentTask.aggregate([{ $match: { departmentName } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
        Report.countDocuments({ ...filter, 'escalation.isEscalated': true, 'escalation.resolvedAt': null }),
        Report.countDocuments({ ...filter, dueAt: { $lt: new Date(), $ne: null }, status: { $nin: ['completed', 'closed'] } })
      ]);
      const liveLoad = await Report.aggregate([
        { $match: { ...filter, status: { $in: ['assigned', 'in_progress', 'under_review'] } } },
        { $facet: {
          officers: [{ $match: { assignedOfficer: { $ne: null } } }, { $group: { _id: '$assignedOfficer', count: { $sum: 1 } } }],
          workers: [{ $match: { assignedFieldWorker: { $ne: null } } }, { $group: { _id: '$assignedFieldWorker', count: { $sum: 1 } } }]
        } }
      ]);
      const counts = new Map();
      for (const row of [...(liveLoad[0]?.officers || []), ...(liveLoad[0]?.workers || [])]) {
        counts.set(String(row._id), (counts.get(String(row._id)) || 0) + row.count);
      }
      return {
        data: {
          department: departmentName,
          byStatus: Object.fromEntries(statusRows.map((row) => [row._id, row.count])),
          byPriority: Object.fromEntries(priorityRows.map((row) => [row._id, row.count])),
          openEscalations: escalationCount,
          overdueCases: overdueCount,
          teams: Object.fromEntries(teamRows.map((row) => [row._id, row.count])),
          tasks: Object.fromEntries(taskRows.map((row) => [row._id, row.count])),
          staffLoad: staff.map((person) => ({ name: person.name, role: person.role, liveCases: counts.get(String(person._id)) || 0 })),
          note: 'Counts come from live CivicSync records. An empty breakdown means there is genuinely no such case.'
        },
        citations: []
      };
    }
  },
  {
    name: 'getTeamAvailability',
    category: 'department',
    risk: TOOL_RISK.read,
    description: 'Response teams in the department with their live status and workload against capacity.',
    inputs: 'availableOnly?:boolean',
    inputSchema: { type: 'object', additionalProperties: false, properties: { availableOnly: { type: 'boolean' } } },
    roles: ['admin', 'department_head', 'department_officer', 'officer'],
    permission: { resource: 'cases', action: 'view' },
    requiresDepartment: true,
    async handler({ user, input }) {
      const departmentName = departmentNameFor(user);
      if (!departmentName) return { data: null, note: 'This account has no department assignment.' };
      const teams = await DepartmentTeam.find({ departmentName, active: true }).populate('leader', 'name').lean();
      const activeTasks = await DepartmentTask.aggregate([
        { $match: { team: { $in: teams.map((team) => team._id) }, status: { $in: activeTaskStatuses } } },
        { $group: { _id: '$team', count: { $sum: 1 } } }
      ]);
      const counts = taskCountsByTeam(activeTasks);
      const ranked = scoreTeamsForCase({ teams, taskCounts: counts, category: '' })
        .filter((team) => !input.availableOnly || team.status === 'available');
      return {
        data: {
          department: departmentName,
          teams: ranked.map((team) => ({ id: String(team._id), name: team.name, status: team.status, serviceArea: team.serviceArea || '', leader: team.leader?.name || null, capacity: team.capacity, liveTasks: team.currentWorkload, workloadPercent: team.workloadPercent, skills: team.skills || [] })),
          note: ranked.length ? undefined : 'No active response team matches that filter.'
        },
        citations: []
      };
    }
  },
  {
    name: 'getTeamRecommendations',
    category: 'department',
    risk: TOOL_RISK.read,
    description: 'Deterministic team allocation recommendation for one case, with the score and reasons behind it.',
    inputs: 'caseId:string',
    inputSchema: { type: 'object', additionalProperties: false, required: ['caseId'], properties: { caseId: { type: 'string', minLength: 6, maxLength: 40 } } },
    roles: ['admin', 'department_head', 'department_officer'],
    permission: { resource: 'cases', action: 'view' },
    requiresDepartment: true,
    async handler({ user, input }) {
      const departmentName = departmentNameFor(user);
      if (!departmentName) return { data: null, note: 'This account has no department assignment.' };
      const report = await Report.findById(input.caseId).select('title category priority status departmentName assignedTeam');
      if (!report || report.departmentName !== departmentName) return { data: null, note: 'No case in your department matches that id.' };
      const teams = await DepartmentTeam.find({ departmentName, active: true }).populate('leader', 'name').lean();
      const activeTasks = await DepartmentTask.aggregate([
        { $match: { team: { $in: teams.map((team) => team._id) }, status: { $in: activeTaskStatuses } } },
        { $group: { _id: '$team', count: { $sum: 1 } } }
      ]);
      const ranked = scoreTeamsForCase({ teams, taskCounts: taskCountsByTeam(activeTasks), category: report.category });
      return {
        data: {
          caseReference: caseReference(report._id),
          caseId: String(report._id),
          category: report.category,
          currentlyAssignedTeam: report.assignedTeam ? String(report.assignedTeam) : null,
          engine: 'civicsync_team_scoring_v1',
          recommendations: ranked.slice(0, 5).map((team) => ({ id: String(team._id), name: team.name, status: team.status, score: team.score, reasons: team.reasons, liveTasks: team.currentWorkload, capacity: team.capacity })),
          note: 'Advisory only. Assignment is performed by department staff in the case workspace; the assistant never assigns.'
        },
        citations: [{ type: 'case', id: String(report._id), label: `${caseReference(report._id)} · ${report.title}`, path: casePath(user, report._id) }]
      };
    }
  },
  {
    name: 'getMyFieldTasks',
    category: 'department',
    risk: TOOL_RISK.read,
    description: 'Field tasks assigned to this user: task status, target time, blocking reason and the case they belong to.',
    inputs: 'includeCompleted?:boolean, limit?:number',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: { includeCompleted: { type: 'boolean' }, limit: { type: 'integer', minimum: 1, maximum: 20 } }
    },
    roles: operational,
    permission: { resource: 'cases', action: 'view' },
    requiresDepartment: true,
    async handler({ user, input }) {
      const departmentName = departmentNameFor(user);
      if (!departmentName) return { data: null, note: 'This account has no department assignment.' };
      const filter = { departmentName };
      // Field workers only ever see their own assignments (services/departmentTaskAccess.js).
      if (user.role === 'field_worker') filter.assignedWorker = user._id;
      if (!input.includeCompleted) filter.status = { $nin: ['completed', 'cancelled', 'rejected'] };
      const tasks = await DepartmentTask.find(filter)
        .select('title description status priority targetDueAt report team teamLeader assignedWorker location blockedInfo completion timeline')
        .populate('report', 'title category status priority departmentName')
        .sort({ targetDueAt: 1 })
        .limit(Math.min(Number(input.limit) || 10, 20))
        .lean();
      return {
        data: {
          tasks: tasks.map((task) => ({
            id: String(task._id),
            title: task.title,
            status: task.status,
            priority: task.priority,
            targetDueAt: task.targetDueAt || null,
            caseReference: task.report ? caseReference(task.report._id) : null,
            caseTitle: task.report?.title || null,
            caseStatus: task.report?.status || null,
            address: task.location?.address || '',
            blockedReason: task.blockedInfo?.reason || '',
            instructions: String(task.description || '').slice(0, 600),
            latestTimeline: (task.timeline || []).slice(-3).map((entry) => ({ status: entry.status, at: entry.timestamp, note: entry.note }))
          })),
          note: tasks.length ? undefined : 'No field task is currently assigned with those filters.'
        },
        citations: tasks.filter((task) => task.report).map((task) => ({ type: 'case', id: String(task.report._id), label: `${caseReference(task.report._id)} · ${task.report.title}`, path: casePath(user, task.report._id) }))
      };
    }
  },
  {
    name: 'getDepartmentResources',
    category: 'department',
    risk: TOOL_RISK.read,
    description: 'Department resource pool (vehicles, equipment, specialists) with availability and pending requests.',
    inputs: 'status?:string',
    inputSchema: { type: 'object', additionalProperties: false, properties: { status: { type: 'string', maxLength: 30 } } },
    roles: operational,
    permission: { resource: 'cases', action: 'view' },
    requiresDepartment: true,
    async handler({ user, input }) {
      const departmentName = departmentNameFor(user);
      if (!departmentName) return { data: null, note: 'This account has no department assignment.' };
      const filter = { departmentName };
      if (input.status) filter.status = input.status;
      const rows = await DepartmentResource.find(filter).select('name type status capacityOrQuantity assignedTeam assignedCase requests').limit(60).lean();
      return {
        data: {
          resources: rows.map((row) => ({
            id: String(row._id),
            name: row.name,
            type: row.type,
            status: row.status,
            quantity: row.capacityOrQuantity,
            assignedToTeam: Boolean(row.assignedTeam),
            assignedToCase: Boolean(row.assignedCase),
            pendingRequests: (row.requests || []).filter((request) => request.status === 'pending').length
          })),
          totals: rows.reduce((accumulator, row) => ({ ...accumulator, [row.status]: (accumulator[row.status] || 0) + 1 }), {}),
          note: rows.length ? undefined : 'No department resource matches that filter.'
        },
        citations: []
      };
    }
  },
  {
    name: 'getDepartmentStaff',
    category: 'department',
    risk: TOOL_RISK.read,
    description: 'Department staff directory (officers and field workers) with their live case load.',
    inputs: '(none)',
    inputSchema: { type: 'object', additionalProperties: false, properties: {} },
    roles: ['admin', 'department_head', 'department_officer'],
    permission: { resource: 'cases', action: 'view' },
    requiresDepartment: true,
    async handler({ user }) {
      const departmentName = departmentNameFor(user);
      if (!departmentName) return { data: null, note: 'This account has no department assignment.' };
      const staff = await User.find({ departmentName, role: { $in: ['department_officer', 'officer', 'field_worker'] }, status: 'active' }).select('name role').lean();
      const liveLoad = await Report.aggregate([
        { $match: { departmentName, status: { $in: ['assigned', 'in_progress', 'under_review'] } } },
        { $facet: {
          officers: [{ $match: { assignedOfficer: { $ne: null } } }, { $group: { _id: '$assignedOfficer', count: { $sum: 1 } } }],
          workers: [{ $match: { assignedFieldWorker: { $ne: null } } }, { $group: { _id: '$assignedFieldWorker', count: { $sum: 1 } } }]
        } }
      ]);
      const counts = new Map();
      for (const row of [...(liveLoad[0]?.officers || []), ...(liveLoad[0]?.workers || [])]) {
        counts.set(String(row._id), (counts.get(String(row._id)) || 0) + row.count);
      }
      return {
        data: {
          department: departmentName,
          staff: staff.map((person) => ({ name: person.name, role: person.role, liveCases: counts.get(String(person._id)) || 0 })),
          note: staff.length ? undefined : 'No active staff is registered for this department.'
        },
        citations: []
      };
    }
  }
];

export { canViewReport } from '../scope.js';
