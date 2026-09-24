import test from 'node:test';
import assert from 'node:assert/strict';
import { readFeatureFlags, sanitizeSettings, settingsDefaults } from './settingsDefaults.js';

test('settings responses contain only declared defaults and valid stored fields', () => {
  const { settings, errors, changed } = sanitizeSettings({
    general: { portalName: 'CivicSync', language: 'bn', secret: 'must-not-leak' },
    security: { activityRetentionDays: 90, injected: true },
    map: { defaultZoom: 12 },
    features: { emergency: false, hiddenFlag: false },
    rogueSection: { privateKey: 'must-not-leak' }
  });

  assert.deepEqual(errors, []);
  assert.deepEqual(changed, []);
  assert.deepEqual(settings, {
    ...settingsDefaults,
    general: { ...settingsDefaults.general, portalName: 'CivicSync', language: 'bn' },
    security: { ...settingsDefaults.security, activityRetentionDays: 90 },
    map: { ...settingsDefaults.map, defaultZoom: 12 },
    features: { ...settingsDefaults.features, emergency: false }
  });
  assert.equal('secret' in settings.general, false);
  assert.equal('injected' in settings.security, false);
  assert.equal('hiddenFlag' in settings.features, false);
  assert.equal('rogueSection' in settings, false);
});

test('invalid stored settings fall back to safe defaults', () => {
  const { settings, errors } = sanitizeSettings({
    notifications: { inApp: 'false', criticalAlerts: 0 },
    emergency: { escalationMinutes: 0, defaultSeverity: 'urgent' },
    map: { defaultLatitude: 100 }
  });

  assert.deepEqual(errors, []);
  assert.equal(settings.notifications.inApp, settingsDefaults.notifications.inApp);
  assert.equal(settings.notifications.criticalAlerts, settingsDefaults.notifications.criticalAlerts);
  assert.equal(settings.emergency.escalationMinutes, settingsDefaults.emergency.escalationMinutes);
  assert.equal(settings.emergency.defaultSeverity, settingsDefaults.emergency.defaultSeverity);
  assert.equal(settings.map.defaultLatitude, settingsDefaults.map.defaultLatitude);
});

test('settings patches validate known fields and report changed values', () => {
  const result = sanitizeSettings(
    { security: { activityRetentionDays: 365 } },
    {
      security: { activityRetentionDays: '180', unknown: 1 },
      notifications: { emailDigest: false, inApp: 'true' },
      features: { emergency: false }
    }
  );

  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0], /^notifications\.inApp:/);
  assert.equal(result.settings.security.activityRetentionDays, 180);
  assert.equal(result.settings.notifications.emailDigest, false);
  assert.equal(result.settings.notifications.inApp, settingsDefaults.notifications.inApp);
  assert.equal(result.settings.features.emergency, false);
  assert.equal('unknown' in result.settings.security, false);
  assert.deepEqual([...result.changed].sort(), ['features.emergency', 'notifications.emailDigest', 'security.activityRetentionDays']);
});

test('feature flags are authoritative booleans without unknown keys', () => {
  assert.deepEqual(readFeatureFlags({
    features: { emergency: false, analytics: 'false', womenSafety: 0, hiddenFlag: true }
  }), {
    ...settingsDefaults.features,
    emergency: false,
    analytics: settingsDefaults.features.analytics,
    womenSafety: settingsDefaults.features.womenSafety
  });
  assert.equal('hiddenFlag' in readFeatureFlags({ features: { hiddenFlag: true } }), false);
});
