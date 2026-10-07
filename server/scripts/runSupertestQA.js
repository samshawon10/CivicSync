import { spawn } from 'node:child_process';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const serverDir = fileURLToPath(new URL('../', import.meta.url));
const output = path.resolve(serverDir, '../docs/report/supertest');
await mkdir(output, { recursive: true });
const startedAt = new Date().toISOString();
const begin = performance.now();
const child = spawn(process.execPath, ['--test', '--test-reporter=tap', 'integration/system.test.js'], {
  cwd: serverDir,
  env: { ...process.env, RUN_QA_INTEGRATION: '1', SUPERTEST_METRICS_PATH: path.join(output, 'http-metrics.json') },
  windowsHide: true,
  stdio: ['ignore', 'pipe', 'pipe'],
});
let stdout = '', stderr = '';
child.stdout.on('data', data => { stdout += data; process.stdout.write(data); });
child.stderr.on('data', data => { stderr += data; process.stderr.write(data); });
const exitCode = await new Promise((resolve, reject) => {
  child.once('error', reject);
  child.once('exit', code => resolve(code ?? 1));
});
const count = name => Number(stdout.match(new RegExp(`^# ${name} (\\d+)$`, 'm'))?.[1] || 0);
const scenarios = [...stdout.matchAll(/^\s{4}(ok|not ok) \d+ - (.+)$/gm)]
  .map(match => ({ name: match[2], passed: match[1] === 'ok' }));
let httpMetrics = null;
try { httpMetrics = JSON.parse(await readFile(path.join(output, 'http-metrics.json'), 'utf8')); } catch { /* setup may fail */ }
const summary = {
  tool: 'Supertest with Node.js test runner', startedAt,
  durationSeconds: Number(((performance.now() - begin) / 1000).toFixed(2)), exitCode,
  tests: count('tests'), passed: count('pass'), failed: count('fail'), skipped: count('skipped'),
  scenarios, httpMetrics,
  scope: 'Supertest REST/multipart checks against an isolated real API and MongoDB; supporting direct database assertions, Socket.io checks, and a separate AI acceptance script.',
};
await writeFile(path.join(output, 'output.tap'), stdout);
await writeFile(path.join(output, 'stderr.txt'), stderr);
await writeFile(path.join(output, 'results.json'), JSON.stringify(summary, null, 2));
console.log(`Supertest QA: ${summary.passed}/${summary.tests} passed; ${summary.failed} failed; ${summary.skipped} skipped.`);
process.exitCode = exitCode;
