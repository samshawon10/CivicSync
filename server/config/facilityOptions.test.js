import test from 'node:test';
import assert from 'node:assert/strict';
import { facilityGroups, facilityPoint, facilityTypeLabels, facilityTypeMeta, facilityTypes, nearestHelpTypes } from './facilityOptions.js';

test('facility catalog is complete, unique and fully grouped', () => {
  assert.equal(new Set(facilityTypes).size, facilityTypes.length);
  assert.deepEqual(Object.keys(facilityTypeLabels).sort(), [...facilityTypes].sort());
  const grouped = facilityGroups.flatMap((group) => group.types);
  assert.equal(new Set(grouped).size, grouped.length);
  assert.deepEqual([...grouped].sort(), [...facilityTypes].sort());
  for (const type of facilityTypes) assert.equal(facilityTypeMeta(type).type, type);
  assert.deepEqual([...nearestHelpTypes].sort(), ['ambulance', 'fire_station', 'hospital', 'pharmacy', 'police', 'safe_point', 'shelter']);
});

test('facility GeoJSON uses longitude before latitude and rejects invalid pairs', () => {
  assert.deepEqual(facilityPoint(23.8103, 90.4125), { type: 'Point', coordinates: [90.4125, 23.8103] });
  assert.equal(facilityPoint(23.8103, null), undefined);
  assert.equal(facilityPoint('invalid', 90.4125), undefined);
});
