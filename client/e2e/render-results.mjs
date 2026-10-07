// Render the real Playwright JSON results as a screenshot for the LaTeX report.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const output = path.resolve('../docs/report/playwright');
const results = JSON.parse(await readFile(path.join(output, 'results.json'), 'utf8'));
const rows = [];
function visit(suites) {
  for (const suite of suites || []) {
    for (const spec of suite.specs || []) {
      for (const test of spec.tests || []) {
        rows.push({ title: spec.title, status: test.status, duration: test.results.reduce((sum, item) => sum + item.duration, 0) });
      }
    }
    visit(suite.suites);
  }
}
visit(results.suites);
const escape = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const date = new Date(results.stats.startTime).toLocaleString('en-GB', { timeZone: 'Asia/Dhaka', hour12: false });
const summary = `Tests: ${rows.length}; passed: ${results.stats.expected}; failed: ${results.stats.unexpected}; skipped: ${results.stats.skipped}; flaky: ${results.stats.flaky}`;
const html = `<!doctype html><html><head><meta charset="utf-8"><title>CivicSync Playwright Results</title><style>
body{font:16px Arial,sans-serif;color:#17293b;background:#f3f6fa;padding:28px}main{background:white;padding:28px;border-radius:14px}h1{color:#164b73}table{border-collapse:collapse;width:100%;font-size:13px}td,th{border-bottom:1px solid #dde4ec;padding:9px;text-align:left}.expected{color:#087044}.unexpected{color:#bc2633}.summary{padding:18px;background:#eaf2f8;font-weight:bold}
</style></head><body><main><h1>CivicSync — Playwright Browser Tests</h1><p>Run started: ${escape(date)} (Asia/Dhaka)</p><p>Windows · headless Google Chrome · Playwright ${escape(results.config.version)} · desktop 1280×720 / mobile 390×844</p><p class="summary">${escape(summary)}</p><p>Runtime: ${(results.stats.duration / 1000).toFixed(1)} seconds. Source: actual Playwright results.json; no mocked API responses.</p><table><tr><th>#</th><th>Scenario</th><th>Result</th><th>Seconds</th></tr>${rows.map((row, index) => `<tr><td>${index + 1}</td><td>${escape(row.title)}</td><td class="${escape(row.status)}">${escape(row.status === 'expected' ? 'PASS' : row.status.toUpperCase())}</td><td>${(row.duration / 1000).toFixed(1)}</td></tr>`).join('')}</table><p>Scope: public UI, validation, signed-out route guards, theme and mobile controls. Authenticated workflows, external identity sign-in, backend persistence and cross-role authorization were not tested in this browser suite.</p></main></body></html>`;
await writeFile(path.join(output, 'summary.html'), html);
await writeFile(path.join(output, 'summary.txt'), `${date} Asia/Dhaka\n${summary}\nDuration: ${(results.stats.duration / 1000).toFixed(1)}s\n`);
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
try {
  const page = await browser.newPage({ viewport: { width: 1250, height: 1000 } });
  await page.setContent(html);
  await mkdir(path.resolve('../docs/report/screenshots'), { recursive: true });
  await page.screenshot({ path: path.resolve('../docs/report/screenshots/pw-results.png'), fullPage: true });
  const code = await readFile(path.resolve('e2e/public-workflows.spec.js'), 'utf8');
  const snippet = code.slice(code.indexOf("test('empty login submission"), code.indexOf("test('malformed email"));
  await page.setContent(`<html><body style="font:18px Arial;padding:28px;color:#17293b"><h1>Actual Playwright Test Code</h1><p>client/e2e/public-workflows.spec.js</p><pre style="font:17px Consolas,monospace;white-space:pre-wrap;background:#edf2f7;padding:20px;border-radius:10px">${escape(snippet)}</pre></body></html>`);
  await page.screenshot({ path: path.resolve('../docs/report/screenshots/pw-testing-code.png'), fullPage: true });
} finally { await browser.close(); }
console.log(summary);
