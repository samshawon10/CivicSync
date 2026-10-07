import test from 'node:test';
import assert from 'node:assert/strict';
import {
  descriptionSimilarity,
  distanceBetweenMeters,
  isDuplicateReport,
  isMasterReport,
  normalizeIssueText,
  publicDuplicateCandidate
} from './duplicateReports.js';

test('issue text normalization removes punctuation, diacritics and generic words', () => {
  assert.deepEqual(normalizeIssueText('The ROAD, near Vatára is damaged!'), ['vatara', 'damaged']);
});

test('description similarity recognizes shared meaningful terms and rejects unrelated text', () => {
  assert.ok(descriptionSimilarity('Deep pothole near Vatara intersection', 'Pothole at Vatara intersection') > 0.5);
  assert.equal(descriptionSimilarity('Broken street light', 'Water leaking in the park'), 0);
});

test('distance calculation uses geographic coordinates in meters', () => {
  assert.ok(Math.abs(distanceBetweenMeters({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 0.0009 }) - 100) < 2);
});

test('duplicate candidates expose safe public fields and rounded distance only', () => {
  const candidate = publicDuplicateCandidate({
    _id: 'case-1',
    title: 'Road damage',
    description: 'Pothole. contact@example.com, call 123-456-7890',
    category: 'road_infrastructure',
    departmentName: 'Roads',
    location: { area: 'Vatara', address: 'Private address' },
    workflowStage: 'IN_PROGRESS'
  }, 74, 'MEDIUM');
  assert.equal(candidate.location.distanceMeters, 70);
  assert.equal(candidate.location.address, '');
  assert.doesNotMatch(candidate.description, /contact@example|123-456/);
  assert.equal('createdBy' in candidate, false);
});

test('legacy reports remain masters while linked reports are excluded from operational work', () => {
  assert.equal(isMasterReport({ _id: 'legacy' }), true);
  assert.equal(isMasterReport({ _id: 'child', masterCaseId: 'root', relationType: 'DUPLICATE' }), false);
  assert.equal(isDuplicateReport({ _id: 'child', masterCaseId: 'root' }), true);
});
