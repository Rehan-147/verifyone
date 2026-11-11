import { chromium } from 'playwright-core';
import fs from 'node:fs';

const EXE = process.env.PW_CHROME;
const BASE = 'http://127.0.0.1:3021';
const OUT = '.data/screenshots/redesign';
const ROUTES = process.argv.slice(2).length ? process.argv.slice(2).join(',').split(',')
  : ['/', '/pricing', '/docs', '/integrations', '/for-agents', '/for-platforms', '/security', '/status', '/tools', '/tools/free-carrier-lookup', '/compare/twilio', '/legal/privacy'];

const browser = await chromium.launch({ executablePath: EXE, args: ['--disable-dev-shm-usage'] });
const report = [];

for (const route of ROUTES) {
  const slug = route === '/' ? 'home' : route.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '');
  for (const [tag, vp] of [['desk', { width: 1440, height: 900 }], ['mob', { width: 390, height: 844, isMobile: true, hasTouch: true }]]) {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1 });
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });
    page.on('pageerror', (e) => errors.push('PAGEERROR ' + String(e).slice(0, 160)));
    try {
      const res = await page.goto(BASE + route, { waitUntil: 'load', timeout: 30000 });
      await page.waitForTimeout(vp.isMobile ? 900 : 1600);
      await page.evaluate(async () => {
        const step = Math.round(window.innerHeight * 0.6);
        for (let y = 0; y < document.body.scrollHeight; y += step) {
          window.scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 160));
        }
        window.scrollTo(0, document.body.scrollHeight);
        await new Promise((r) => setTimeout(r, 400));
      });
      await page.waitForTimeout(900);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(700);
      await page.screenshot({ path: `${OUT}/${slug}-${tag}-full.png`, fullPage: true });
      await page.screenshot({ path: `${OUT}/${slug}-${tag}-hero.png` });
      const overflow = await page.evaluate(() => ({
        docW: document.documentElement.scrollWidth,
        winW: window.innerWidth,
        hidden: [...document.querySelectorAll('[data-reveal]')].filter((e) => !e.classList.contains('is-visible')).length,
        total: document.querySelectorAll('[data-reveal]').length,
      }));
      report.push({ route, tag, status: res && res.status(), overflow, errors });
    } catch (e) {
      report.push({ route, tag, error: String(e).slice(0, 200) });
    }
    await page.close();
  }
  console.log(slug, 'done');
}
fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
await browser.close();
