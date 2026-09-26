/**
 * CivicSync Intelligence — role-aware prompt catalogue and page-context presets.
 *
 * These are *suggestions only*: each one is just a natural-language question sent
 * to the gateway, which decides independently which tools to run and which
 * records the caller is allowed to see. Nothing here grants access to data.
 *
 * Roles mirror server/utils/roles.js exactly. No new roles are invented.
 */

const DASHBOARD_GROUPS = {
  citizen: ['My Cases', 'Services', 'Safety', 'Community'],
  department_head: ['Workload', 'SLA', 'Operations', 'Capacity'],
  department_officer: ['Case', 'SLA', 'Similar', 'Teams'],
  officer: ['Case', 'SLA', 'Similar', 'Teams'],
  field_worker: ['Task', 'Checklist', 'Draft', 'Notes'],
  emergency_department_head: ['Emergencies', 'Responders', 'Workload', 'Incidents'],
  emergency_department_officer: ['Emergency', 'Responders', 'Timeline', 'Briefing'],
  emergency_officer: ['Emergency', 'Responders', 'Timeline', 'Briefing'],
  emergency_field_worker: ['Emergency', 'Task', 'Checklist', 'Notes'],
  admin: ['Platform', 'Departments', 'Emergencies', 'Health']
};

const SUGGESTIONS = {
  citizen: [
    'Show my active cases',
    'Find services for me',
    'Show nearby safety facilities',
    'What are my recent notifications?'
  ],
  department_head: [
    'Show department workload',
    'Which cases are approaching SLA?',
    "Summarize today's operations",
    'Show team capacity'
  ],
  department_officer: ['Summarize this case', 'Check SLA status', 'Find similar cases', 'Suggest available teams'],
  officer: ['Summarize this case', 'Check SLA status', 'Find similar cases', 'Suggest available teams'],
  field_worker: ['Brief me on my assigned task', "Show today's tasks", 'Create a field checklist', 'Help draft my resolution note'],
  emergency_department_head: [
    'Brief me on active emergencies',
    'Show responder availability',
    'Summarize emergency workload',
    'Show unresolved incidents'
  ],
  emergency_department_officer: ['Brief me on this emergency', 'Show responder status', 'Summarize incident timeline', 'Prepare an operational briefing'],
  emergency_officer: ['Brief me on this emergency', 'Show responder status', 'Summarize incident timeline', 'Prepare an operational briefing'],
  emergency_field_worker: ['Brief me on this emergency', 'Show my assigned task', 'Show field checklist', 'Help prepare resolution notes'],
  admin: ['Show platform overview', 'Show department performance', 'Show emergency statistics', 'Check system health']
};

const FALLBACK = ['Summarize', 'Explain', 'Search', 'Check'];

/** Prompt chips for a role, always a fresh array so callers can mutate safely. */
export function suggestionsFor(role) {
  return [...(SUGGESTIONS[role] || FALLBACK)];
}

/** Four short category labels used by the empty-state tile grid. */
export function suggestionGroupsFor(role) {
  return [...(DASHBOARD_GROUPS[role] || FALLBACK)];
}

/* ------------------------------------------------------- Page-context presets */

/**
 * Contextual prompts per surface. `context` is the pageContext envelope sent with
 * the message; the gateway's Context Engine uses it to pre-fetch ground truth.
 * Only non-sensitive identifiers (an id, a type, a label) are ever sent — never
 * the record body — so the browser cannot smuggle data past RBAC.
 */
export const PAGE_PRESETS = {
  citizen_dashboard: {
    title: 'CivicSync Intelligence',
    context: { route: 'citizen_dashboard' },
    prompts: ['What needs my attention today?', 'Show my active cases', 'Find services for me', 'Show nearby safety facilities']
  },
  case: {
    title: 'Ask CivicSync AI',
    context: { route: 'case' },
    prompts: ['Summarize this case', 'Explain the timeline', 'Check SLA', 'Find similar cases', 'What information is missing?', 'Draft a citizen update']
  },
  emergency: {
    title: 'AI Briefing',
    context: { route: 'emergency' },
    prompts: ['Brief me', 'Summarize incident', 'Summarize timeline', 'Show responder status', 'Identify missing information', 'Prepare handover briefing']
  },
  service: {
    title: 'Ask about this service',
    context: { route: 'service' },
    prompts: ['What documents do I need?', 'How does this service work?', 'Who is eligible?', 'What should I do next?']
  },
  community: {
    title: 'Community Intelligence',
    context: { route: 'community' },
    prompts: ['Summarize this discussion', 'Find similar discussions', 'Find relevant posts', 'Help me draft a post']
  },
  map: {
    title: 'Ask about this map',
    context: { route: 'map' },
    prompts: ['Show nearby safety facilities', 'Show active emergencies', 'Find services near this location', 'What safety information is relevant here?']
  },
  department: {
    title: 'Operational Intelligence',
    context: { route: 'department' },
    prompts: ['Show department workload', 'Which cases are approaching SLA?', "Summarize today's operations", 'Show team capacity']
  },
  emergency_dashboard: {
    title: 'Emergency Intelligence',
    context: { route: 'emergency_dashboard' },
    prompts: ['Brief me on active emergencies', 'Show responder availability', 'Summarize emergency workload', 'Show unresolved incidents']
  },
  admin: {
    title: 'Platform Intelligence',
    context: { route: 'admin' },
    prompts: [
      'Give me a platform overview',
      'How are departments performing?',
      'Summarise active emergencies across the platform',
      'Explain what needs attention first',
      'Where is SLA risk highest?'
    ]
  }
};

/** Resolves a preset, merging any extra context (ids, labels) supplied by the page. */
export function presetFor(key, extra = {}) {
  const base = PAGE_PRESETS[key] || { title: 'CivicSync Intelligence', context: { route: key || 'general' }, prompts: [] };
  return { ...base, context: { ...base.context, ...extra } };
}
