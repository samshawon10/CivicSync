/**
 * Civic service hub tools (task §19). Read-only.
 *
 * Services are official civic data owned by the Super Admin. The AI layer only
 * ever reads published records and reports missing fields as missing, using the
 * same `missingInformation` helper as controllers/civicServiceController.js.
 * The model is therefore structurally unable to invent a document, fee or
 * processing time.
 */
import CivicService from '../../../models/CivicService.js';
import { missingInformation } from '../../../services/civicServiceRules.js';
import { TOOL_RISK } from '../toolRegistry.js';
import { servicePath } from '../paths.js';

const allRoles = ['citizen', 'admin', 'department_head', 'department_officer', 'officer', 'field_worker', 'emergency_department_head', 'emergency_department_officer', 'emergency_officer', 'emergency_field_worker'];

/** Public projection: never exposes drafts, and flags missing information. */
const present = (service) => {
  const row = typeof service.toObject === 'function' ? service.toObject() : { ...service };
  return {
    id: String(row._id),
    name: row.name,
    category: row.category,
    department: row.departmentName || '',
    summary: row.summary || '',
    processingTime: row.processingTime || null,
    fee: row.fee || null,
    officeHours: row.officeHours || null,
    onlineAvailable: Boolean(row.onlineAvailable),
    office: row.contact?.office || '',
    area: row.location?.area || '',
    requestEnabled: Boolean(row.requestEnabled),
    missing: missingInformation(row)
  };
};

const escapeRegex = (value = '') => String(value).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const serviceTools = [
  {
    name: 'searchServices',
    category: 'services',
    risk: TOOL_RISK.read,
    description: 'Search published Civic Service Hub information by keyword (service name, summary, description or area).',
    inputs: 'query:string, limit?:number',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['query'],
      properties: { query: { type: 'string', minLength: 2, maxLength: 100 }, limit: { type: 'integer', minimum: 1, maximum: 15 } }
    },
    roles: allRoles,
    permission: { resource: 'services', action: 'view' },
    async handler({ input }) {
      const expression = new RegExp(escapeRegex(input.query), 'i');
      const rows = await CivicService.find({
        status: 'published',
        $or: [{ name: expression }, { summary: expression }, { description: expression }, { 'location.area': expression }]
      })
        .select('name category departmentName summary processingTime fee contact.office location.area onlineAvailable requestEnabled requiredDocuments eligibility steps')
        .sort({ name: 1 })
        .limit(Math.min(Number(input.limit) || 8, 15))
        .lean();
      return {
        data: { query: input.query, services: rows.map(present), note: rows.length ? undefined : 'No published CivicSync service matches that description.' },
        citations: rows.map((row) => ({ type: 'service', id: String(row._id), label: row.name, path: servicePath() }))
      };
    }
  },
  {
    name: 'getServiceDetails',
    category: 'services',
    risk: TOOL_RISK.read,
    description: 'Full recorded detail for one published service: eligibility, required documents, steps, fee, processing time, office and FAQs.',
    inputs: 'serviceId:string',
    inputSchema: { type: 'object', additionalProperties: false, required: ['serviceId'], properties: { serviceId: { type: 'string', minLength: 6, maxLength: 40 } } },
    roles: allRoles,
    permission: { resource: 'services', action: 'view' },
    async handler({ input }) {
      const service = await CivicService.findOne({ _id: input.serviceId, status: 'published' }).lean();
      if (!service) return { data: null, note: 'No published CivicSync service matches that id.' };
      return {
        data: {
          ...present(service),
          eligibility: service.eligibility || null,
          requiredDocuments: service.requiredDocuments || [],
          steps: service.steps || [],
          officeHours: service.officeHours || null,
          onlineUrl: service.onlineAvailable ? service.onlineUrl || null : null,
          contact: { phone: service.contact?.phone || '', email: service.contact?.email || '' },
          address: service.location?.address || '',
          faqs: (service.faqs || []).map((faq) => ({ question: faq.question, answer: faq.answer })),
          note: 'Only recorded CivicSync fields are shown. Anything absent is genuinely not recorded — the platform does not guess requirements.'
        },
        citations: [{ type: 'service', id: String(service._id), label: service.name, path: servicePath() }]
      };
    }
  }
];
