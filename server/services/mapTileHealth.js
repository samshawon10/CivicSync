import http from 'node:http';
import https from 'node:https';

const DEFAULT_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const DEFAULT_PROVIDER = 'OpenStreetMap';
const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_HEALTHY_MS = 1000;
const DEFAULT_DEGRADED_MS = 3000;
const DEFAULT_CACHE_MS = 120000;

let cachedResult = null;
let cachedExpiresAt = 0;
let inFlight = null;

function numberFromEnv(value, fallback, min, max) {
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : fallback;
}

export function mapTileConfig(env = process.env) {
    const healthyMs = numberFromEnv(env.MAP_TILE_HEALTHY_MS, DEFAULT_HEALTHY_MS, 1, 60000);
    const degradedMs = Math.max(healthyMs + 1, numberFromEnv(env.MAP_TILE_DEGRADED_MS, DEFAULT_DEGRADED_MS, 1, 60000));
    return {
      tileUrl: env.MAP_TILE_URL || env.VITE_MAP_TILE_URL || DEFAULT_TILE_URL,
      provider: env.MAP_TILE_PROVIDER || DEFAULT_PROVIDER,
      timeoutMs: numberFromEnv(env.MAP_TILE_TIMEOUT_MS, DEFAULT_TIMEOUT_MS, 250, 15000),
      healthyMs,
      degradedMs,
      cacheMs: numberFromEnv(env.MAP_TILE_CACHE_MS, DEFAULT_CACHE_MS, 60000, 300000)
    };
}

function probeUrl(template) {
  if (typeof template !== 'string' || !template.trim()) return null;
  const concrete = template
    .replaceAll('{s}', 'a')
    .replaceAll('{z}', '1')
    .replaceAll('{x}', '0')
    .replaceAll('{y}', '0')
    .replaceAll('{r}', '');
  try {
    const url = new URL(concrete);
    return ['http:', 'https:'].includes(url.protocol) ? url : null;
  } catch {
    return null;
  }
}

function requestHead(url, timeoutMs) {
  return new Promise((resolve) => {
    const transport = url.protocol === 'https:' ? https : http;
    const startedAt = Date.now();
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      resolve({ ...result, responseTimeMs: result.responseTimeMs ?? Date.now() - startedAt });
    };
    const request = transport.request(url, {
      method: 'HEAD',
      headers: {
        'User-Agent': 'CivicSync-Map-Health/1.0',
        Accept: 'image/avif,image/webp,image/png,*/*;q=0.1'
      }
    }, (response) => {
      response.resume();
      finish({ statusCode: response.statusCode || 0 });
    });
    request.setTimeout(timeoutMs, () => {
      request.destroy(new Error('timeout'));
      finish({ error: 'timeout', statusCode: 0 });
    });
    request.on('error', (error) => finish({ error: error.message, statusCode: 0 }));
    request.end();
  });
}

export function classifyMapTileProbe(probe, config) {
  const checkedAt = new Date();
  const responseTimeMs = Number.isFinite(Number(probe?.responseTimeMs)) ? Number(probe.responseTimeMs) : null;
  const statusCode = Number(probe?.statusCode || 0);
  if (probe?.error) {
    const invalidConfig = probe.error === 'invalid_configured_url';
    return {
      service: 'Map Tiles',
      status: invalidConfig ? 'unknown' : 'unhealthy',
      provider: config.provider,
      checkedAt: checkedAt.toISOString(),
      responseTimeMs,
      message: invalidConfig ? 'Map tile provider URL is not configured correctly.' : probe.error === 'timeout' ? 'Map tile provider timed out.' : 'Unable to reach map tile provider.',
      statusCode
    };
  }
  if (statusCode >= 200 && statusCode < 400) {
    const degraded = responseTimeMs != null && responseTimeMs > config.healthyMs;
    const slowFailure = responseTimeMs != null && responseTimeMs > config.degradedMs;
    return {
      service: 'Map Tiles',
      status: slowFailure ? 'unhealthy' : degraded ? 'degraded' : 'healthy',
      provider: config.provider,
      checkedAt: checkedAt.toISOString(),
      responseTimeMs,
      message: slowFailure ? 'Map tile provider response exceeded the degraded threshold.' : degraded ? 'Map tile provider is responding slowly.' : 'Map tile provider is responding normally.',
      statusCode
    };
  }
  return {
    service: 'Map Tiles',
    status: 'unhealthy',
    provider: config.provider,
    checkedAt: checkedAt.toISOString(),
    responseTimeMs,
    message: `Map tile provider returned HTTP ${statusCode || 'unknown'}.`,
    statusCode
  };
}

export async function checkMapTileHealth({ force = false, env = process.env, probe = requestHead, now = Date.now() } = {}) {
  const config = mapTileConfig(env);
  if (!force && cachedResult && now < cachedExpiresAt) return { ...cachedResult, cached: true };
  if (inFlight) return inFlight;
  const url = probeUrl(config.tileUrl);
  inFlight = (async () => {
    const result = !url
      ? classifyMapTileProbe({ error: 'invalid_configured_url', statusCode: 0 }, config)
      : classifyMapTileProbe(await probe(url, config.timeoutMs), config);
    const resultWithCache = { ...result, cached: false, cacheExpiresAt: new Date(now + config.cacheMs).toISOString() };
    cachedResult = resultWithCache;
    cachedExpiresAt = now + config.cacheMs;
    return resultWithCache;
  })().finally(() => { inFlight = null; });
  return inFlight;
}

export function resetMapTileHealthCache() {
  cachedResult = null;
  cachedExpiresAt = 0;
  inFlight = null;
}
