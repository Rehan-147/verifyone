import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: process.env.PW_CHROME });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errs = [];
p.on('pageerror', (e) => errs.push(e.message.slice(0, 90)));
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 90)); });
await p.goto('http://127.0.0.1:3021/', { waitUntil: 'load' });
await p.waitForTimeout(2200);
await p.evaluate(() => document.querySelector('.csstabs').scrollIntoView({ block: 'center' }));
await p.waitForTimeout(900);
const r = await p.evaluate(async () => {
  const btns = Array.from(document.querySelectorAll('.csstabs .tabbtn'));
  const out = [];
  for (let i = 0; i < btns.length; i++) {
    btns[i].click();
    await new Promise((r) => setTimeout(r, 130));
    const vis = Array.from(document.querySelectorAll('.csstabs .tabpanel')).filter((e) => getComputedStyle(e).display !== 'none');
    const t = vis[0] && vis[0].querySelector('.terminal');
    const active = getComputedStyle(btns[i]).color;
    out.push(btns[i].textContent.trim() + ':' + vis.length + 'panel op' + (t ? getComputedStyle(t).opacity : '-') + ' underline' + (getComputedStyle(btns[i]).borderBottomColor.includes('85, 230, 189') ? 'Y' : 'N'));
  }
  return out;
});
console.log(r.join('\n'));
console.log('errors: ' + errs.length);
await b.close();
