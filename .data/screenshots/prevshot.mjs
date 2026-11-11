import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: process.env.PW_CHROME });
const p = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const errs = [];
p.on('pageerror', (e) => errs.push(e.message.slice(0, 80)));
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 80)); });
await p.goto('http://127.0.0.1:3030/', { waitUntil: 'load' });
await p.waitForTimeout(2500);
const r = await p.evaluate(() => ({
  bodyBg: getComputedStyle(document.body).backgroundColor,
  h1: document.querySelector('h1') ? document.querySelector('h1').textContent.trim().slice(0, 60) : null,
  font: getComputedStyle(document.body).fontFamily.slice(0, 40),
  links: document.querySelectorAll('a').length,
  ox: document.documentElement.scrollWidth - document.documentElement.clientWidth,
}));
console.log(JSON.stringify(r));
console.log('errors: ' + errs.length + ' ' + JSON.stringify(errs.slice(0, 3)));
await p.screenshot({ path: 'previous-home.png' });
await b.close();
