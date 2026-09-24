/**
 * Whitelisted Super Admin settings.
 *
 * Only the keys declared here can ever be read from or written to the
 * `SystemSetting` document. Anything else is ignored, so the settings API can
 * never be used to persist (or leak) unexpected data such as secrets.
 *
 * Feature flags are backend-authoritative: `readFeatureFlags()` is consumed by
 * the admin governance API, and the Super Admin surfaces disable themselves
 * from the server response rather than from local storage.
 */

export const settingsDefaults = {
  general: { portalName: 'CivicSync', timezone: 'Asia/Dhaka', language: 'en', contactEmail: '' },
  notifications: { emailDigest: true, criticalAlerts: true, inApp: true },
  security: { sessionNotice: true, activityRetentionDays: 365 },
  emergency: { defaultSeverity: 'high', escalationMinutes: 15, responseSlaMinutes: 30, criticalSlaMinutes: 10, highSlaMinutes: 20, mediumSlaMinutes: 60, lowSlaMinutes: 120, duplicateRadiusMeters: 300, autoClassifyAdvisory: true },
  map: { defaultLatitude: 23.8103, defaultLongitude: 90.4125, defaultZoom: 11, clusterMarkers: false },
  features: { emergency: true, womenSafety: true, safetyHeatmap: true, aiClassification: true, emergencyBroadcast: true, analytics: true }
};

const severities = ['low', 'medium', 'high', 'critical'];
const languages = ['en', 'bn'];

/** Field specification: [type, options]. Unknown fields are dropped. */
const spec = {
  general: {
    portalName: { type: 'string', max: 80 },
    timezone: { type: 'string', max: 60 },
    language: { type: 'enum', values: languages },
    contactEmail: { type: 'string', max: 120 }
  },
  notifications: {
    emailDigest: { type: 'boolean' },
    criticalAlerts: { type: 'boolean' },
    inApp: { type: 'boolean' }
  },
  security: {
    sessionNotice: { type: 'boolean' },
    activityRetentionDays: { type: 'number', min: 30, max: 3650 }
  },
  emergency: {
    defaultSeverity: { type: 'enum', values: severities },
    responseSlaMinutes: { type: 'number', min: 5, max: 1440 },
    criticalSlaMinutes: { type: 'number', min: 1, max: 1440 },
    highSlaMinutes: { type: 'number', min: 1, max: 1440 },
    mediumSlaMinutes: { type: 'number', min: 1, max: 1440 },
    lowSlaMinutes: { type: 'number', min: 1, max: 1440 },
    escalationMinutes: { type: 'number', min: 1, max: 180 },
    duplicateRadiusMeters: { type: 'number', min: 50, max: 5000 },
    autoClassifyAdvisory: { type: 'boolean' }
  },
  map: {
    defaultLatitude: { type: 'number', min: -90, max: 90 },
    defaultLongitude: { type: 'number', min: -180, max: 180 },
    defaultZoom: { type: 'number', min: 2, max: 19 },
    clusterMarkers: { type: 'boolean' }
  },
  features: {
    emergency: { type: 'boolean' },
    womenSafety: { type: 'boolean' },
    safetyHeatmap: { type: 'boolean' },
    aiClassification: { type: 'boolean' },
    emergencyBroadcast: { type: 'boolean' },
    analytics: { type: 'boolean' }
  }
};

function coerce(rule, value) {
  if (rule.type === 'boolean') {
    if (typeof value === 'boolean') return { ok: true, value };
    return { ok: false, message: 'Provide true or false.' };
  }
  if (rule.type === 'number') {
    const number = Number(value);
    if (!Number.isFinite(number) || number < rule.min || number > rule.max) {
      return { ok: false, message: `Value must be a number between ${rule.min} and ${rule.max}.` };
    }
    return { ok: true, value: number };
  }
  if (rule.type === 'enum') {
    return rule.values.includes(value) ? { ok: true, value } : { ok: false, message: `Value must be one of: ${rule.values.join(', ')}.` };
  }
  const text = String(value ?? '').trim();
  if (text.length > rule.max) return { ok: false, message: `Value must be ${rule.max} characters or fewer.` };
  return { ok: true, value: text };
}

/**
 * Merge stored settings with defaults and the incoming patch, applying field
 * validation. Returns { settings, errors, changed }.
 */
export function sanitizeSettings(stored = {}, patch = {}) {
  const settings = {};
  const errors = [];
  const changed = [];
  for (const [section, fields] of Object.entries(spec)) {
    // Rebuild every section from declared defaults. Never spread the stored
    // object wholesale: legacy/manual records may contain unknown or malformed
    // keys that must not be returned by the API or copied forward on save.
    settings[section] = { ...settingsDefaults[section] };
    const storedSection = stored?.[section];
    if (storedSection && typeof storedSection === 'object' && !Array.isArray(storedSection)) {
      for (const [field, rule] of Object.entries(fields)) {
        if (!Object.prototype.hasOwnProperty.call(storedSection, field)) continue;
        const result = coerce(rule, storedSection[field]);
        if (result.ok) settings[section][field] = result.value;
      }
    }

    const incoming = patch?.[section];
    if (incoming === undefined || incoming === null || typeof incoming !== 'object' || Array.isArray(incoming)) continue;
    for (const [field, raw] of Object.entries(incoming)) {
      const rule = fields[field];
      if (!rule) continue; // Unknown keys are silently dropped — never persisted.
      const result = coerce(rule, raw);
      if (!result.ok) { errors.push(`${section}.${field}: ${result.message}`); continue; }
      if (settings[section][field] !== result.value) changed.push(`${section}.${field}`);
      settings[section][field] = result.value;
    }
  }
  return { settings, errors, changed };
}

/** Backend-authoritative feature flags (defaults when nothing is stored). */
export function readFeatureFlags(stored = {}) {
  const values = stored?.features;
  return Object.fromEntries(Object.entries(settingsDefaults.features).map(([key, fallback]) => [
    key,
    values && typeof values[key] === 'boolean' ? values[key] : fallback
  ]));
}
