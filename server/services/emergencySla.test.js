import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateEmergencySla, getSlaTargetMinutes } from './emergencySla.js';

const settings = { emergency: { responseSlaMinutes: 30, criticalSlaMinutes: 10, highSlaMinutes: 20, mediumSlaMinutes: 60, lowSlaMinutes: 120 } };

test('severity-specific SLA targets use configured values with a safe fallback', () => {
  assert.equal(getSlaTargetMinutes('critical', settings), 10);
  assert.equal(getSlaTargetMinutes('high', settings), 20);
  assert.equal(getSlaTargetMinutes('medium', settings), 60);
  assert.equal(getSlaTargetMinutes('low', settings), 120);
  assert.equal(getSlaTargetMinutes('unknown', settings), 30);
  assert.equal(getSlaTargetMinutes('critical', { emergency: { criticalSlaMinutes: 'invalid' } }), 30);
});

test('SLA state reflects real response milestones and configured time', () => {
  const createdAt = new Date('2026-01-01T00:00:00.000Z');
  assert.equal(evaluateEmergencySla({ createdAt, severity: 'critical' }, settings, new Date('2026-01-01T00:05:00.000Z')).state, 'on_track');
  assert.equal(evaluateEmergencySla({ createdAt, severity: 'critical' }, settings, new Date('2026-01-01T00:09:00.000Z')).state, 'warning');
  assert.equal(evaluateEmergencySla({ createdAt, severity: 'critical' }, settings, new Date('2026-01-01T00:11:00.000Z')).state, 'breached');
  const responded = evaluateEmergencySla({ createdAt, severity: 'critical', dispatchedAt: new Date('2026-01-01T00:06:00.000Z') }, settings, new Date('2026-01-01T00:20:00.000Z'));
  assert.equal(responded.state, 'on_track');
  assert.equal(responded.respondedAt.toISOString(), '2026-01-01T00:06:00.000Z');
  const resolved = evaluateEmergencySla({ createdAt, severity: 'critical', resolvedAt: new Date('2026-01-01T01:00:00.000Z') }, settings, new Date('2026-01-01T01:00:00.000Z'));
  assert.equal(resolved.state, 'resolved');
});

test('SLA does not fabricate a due date when creation time is absent', () => {
  assert.deepEqual(evaluateEmergencySla({ severity: 'high' }, settings), { state: 'unknown', targetMinutes: null, dueAt: null, remainingMinutes: null, source: 'missing_created_at' });
});
