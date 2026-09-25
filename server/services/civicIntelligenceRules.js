/**
 * Pure civic intelligence advisory classifier & context answerer.
 * Rules-driven, deterministic, fully auditable.
 * NEVER makes state changes. Always explicitly advisory.
 */

export const CIVIC_ADVISORY_DISCLAIMER = 'Advisory guidance only — system actions require explicit user confirmation and authorized staff review.';

/**
 * Keyword-based department & service matcher for civic issues.
 */
const CIVIC_ROUTING_RULES = [
  {
    keywords: ['road', 'pothole', 'street', 'asphalt', 'sidewalk', 'traffic light', 'flyover', 'bridge', 'pavement'],
    department: 'Roads & Public Works',
    category: 'infrastructure',
    services: ['Road maintenance request', 'Pothole repair report'],
    guidance: 'Capture a photo with landmarks, note exact street/intersection, and submit under Infrastructure.'
  },
  {
    keywords: ['water', 'drainage', 'flood', 'sewage', 'pipe', 'leak', 'overflow', 'clog', 'drinking water', 'tap'],
    department: 'Water Supply & Sewerage',
    category: 'utilities',
    services: ['Water supply disruption', 'Sewage leak reporting'],
    guidance: 'Indicate whether drinking water is contaminated or if wastewater is overflowing into the street.'
  },
  {
    keywords: ['garbage', 'waste', 'trash', 'dump', 'cleaning', 'litter', 'recycling', 'bin', 'sweep'],
    department: 'Waste Management & Sanitation',
    category: 'sanitation',
    services: ['Waste collection request', 'Public bin clearance'],
    guidance: 'Mention whether waste is domestic, hazardous, or blocking drainage.'
  },
  {
    keywords: ['electric', 'power', 'blackout', 'wire', 'pole', 'transformer', 'voltage', 'spark'],
    department: 'Electricity & Power Distribution',
    category: 'utilities',
    services: ['Power outage notification', 'Damaged electric pole report'],
    guidance: 'Stay away from downed cables. For live wire sparks, please trigger an immediate SOS / Emergency.'
  },
  {
    keywords: ['light', 'street light', 'lamp', 'dark street', 'bulb'],
    department: 'Public Lighting Division',
    category: 'infrastructure',
    services: ['Street light malfunction report'],
    guidance: 'Record pole number if visible to accelerate night-time crew dispatch.'
  },
  {
    keywords: ['tree', 'branch', 'park', 'grass', 'falling tree', 'botanical'],
    department: 'Parks & Environment',
    category: 'environment',
    services: ['Fallen branch clearing', 'Park maintenance request'],
    guidance: 'If the tree blocks traffic or touches electric wires, escalate priority to High.'
  },
  {
    keywords: ['noise', 'pollution', 'construction', 'loudspeaker', 'smoke', 'air quality'],
    department: 'Environmental Protection',
    category: 'environment',
    services: ['Noise pollution complaint', 'Air emission report'],
    guidance: 'Log recurring hours of violation and exact premises location.'
  },
  {
    keywords: ['birth', 'certificate', 'death', 'nid', 'id card', 'trade license', 'citizen card', 'tax', 'holding tax'],
    department: 'Civil Registration & Revenue',
    category: 'civil_services',
    services: ['Birth Registration Certificate', 'Holding Tax Assessment', 'Trade License Issuance'],
    guidance: 'Check the Civic Service Hub for required eligibility documents and estimated turnaround SLA.'
  }
];

export function analyzeCivicQuery(query = '') {
  const q = String(query).toLowerCase().trim();
  if (!q) {
    return {
      matched: false,
      disclaimer: CIVIC_ADVISORY_DISCLAIMER,
      answer: 'Please provide details about the civic problem or inquiry you need assistance with.',
      suggestedCategory: 'general',
      suggestedDepartment: null,
      suggestedServices: [],
      nextActions: []
    };
  }

  // Find best-matching rule by counting keyword hits
  let best = null;
  let bestScore = 0;
  for (const rule of CIVIC_ROUTING_RULES) {
    let score = 0;
    for (const kw of rule.keywords) {
      if (q.includes(kw)) score += kw.split(' ').length;
    }
    if (score > bestScore) {
      bestScore = score;
      best = rule;
    }
  }

  if (bestScore > 0 && best) {
    return {
      matched: true,
      disclaimer: CIVIC_ADVISORY_DISCLAIMER,
      suggestedDepartment: best.department,
      suggestedCategory: best.category,
      suggestedServices: best.services,
      guidance: best.guidance,
      confidence: Math.min(1, 0.4 + bestScore * 0.2),
      nextActions: [
        { label: 'Submit Official Report', action: 'create_report', prefill: { category: best.category, department: best.department } },
        { label: 'Explore Related Services', action: 'view_services', query: best.keywords[0] },
        { label: 'Check Community Discussions', action: 'search_community', query: best.keywords[0] }
      ]
    };
  }

  return {
    matched: false,
    disclaimer: CIVIC_ADVISORY_DISCLAIMER,
    suggestedDepartment: 'General Citizen Affairs',
    suggestedCategory: 'general',
    suggestedServices: [],
    guidance: 'No exact department rule matched. You may file a General Civic Report; our intake triage will route it.',
    confidence: 0.2,
    nextActions: [
      { label: 'Submit General Report', action: 'create_report', prefill: { category: 'general' } },
      { label: 'Browse Service Hub', action: 'view_services' }
    ]
  };
}
