import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeReportLocation } from './reportLocation.js';

test('report location accepts address-only and valid coordinate pairs', () => {
  assert.deepEqual(normalizeReportLocation({ area: ' Central ', address: ' Main road ' }).value, { area: 'Central', address: 'Main road', landmark: '' });
  assert.deepEqual(normalizeReportLocation('{"latitude":"23.81","longitude":"90.41"}').value, { area: '', address: '', landmark: '', latitude: 23.81, longitude: 90.41 });
});

test('report location rejects partial, malformed, and out-of-range coordinates', () => {
  assert.equal(normalizeReportLocation({ latitude: 23.81 }).error, 'Provide both latitude and longitude, or omit both.');
  assert.equal(normalizeReportLocation({ longitude: 90.41 }).error, 'Provide both latitude and longitude, or omit both.');
  assert.equal(normalizeReportLocation('{bad').error, 'Location must be valid.');
  assert.equal(normalizeReportLocation({ latitude: 91, longitude: 90 }).error, 'Location coordinates must be valid latitude/longitude values.');
  assert.equal(normalizeReportLocation({ latitude: 23, longitude: 181 }).error, 'Location coordinates must be valid latitude/longitude values.');
});
