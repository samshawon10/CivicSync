/**
 * AI Tool Registry Catalog index.
 * Aggregates all role-scoped tool definitions across the 7 domains:
 * - caseTools (cases, reports, SLA, history)
 * - departmentTools (department queues, teams, scoring, field tasks)
 * - emergencyTools (incidents, responder rosters, emergency triage)
 * - serviceTools (civic services, requirements, eligibility)
 * - civicTools (facilities, alerts, safety stats)
 * - communityTools (discussions, moderation, posts)
 * - selfTools (notifications, profile, role destinations)
 * - adminTools (platform health, analytics, governance, audit logs)
 */
import { caseTools } from './catalog/caseTools.js';
import { departmentTools } from './catalog/departmentTools.js';
import { emergencyTools } from './catalog/emergencyTools.js';
import { serviceTools } from './catalog/serviceTools.js';
import { civicTools } from './catalog/civicTools.js';
import { communityTools } from './catalog/communityTools.js';
import { selfTools } from './catalog/selfTools.js';
import { adminTools } from './catalog/adminTools.js';
import { createToolRegistry } from './toolRegistry.js';

export const allTools = [
  ...caseTools,
  ...departmentTools,
  ...emergencyTools,
  ...serviceTools,
  ...civicTools,
  ...communityTools,
  ...selfTools,
  ...adminTools
];

let defaultRegistryInstance = null;

export function getDefaultToolRegistry() {
  if (!defaultRegistryInstance) {
    defaultRegistryInstance = createToolRegistry(allTools);
  }
  return defaultRegistryInstance;
}
