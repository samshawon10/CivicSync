import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeCivicQuery, CIVIC_ADVISORY_DISCLAIMER } from './civicIntelligenceRules.js';

test('analyzeCivicQuery detects road pothole keywords', () => {
  const res = analyzeCivicQuery('broken road pothole at airport avenue');
  assert.equal(res.matched, true);
  assert.equal(res.suggestedCategory, 'infrastructure');
  assert.equal(res.suggestedDepartment, 'Roads & Public Works');
  assert.equal(res.disclaimer, CIVIC_ADVISORY_DISCLAIMER);
  assert.ok(res.nextActions.length > 0);
});

test('analyzeCivicQuery detects sewage leak keywords', () => {
  const res = analyzeCivicQuery('water pipe leakage and sewage flood');
  assert.equal(res.matched, true);
  assert.equal(res.suggestedCategory, 'utilities');
  assert.equal(res.suggestedDepartment, 'Water Supply & Sewerage');
});

test('analyzeCivicQuery falls back gracefully for unknown issues', () => {
  const res = analyzeCivicQuery('something strange happened in my neighborhood');
  assert.equal(res.matched, false);
  assert.equal(res.suggestedDepartment, 'General Citizen Affairs');
});
