/**
 * Civic case tools (task §17). Read-only.
 *
 * Every query is scoped through `reportScopeFilter` / `canViewReport`, which
 * mirror controllers/reportController.js and controllers/departmentController.js.
 * A citizen can only ever reach their own cases; department staff only their
 * department and, for officer/field-worker roles, only their own assignments.
 */
import Report from '../../../models/Report.js';
import { calculateDepartmentSla } from '../../../services/departmentSla.js';
import { getReportNextAction } from '../../../services/nextAction.js';
import { searchForUser } from '../../../services/civicSearch.js';
import { TOOL_RISK } from '../toolRegistry.js';
import { canViewReport, caseSummary, departmentNameFor, managerRoles, reportScopeFilter } from '../scope.js';
import { casePath } from '../paths.js';

const STATUSES = ['pending', 'verified', 'assigned', 'in_progress', 'under_review', 'completed', 'closed'];
const civicStaff = ['department_head', 'department_officer', 'officer', 'field_worker'];
const allRoles = ['citizen', 'admin', ...civicStaff, 'emergency_department_head', 'emergency_department_officer', 'emergency_officer', 'emergency_field_worker'];

/** Loads one case with the same population the department workspace uses. */
async function loadScopedReport(user, caseId) {
  if (!caseId) return null;
  const report = await Report.findById(caseId)
    .populate('createdBy', 'name')
    .populate('assignedOfficer', 'name role')
    .populate('assignedFieldWorker', 'name role')
    .populate('assignedTeam', 'name status serviceArea')
    .populate('activeTask');
  if (!report || !canViewReport(user, report)) return null;
  return report;
}

const decorate = (report) => ({ ...report.toObject(), nextAction: getReportNextAction(report), sla: calculateDepartmentSla(report) });
const caseReference = (id) => `CASE-${String(id).slice(-6).toUpperCase()}`;
const citationFor = (user, report) => ({
  type: 'case',
  id: String(report._id),
  label: `${caseReference(report._id)} · ${report.title}`,
  path: casePath(user, report._id)
});

export const caseTools = [
  {
    name: 'getMyCases',
    category: 'cases',
    risk: TOOL_RISK.read,
    description: 'List the civic cases this user may see, newest first, with status, priority, department and SLA position.',
    inputs: 'status?:string, limit?:number',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        status: { type: 'string', enum: STATUSES },
        limit: { type: 'integer', minimum: 1, maximum: 20 }
      }
    },
    roles: allRoles,
    permission: { resource: 'cases', action: 'view' },
    async handler({ user, input }) {
      const filter = reportScopeFilter(user);
      if (!filter) return { data: [], note: 'This account has no case scope assigned.' };
      const query = { ...filter };
      if (input.status) query.status = input.status;
      const reports = await Report.find(query)
        .select('title category departmentName priority status dueAt escalation assignedOfficer assignedFieldWorker assignedTeam createdAt updatedAt')
        .populate('assignedOfficer', 'name')
        .populate('assignedFieldWorker', 'name')
        .populate('assignedTeam', 'name status')
        .sort({ updatedAt: -1 })
        .limit(Math.min(Number(input.limit) || 10, 20))
        .lean();
      return {
        data: reports.map((report) => caseSummary({ ...report, sla: calculateDepartmentSla(report), nextAction: getReportNextAction(report) }, { viewer: user })),
        citations: reports.map((report) => citationFor(user, report))
      };
    }
  },
  {
    name: 'getCaseDetails',
    category: 'cases',
    risk: TOOL_RISK.read,
    description: 'Full authorized detail of one civic case: description, location, assignment, timeline, SLA, task and completion state.',
    inputs: 'caseId:string',
    inputSchema: { type: 'object', additionalProperties: false, required: ['caseId'], properties: { caseId: { type: 'string', minLength: 6, maxLength: 40 } } },
    roles: allRoles,
    permission: { resource: 'cases', action: 'view' },
    async handler({ user, input }) {
      const report = await loadScopedReport(user, input.caseId);
      if (!report) return { data: null, note: 'No authorized case matches that id.' };
      return {
        data: caseSummary(decorate(report), { detail: true, viewer: user }),
        citations: [citationFor(user, report)]
      };
    }
  },
  {
    name: 'getCaseTimeline',
    category: 'cases',
    risk: TOOL_RISK.read,
    description: 'Recorded activity, messages and SLA milestones for one authorized civic case.',
    inputs: 'caseId:string',
    inputSchema: { type: 'object', additionalProperties: false, required: ['caseId'], properties: { caseId: { type: 'string', minLength: 6, maxLength: 40 } } },
    roles: allRoles,
    permission: { resource: 'cases', action: 'view' },
    async handler({ user, input }) {
      const report = await loadScopedReport(user, input.caseId);
      if (!report) return { data: null, note: 'No authorized case matches that id.' };
      const value = report.toObject();
      // Internal department messages are staff-only (Report.messages.isInternal).
      const canSeeInternal = managerRoles.includes(user.role) || ['officer', 'field_worker'].includes(user.role);
      return {
        data: {
          reference: caseReference(report._id),
          status: report.status,
          sla: calculateDepartmentSla(report),
          nextAction: getReportNextAction(report),
          milestones: {
            submittedAt: report.createdAt,
            acknowledgedAt: report.sla?.acknowledgedAt || null,
            arrivedAt: report.sla?.arrivedAt || null,
            resolvedAt: report.sla?.resolvedAt || null,
            dueAt: report.dueAt || null
          },
          activity: (value.activity || []).map((entry) => ({ action: entry.action, actorRole: entry.actorRole, at: entry.timestamp, note: entry.note })),
          messages: (value.messages || [])
            .filter((message) => canSeeInternal || !message.isInternal)
            .slice(-15)
            .map((message) => ({ from: message.senderRole, at: message.createdAt, text: message.text, internal: message.isInternal })),
          escalation: value.escalation?.isEscalated
            ? { reason: value.escalation.reason, escalatedAt: value.escalation.escalatedAt, resolvedAt: value.escalation.resolvedAt || null }
            : null
        },
        citations: [citationFor(user, report)]
      };
    }
  },
  {
    name: 'searchCases',
    category: 'cases',
    risk: TOOL_RISK.read,
    description: 'Search civic cases by keyword through the same role-scoped global CivicSearch the platform UI uses.',
    inputs: 'query:string, limit?:number',
    inputSchema: { type: 'object', additionalProperties: false, required: ['query'], properties: { query: { type: 'string', minLength: 2, maxLength: 120 }, limit: { type: 'integer', minimum: 1, maximum: 10 } } },
    roles: allRoles,
    permission: { resource: 'cases', action: 'view' },
    async handler({ user, input }) {
      const result = await searchForUser({ user, query: input.query, categories: ['cases'], limit: Math.min(Number(input.limit) || 5, 10) });
      const group = result.groups.find((item) => item.key === 'cases');
      const items = group?.items || [];
      return {
        data: {
          query: result.query,
          matches: items.map((item) => ({ reference: item.id ? caseReference(item.id) : null, id: item.id, title: item.title, summary: item.subtitle })),
          total: items.length
        },
        citations: items.map((item) => ({ type: 'case', id: item.id, label: item.title, path: casePath(user, item.id) }))
      };
    }
  },
  {
    name: 'getSimilarCases',
    category: 'cases',
    risk: TOOL_RISK.read,
    description: 'Find other authorized cases in the same department and category as one case, to spot recurring incidents.',
    inputs: 'caseId:string, limit?:number',
    inputSchema: { type: 'object', additionalProperties: false, required: ['caseId'], properties: { caseId: { type: 'string', minLength: 6, maxLength: 40 }, limit: { type: 'integer', minimum: 1, maximum: 10 } } },
    roles: ['admin', ...civicStaff],
    permission: { resource: 'cases', action: 'view' },
    async handler({ user, input }) {
      const report = await loadScopedReport(user, input.caseId);
      if (!report) return { data: null, note: 'No authorized case matches that id.' };
      const filter = reportScopeFilter(user) || {};
      const rows = await Report.find({ ...filter, _id: { $ne: report._id }, category: report.category, departmentName: report.departmentName })
        .select('title status priority createdAt')
        .sort({ createdAt: -1 })
        .limit(Math.min(Number(input.limit) || 5, 10))
        .lean();
      return {
        data: {
          basedOn: { reference: caseReference(report._id), category: report.category, department: departmentNameFor(user) || report.departmentName },
          similar: rows.map((row) => ({ reference: caseReference(row._id), id: String(row._id), title: row.title, status: row.status, priority: row.priority, createdAt: row.createdAt })),
          note: rows.length ? undefined : 'No other cases in this department share that category.'
        },
        citations: rows.map((row) => ({ type: 'case', id: String(row._id), label: row.title, path: casePath(user, row._id) }))
      };
    }
  },
];

/** Exported for tests: the case-visibility predicate every case tool relies on. */
export { canViewReport, departmentNameFor, managerRoles };
