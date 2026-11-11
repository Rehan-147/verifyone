import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: process.env.PW_CHROME });
for (const vp of [{ width: 1440, height: 900 }, { width: 1440, height: 800 }, { width: 390, height: 844 }]) {
  const p = await b.newPage({ viewport: vp });
  const errs = [];
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 110)); });
  p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message.slice(0, 110)));
  await p.goto('http://127.0.0.1:3021/', { waitUntil: 'load' });
  await p.waitForTimeout(3000);
  const hero = await p.evaluate(() => {
    const q = (s) => { const e = document.querySelector(s); return e ? s.replace('.', '') + '=op' + getComputedStyle(e).opacity + '@' + Math.round(e.getBoundingClientRect().top) : s + ' MISSING'; };
    return ['.hero-ctas', '.hero-note', '.gate-console', '.hero-h1'].map(q).join(' ') + ' | ctasInView=' + (document.querySelector('.hero-ctas').getBoundingClientRect().top < window.innerHeight);
  });
  console.log(vp.width + 'x' + vp.height + ' HERO(no scroll): ' + hero);
  const tabTest = await p.evaluate(async () => {
    const btns = Array.from(document.querySelectorAll('.csstabs .tabbtn'));
    const visPanel = () => Array.from(document.querySelectorAll('.csstabs .tabpanel')).filter((e) => getComputedStyle(e).display !== 'none');
    const out = [];
    for (let i = 0; i < btns.length; i++) {
      btns[i].click();
      await new Promise((r) => setTimeout(r, 120));
      const v = visPanel();
      const t = v[0] && v[0].querySelector('.terminal');
      out.push(btns[i].textContent.trim() + '->' + v.length + 'panel/' + (t ? t.textContent.trim().slice(0, 9) + '/op' + getComputedStyle(t).opacity : 'EMPTY'));
    }
    return out;
  });
  console.log('  TABS: ' + tabTest.join('  '));
  await p.evaluate(async () => { const h = document.body.scrollHeight; for (let y = 0; y < h; y += 320) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 110)); } window.scrollTo(0, 0); });
  await p.waitForTimeout(1400);
  const hidden = await p.evaluate(() => Array.from(document.querySelectorAll('main [data-reveal], main .ar')).filter((el) => parseFloat(getComputedStyle(el).opacity) < 0.9 && el.getBoundingClientRect().width + el.getBoundingClientRect().height > 0).map((e) => (e.className || e.tagName).split(' ')[0]));
  console.log('  hidden after scroll: ' + JSON.stringify(hidden) + ' | errors: ' + errs.length + ' ' + JSON.stringify(errs.slice(0, 2)));
  await p.close();
}
await b.close();
