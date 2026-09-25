import test from 'node:test';
import assert from 'node:assert/strict';
import { isPubliclyReadable, missingInformation, normalizeService, parseNearby, publishBlockers, slugify } from './civicServiceRules.js';

test('normalizeService keeps known fields, trims, and drops unknown input', () => {
  const { value } = normalizeService({
    name: '  Birth Certificate  ',
    category: 'Civil Registration',
    description: '  Apply for a birth certificate.  ',
    requiredDocuments: [' National ID ', '', 'Hospital record', ...Array.from({ length: 40 }, (_, index) => `doc-${index}`)],
    steps: ['Collect form', 'Submit'],
    latitude: '23.8103',
    longitude: '90.4125',
    isAdmin: true,
    status: 'published',
    createdBy: 'attacker'
  });
  assert.equal(value.name, 'Birth Certificate');
  assert.equal(value.category, 'civil registration');
  assert.equal(value.description, 'Apply for a birth certificate.');
  assert.equal(value.slug, 'birth-certificate');
  assert.equal(value.requiredDocuments.length, 30, 'document list is capped');
  assert.deepEqual(value.requiredDocuments.slice(0, 2), ['National ID', 'Hospital record']);
  assert.deepEqual(value.location.point, { type: 'Point', coordinates: [90.4125, 23.8103] });
  assert.equal('status' in value, false, 'status cannot be set through the payload');
  assert.equal('createdBy' in value, false, 'ownership cannot be set through the payload');
});

test('normalizeService rejects half or out-of-range coordinates', () => {
  assert.match(normalizeService({ name: 'A', latitude: '23.8' }).error, /complete latitude\/longitude/);
  assert.match(normalizeService({ name: 'A', latitude: '99', longitude: '90' }).error, /within valid ranges/);
  const { value } = normalizeService({ name: 'A' });
  assert.equal(value.location.latitude, null);
  assert.equal(value.location.point, undefined);
});

test('normalizeService keeps only complete FAQs', () => {
  const { value } = normalizeService({ name: 'A', faqs: [{ question: 'Why?', answer: 'Because.' }, { question: 'No answer' }, { answer: 'No question' }] });
  assert.deepEqual(value.faqs, [{ question: 'Why?', answer: 'Because.' }]);
});

test('publishBlockers refuses to publish an incomplete official record', () => {
  assert.deepEqual(publishBlockers({ name: 'A', category: 'c', description: 'd' }), []);
  assert.equal(publishBlockers({ name: '', category: 'c', description: 'd' }).length, 1);
  assert.equal(publishBlockers({ name: 'A', category: '', description: 'd' }).length, 1);
  assert.equal(publishBlockers({ name: 'A', category: 'c' }).length, 1);
  const requestBlockers = publishBlockers({ name: 'A', category: 'c', description: 'd', requestEnabled: true });
  assert.equal(requestBlockers.length, 2, 'requests need a department and a handling office/address');
  assert.deepEqual(publishBlockers({ name: 'A', category: 'c', description: 'd', requestEnabled: true, requestDepartmentName: 'Road & Highway', contact: { office: 'Counter 4' } }), []);
});

test('missingInformation reports unrecorded official data instead of inventing it', () => {
  const missing = missingInformation({ name: 'A' });
  assert.deepEqual(missing, ['eligibility', 'required documents', 'processing time', 'fee', 'office hours', 'contact details', 'location']);
  const complete = missingInformation({
    eligibility: 'Any resident', requiredDocuments: ['ID'], processingTime: '7 days', fee: 'Free',
    officeHours: '9-5', contact: { phone: '999' }, location: { area: 'Dhanmondi' }
  });
  assert.deepEqual(complete, []);
});

test('only published services are publicly readable', () => {
  assert.equal(isPubliclyReadable({ status: 'published' }), true);
  assert.equal(isPubliclyReadable({ status: 'draft' }), false);
  assert.equal(isPubliclyReadable({ status: 'archived' }), false);
  assert.equal(isPubliclyReadable(null), false);
});

test('nearby parameters are optional, clamped, and validated', () => {
  assert.deepEqual(parseNearby({}), { near: null });
  assert.deepEqual(parseNearby({ latitude: '23.8103', longitude: '90.4125' }), { near: { latitude: 23.8103, longitude: 90.4125, radiusKm: 5 } });
  assert.equal(parseNearby({ latitude: '23.81', longitude: '90.41', radiusKm: '999' }).near.radiusKm, 50);
  assert.equal(parseNearby({ latitude: '23.81', longitude: '90.41', radiusKm: '0.1' }).near.radiusKm, 1);
  assert.match(parseNearby({ latitude: '999', longitude: '0' }).error, /valid latitude and longitude/);
  assert.match(parseNearby({ latitude: 'abc', longitude: '0' }).error, /valid latitude and longitude/);
});

test('slugify produces a stable url-safe identifier', () => {
  assert.equal(slugify('Birth Certificate / NID'), 'birth-certificate-nid');
  assert.equal(slugify('  ---Road   Repair---  '), 'road-repair');
  assert.equal(slugify(''), '');
});
