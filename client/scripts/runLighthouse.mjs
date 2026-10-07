import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import lighthouse from 'lighthouse';
import desktopConfig from 'lighthouse/core/config/desktop-config.js';
import { launch } from 'chrome-launcher';
import { preview } from 'vite';
import { chromium } from '@playwright/test';

const output = path.resolve('../docs/report/lighthouse');
const screenshots = path.resolve('../docs/report/screenshots');
await mkdir(output, { recursive: true });
await mkdir(screenshots, { recursive: true });
const server = await preview({ preview: { host: '127.0.0.1', port: 5180, strictPort: true } });
const chromePath = process.env.PLAYWRIGHT_CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const records = [];
let chrome;
try {
  chrome = await launch({ chromePath, chromeFlags: ['--headless', '--disable-gpu', '--no-first-run'] });
  for (const page of [{ name: 'landing', route: '/' }, { name: 'login', route: '/login' }]) {
    for (const profile of ['mobile', 'desktop']) {
      const key = `${page.name}-${profile}`;
      console.log(`Auditing ${key}...`);
      const { lhr, report } = await lighthouse(`http://127.0.0.1:5180${page.route}`, {
        port: chrome.port, logLevel: 'error', output: ['html', 'json'],
        onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
      }, profile === 'desktop' ? desktopConfig : undefined);
      await writeFile(path.join(output, `${key}.html`), report[0]);
      await writeFile(path.join(output, `${key}.json`), report[1]);
      const categories = Object.fromEntries(Object.entries(lhr.categories).map(([id, c]) => [id, c.score === null ? null : Math.round(c.score * 100)]));
      const metrics = Object.fromEntries(['first-contentful-paint', 'largest-contentful-paint', 'speed-index', 'total-blocking-time', 'cumulative-layout-shift'].map(id => [id, {
        value: lhr.audits[id]?.numericValue ?? null, display: lhr.audits[id]?.displayValue ?? 'Unavailable',
      }]));
      const findings = Object.values(lhr.audits).filter(a => a.score !== null && a.score < 1 && !['manual', 'notApplicable', 'informative'].includes(a.scoreDisplayMode))
        .map(a => ({ id: a.id, title: a.title, score: a.score, display: a.displayValue || '' }));
      records.push({ page: page.name, profile, version: lhr.lighthouseVersion, fetchedAt: lhr.fetchTime,
        requestedUrl: lhr.requestedUrl, finalUrl: lhr.finalDisplayedUrl,
        categories, metrics, findings, warnings: lhr.runWarnings, runtimeError: lhr.runtimeError || null,
        settings: { formFactor: lhr.configSettings.formFactor, throttlingMethod: lhr.configSettings.throttlingMethod,
          throttling: lhr.configSettings.throttling, screenEmulation: lhr.configSettings.screenEmulation } });
      await writeFile(path.join(output, 'results.json'), JSON.stringify(records, null, 2));
      console.log(`${key}: ${JSON.stringify(categories)}`);
    }
  }
} finally {
  if (chrome) await chrome.kill();
  await new Promise(resolve => server.httpServer.close(resolve));
}

const escape = v => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const html = `<!doctype html><html><head><meta charset="utf-8"><title>CivicSync Lighthouse Results</title><style>body{font:18px Arial;background:#f3f6fa;color:#17293b;padding:28px}main{background:white;padding:28px;border-radius:14px}h1{color:#164b73}table{border-collapse:collapse;width:100%}td,th{padding:16px;text-align:left;border-bottom:1px solid #dce4ec}small{font-size:15px}</style></head><body><main><h1>CivicSync — Lighthouse Production Audit</h1><p>Local production preview · Chrome · Lighthouse ${escape(records[0].version)}</p><p>Measured on ${escape(new Date(records[0].fetchedAt).toLocaleString('en-GB', { timeZone: 'Asia/Dhaka' }))} (Asia/Dhaka)</p><table><tr><th>Page</th><th>Profile</th><th>Performance</th><th>Accessibility</th><th>Best practices</th><th>SEO</th></tr>${records.map(r => `<tr><td>${r.page}</td><td>${r.profile}</td>${['performance', 'accessibility', 'best-practices', 'seo'].map(id => `<td>${r.categories[id] ?? 'N/A'}</td>`).join('')}</tr>`).join('')}</table><p><small>Scores out of 100. One run per page/profile with default simulated throttling. Public unauthenticated pages only. Local measurements vary by hardware/network and do not establish backend correctness, WCAG compliance, or deployed performance.</small></p><h2>Key metrics</h2><table><tr><th>Page / profile</th><th>FCP</th><th>LCP</th><th>TBT</th><th>CLS</th></tr>${records.map(r => `<tr><td>${r.page} / ${r.profile}</td>${['first-contentful-paint', 'largest-contentful-paint', 'total-blocking-time', 'cumulative-layout-shift'].map(id => `<td>${escape(r.metrics[id].display)}</td>`).join('')}</tr>`).join('')}</table></main></body></html>`;
await writeFile(path.join(output, 'summary.html'), html);
const browser = await chromium.launch({ executablePath: chromePath });
try {
  const page = await browser.newPage({ viewport: { width: 1350, height: 1000 } });
  await page.setContent(html);
  await page.screenshot({ path: path.join(screenshots, 'lighthouse-results.png'), fullPage: true });
  for (const record of records) {
    const key = `${record.page}-${record.profile}`;
    await page.goto(pathToFileURL(path.join(output, `${key}.html`)).href);
    await page.screenshot({ path: path.join(screenshots, `lighthouse-${key}.png`) });
  }
} finally { await browser.close(); }
if (records.some(record => record.runtimeError)) process.exitCode = 1;
