import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyMapTileProbe, mapTileConfig } from './mapTileHealth.js';

const config = mapTileConfig({ MAP_TILE_URL: 'https://tiles.example/{z}/{x}/{y}.png', MAP_TILE_PROVIDER: 'Example', MAP_TILE_HEALTHY_MS: '1000', MAP_TILE_DEGRADED_MS: '3000' });

test('map tile probe maps successful responses to healthy or degraded', () => {
  assert.equal(classifyMapTileProbe({ statusCode: 200, responseTimeMs: 250 }, config).status, 'healthy');
  assert.equal(classifyMapTileProbe({ statusCode: 200, responseTimeMs: 1800 }, config).status, 'degraded');
  assert.equal(classifyMapTileProbe({ statusCode: 200, responseTimeMs: 3200 }, config).status, 'unhealthy');
});

test('map tile probe distinguishes failure, timeout, and invalid configuration', () => {
  assert.equal(classifyMapTileProbe({ statusCode: 503, responseTimeMs: 100 }, config).status, 'unhealthy');
  assert.equal(classifyMapTileProbe({ error: 'timeout', statusCode: 0 }, config).status, 'unhealthy');
  assert.equal(classifyMapTileProbe({ error: 'invalid_configured_url', statusCode: 0 }, config).status, 'unknown');
});

test('map tile config uses the existing OpenStreetMap default', () => {
  const defaults = mapTileConfig({});
  assert.equal(defaults.provider, 'OpenStreetMap');
  assert.equal(defaults.tileUrl, 'https://tile.openstreetmap.org/{z}/{x}/{y}.png');
  assert.equal(defaults.timeoutMs, 5000);
  assert.equal(defaults.cacheMs, 120000);
});
