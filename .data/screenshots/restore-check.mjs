import { chromium } from 'playwright-core';

const BASE = 'http://127.0.0.1:3021';
const OUT = '.data/screenshots/restore';
const paths = ['/', '/pricing', '/docs', '/security', '/legal/terms', '/status', '/for-agents', '/for-platforms', '/tools', '/integrations', '/compare/twilio', '/dashboard'];

const browser = await chromium.launch({ executablePath: process.env.PW_CHROME });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const fails = [];
page.on('response', (r) => { if (r.status() >= 400) fails.push(`${r.status()} ${r.url().replace(BASE, '')}`); });
page.on('requestfailed', (r) => fails.push(`FAIL ${r.url().replace(BASE, '')}`));

for (const p of paths) {
  const res = await page.goto(BASE + p, { waitUntil: 'networkidle' });
  const look = await page.evaluate(() => {
    const cs = getComputedStyle(document.body);
    const h1 = document.querySelector('h1');
    const unseen = [...document.querySelectorAll('[style*="opacity"]')].filter((e) => parseFloat(getComputedStyle(e).opacity) < 0.5 && e.getBoundingClientRect().top < innerHeight).length;
    return { bg: cs.backgroundColor, fg: cs.color, font: cs.fontFamily.split(',')[0], h1: h1 ? h1.innerText.slice(0, 70) : null, text: document.body.innerText.length, brokenOpacity: unseen };
  });
  console.log(`${p.padEnd(16)} ${res.status()} ${JSON.stringify(look)}`);
  await page.screenshot({ path: `${OUT}${p.replace(/\//g, '_') || '/home'}.png`, fullPage: false });
}

console.log('\nfailed asset requests: ' + (fails.length ? '\n  ' + [...new Set(fails)].join('\n  ') : 'none'));
await browser.close();
