/**
 * Pure rules for the Civic Service Hub: input normalisation, publish readiness,
 * nearby-search parameters and honest "not recorded" reporting.
 *
 * No database access, so every rule below is unit-tested directly
 * (see civicServiceRules.test.js).
 */

export const serviceStatuses = ['draft', 'published', 'archived'];
export const nearbyRadiusKm = { min: 1, max: 50, default: 5 };

const text = (value, max) => String(value ?? '').trim().slice(0, max);
const list = (value, max, itemMax) => (Array.isArray(value) ? value : [])
  .map((item) => text(item, itemMax)).filter(Boolean).slice(0, max);

export const slugify = (value) => text(value, 160).toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);

/** Coordinate pair is optional, but must be complete and in range when present. */
function normalizePoint(latitude, longitude) {
  const lat = latitude === '' || latitude === null || latitude === undefined ? null : Number(latitude);
  const lng = longitude === '' || longitude === null || longitude === undefined ? null : Number(longitude);
  if (lat === null && lng === null) return { latitude: null, longitude: null, point: undefined };
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return { error: 'Provide a complete latitude/longitude pair within valid ranges.' };
  }
  return { latitude: lat, longitude: lng, point: { type: 'Point', coordinates: [lng, lat] } };
}

/** Accepts an admin payload and returns only known, trimmed fields. */
export function normalizeService(body = {}) {
  const location = normalizePoint(body.latitude, body.longitude);
  if (location.error) return { error: location.error };
  return {
    value: {
      name: text(body.name, 160),
      slug: slugify(body.slug || body.name),
      category: text(body.category, 60).toLowerCase(),
      departmentName: text(body.departmentName, 120),
      summary: text(body.summary, 300),
      description: text(body.description, 3000),
      eligibility: text(body.eligibility, 1500),
      requiredDocuments: list(body.requiredDocuments, 30, 200),
      steps: list(body.steps, 30, 300),
      processingTime: text(body.processingTime, 120),
      fee: text(body.fee, 120),
      contact: {
        office: text(body.contact?.office, 160),
        phone: text(body.contact?.phone, 30),
        email: text(body.contact?.email, 120).toLowerCase()
      },
      location: {
        address: text(body.location?.address ?? body.address, 300),
        area: text(body.location?.area ?? body.area, 100),
        latitude: location.latitude,
        longitude: location.longitude,
        point: location.point
      },
      officeHours: text(body.officeHours, 200),
      onlineAvailable: Boolean(body.onlineAvailable),
      onlineUrl: text(body.onlineUrl, 500),
      faqs: (Array.isArray(body.faqs) ? body.faqs : [])
        .map((faq) => ({ question: text(faq?.question, 200), answer: text(faq?.answer, 1000) }))
        .filter((faq) => faq.question && faq.answer).slice(0, 20),
      relatedServices: (Array.isArray(body.relatedServices) ? body.relatedServices : []).slice(0, 20),
      requestEnabled: Boolean(body.requestEnabled),
      requestDepartmentName: text(body.requestDepartmentName, 120)
    }
  };
}

/**
 * Official information is only published once the essentials exist — the
 * platform must not publish a half-invented service record.
 */
export function publishBlockers(service = {}) {
  const blockers = [];
  if (!text(service.name, 160)) blockers.push('A service name is required.');
  if (!text(service.category, 60)) blockers.push('A service category is required.');
  if (!text(service.description, 3000) && !text(service.summary, 300)) blockers.push('Add a description or summary.');
  if (service.requestEnabled) {
    if (!text(service.requestDepartmentName, 120)) blockers.push('A department is required before enabling service requests.');
    if (!text(service.contact?.office, 160) && !text(service.location?.address, 300)) blockers.push('Add the handling office or its address before enabling service requests.');
  }
  return blockers;
}

export const isPubliclyReadable = (service) => service?.status === 'published';

/** Fields an administrator has not recorded yet, surfaced instead of invented. */
export function missingInformation(service = {}) {
  const missing = [];
  if (!text(service.eligibility, 1500)) missing.push('eligibility');
  if (!(service.requiredDocuments || []).length) missing.push('required documents');
  if (!text(service.processingTime, 120)) missing.push('processing time');
  if (!text(service.fee, 120)) missing.push('fee');
  if (!text(service.officeHours, 200)) missing.push('office hours');
  if (!text(service.contact?.phone, 30) && !text(service.contact?.email, 120)) missing.push('contact details');
  if (!text(service.location?.address, 300) && !text(service.location?.area, 100)) missing.push('location');
  return missing;
}

/** Parses `?latitude=&longitude=&radiusKm=` for nearby service discovery. */
export function parseNearby(query = {}) {
  const hasCoords = query.latitude !== undefined || query.longitude !== undefined;
  if (!hasCoords) return { near: null };
  const latitude = Number(query.latitude);
  const longitude = Number(query.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return { error: 'Provide a valid latitude and longitude for nearby search.' };
  }
  const requested = Number(query.radiusKm);
  const radiusKm = Number.isFinite(requested)
    ? Math.min(Math.max(requested, nearbyRadiusKm.min), nearbyRadiusKm.max)
    : nearbyRadiusKm.default;
  return { near: { latitude, longitude, radiusKm } };
}
