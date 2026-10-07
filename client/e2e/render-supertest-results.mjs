import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const output = path.resolve('../docs/report/supertest');
const results = JSON.parse(await readFile(path.join(output, 'results.json'), 'utf8'));
const escape = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const date = new Date(results.startedAt).toLocaleString('en-GB', { timeZone: 'Asia/Dhaka', hour12: false });
const summary = `${results.passed}/${results.tests} passed; ${results.failed} failed; ${results.skipped} skipped`;
const html = `<!doctype html><html><head><meta charset="utf-8"><title>CivicSync Supertest Results</title><style>
body{font:17px Arial;color:#17293b;background:#f3f6fa;padding:28px}main{background:white;padding:28px;border-radius:14px}h1{color:#164b73}table{border-collapse:collapse;width:100%;font-size:15px}td,th{border-bottom:1px solid #dde4ec;padding:12px;text-align:left}.summary{padding:18px;background:#eaf2f8;font-weight:bold}.pass{color:#087044}.fail{color:#bc2633}
</style></head><body><main><h1>CivicSync — Supertest Backend Integration</h1><p>Run started: ${escape(date)} (Asia/Dhaka)</p><p>Real Express API · isolated MongoDB · Node.js runner · Supertest REST/multipart requests</p><p class="summary">${escape(summary)} · ${results.durationSeconds} seconds</p><p>Node totals include one parent suite and ${results.scenarios.length} child scenarios. Counted Supertest responses: ${results.httpMetrics?.requests ?? 'unavailable'} (includes readiness checks).</p><table><tr><th>#</th><th>Scenario</th><th>Result</th></tr>${results.scenarios.map((item, index) => `<tr><td>${index + 1}</td><td>${escape(item.name)}</td><td class="${item.passed ? 'pass' : 'fail'}">${item.passed ? 'PASS' : 'FAIL'}</td></tr>`).join('')}</table><p>HTTP status counts: ${escape(JSON.stringify(results.httpMetrics?.statuses || {}))}</p><p>Supporting checks use direct database assertions, Socket.io, and a separate AI acceptance script. These are not individually counted as Supertest HTTP requests. Firebase browser sign-in and external AI-provider quality are outside this scope.</p><p>Source: actual Node TAP output and recorded HTTP response metrics.</p></main></body></html>`;
await writeFile(path.join(output, 'summary.html'), html);
await writeFile(path.join(output, 'summary.txt'), `${date} Asia/Dhaka\n${summary}\nDuration: ${results.durationSeconds}s\nHTTP metrics: ${JSON.stringify(results.httpMetrics)}\n`);
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
try {
  const page = await browser.newPage({ viewport: { width: 1250, height: 1000 } });
  await mkdir(path.resolve('../docs/report/screenshots'), { recursive: true });
  await page.setContent(html);
  await page.screenshot({ path: path.resolve('../docs/report/screenshots/supertest-results.png'), fullPage: true });
  const source = await readFile(path.resolve('../server/integration/system.test.js'), 'utf8');
  const snippet = source.slice(source.indexOf("await t.test('authentication,"), source.indexOf("      for (const role of roleOrder)"));
  await page.setContent(`<html><body style="font:18px Arial;padding:28px;color:#17293b"><h1>Actual Supertest Integration Test Code</h1><p>server/integration/system.test.js</p><pre style="font:16px Consolas,monospace;white-space:pre-wrap;background:#edf2f7;padding:20px;border-radius:10px">${escape(snippet)}<br>// The expect() helper sends a Supertest request and calls .expect(status).</pre></body></html>`);
  await page.screenshot({ path: path.resolve('../docs/report/screenshots/supertest-testing-code.png'), fullPage: true });
} finally { await browser.close(); }
console.log(summary);
