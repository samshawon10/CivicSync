/**
 * Sensitive-data filtering for the AI layer (task §21, §29).
 *
 * The AI Gateway must never be a side-channel around the platform's own
 * visibility rules. These helpers mirror the existing server rules
 * (controllers/reportController.js `canViewReport`,
 * controllers/emergencyController.js `emergencyForViewer`,
 * services/civicSearchScope.js `isCategoryPublic`) so an AI answer can never
 * expose more than the equivalent screen would.
 */
import { isCategoryPublic } from '../../services/civicSearchScope.js';
import { sensitiveCategories } from '../../config/emergencyOptions.js';

/** PII fields that are dropped unless the viewer is explicitly authorized. */
export const PERSONAL_FIELDS = Object.freeze(['citizenPhone', 'citizenEmail', 'phone', 'email', 'sosContacts', 'personDetails', 'lastKnownLocation']);

/** Emergency staff who must never receive victim contact detail. */
export const responderRoles = Object.freeze(['emergency_department_officer', 'emergency_officer', 'emergency_field_worker']);

/** Command + admin see everything within their authorized scope. */
export const commandRoles = Object.freeze(['admin', 'emergency_department_head']);

export function isCommand(viewer) {
  return commandRoles.includes(viewer?.role);
}

/**
 * Filters an emergency payload exactly like `emergencyForViewer` does, so the AI
 * context, tool results and citations stay consistent with the UI.
 * @param {object} emergency plain object
 * @param {{ role?: string, _id?: unknown }} viewer
 */
export function redactEmergencyForViewer(emergency, viewer, { summary = false } = {}) {
  const value = { ...(emergency || {}) };
  if (responderRoles.includes(viewer?.role)) {
    delete value.citizenPhone;
    delete value.citizenEmail;
    delete value.sosContacts;
    if (value.citizen && typeof value.citizen === 'object') {
      value.citizen = { ...value.citizen };
      delete value.citizen.email;
      delete value.citizen.phone;
    }
    if (summary) {
      delete value.personDetails;
      delete value.evidence;
      delete value.activity;
    }
  }
  return value;
}

/** True when a restricted (sensitive-category) incident may be described at all. */
export function mayDescribeEmergency(emergency, viewer) {
  if (!emergency) return false;
  if (isCommand(viewer)) return true;
  return !sensitiveCategories.includes(emergency.category) && emergency.visibility !== 'restricted';
}

/**
 * Drops identity columns from user rows unless the viewer administers them.
 * Staff need names to work cases; they never need emails or phone numbers.
 */
export function redactUserForViewer(user, viewer, { allowContact = false } = {}) {
  if (!user) return null;
  const value = { ...user };
  const self = String(value._id || value.id || '') === String(viewer?._id || '');
  if (viewer?.role !== 'admin' && !allowContact && !self) {
    delete value.email;
    delete value.phone;
  }
  return value;
}

/** Applies the search-layer public/private contract to a result category. */
export function mayExposeCategory(viewer, category) {
  return isCategoryPublic(viewer?.role, category);
}

/** Counts what was removed, for the AI audit trail (never the removed values). */
export function countRedactions(before = {}, after = {}) {
  const beforeKeys = Object.keys(before || {});
  const afterKeys = new Set(Object.keys(after || {}));
  return beforeKeys.filter((key) => !afterKeys.has(key)).length;
}

/** Location precision for a viewer: exact for command, area-level for the public. */
export function locationForViewer(location, viewer, { precise = false } = {}) {
  if (!location) return null;
  if (isCommand(viewer) || precise) return location;
  return {
    area: location.area || location.address || '',
    // Coordinates are rounded to ~1km so aggregate answers never pinpoint a
    // reporting citizen's exact position.
    approximate: Number.isFinite(Number(location.latitude)) && Number.isFinite(Number(location.longitude))
      ? { latitude: Math.round(Number(location.latitude) * 100) / 100, longitude: Math.round(Number(location.longitude) * 100) / 100 }
      : null
  };
}
