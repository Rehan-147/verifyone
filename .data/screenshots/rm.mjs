import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: process.env.PW_CHROME });
const routes = ['/', '/pricing', '/integrations', '/docs', '/tools/free-phone-validator', '/compare/twilio'];
for (const path of routes) {
  for (const vp of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const ctx = await b.newContext({ viewport: vp, reducedMotion: 'reduce' });
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message.slice(0, 90)));
    await p.goto('http://127.0.0.1:3021' + path, { waitUntil: 'load' });
    await p.waitForTimeout(1500);
    const r = await p.evaluate(() => {
      const els = Array.from(document.querySelectorAll('main [data-reveal], main .ar'));
      const inv = els.filter((e) => parseFloat(getComputedStyle(e).opacity) < 0.9 && (e.getBoundingClientRect().width + e.getBoundingClientRect().height) > 0);
      const anim = document.getAnimations ? document.getAnimations().length : -1;
      return { jsMotion: document.documentElement.classList.contains('js-motion'), targets: els.length, invisible: inv.length,
        sample: inv.slice(0, 3).map((e) => (e.className || e.tagName).split(' ')[0]), runningAnimations: anim,
        marqueeDur: (() => { const m = document.querySelector('.marquee-track'); return m ? getComputedStyle(m).animationDuration : 'none'; })(),
        ox: document.documentElement.scrollWidth - document.documentElement.clientWidth };
    });
    console.log((r.invisible === 0 && r.ox <= 1 && errs.length === 0 ? 'ok   ' : 'CHECK ') + path + ' ' + vp.width + ' jsMotion=' + r.jsMotion + ' targets=' + r.targets + ' invisible=' + r.invisible + ' anims=' + r.runningAnimations + ' marquee=' + r.marqueeDur + ' ox=' + r.ox + ' err=' + errs.length);
    if (vp.width === 1440) await p.screenshot({ path: 'redesign/reduced-' + path.replace(/\//g, '-') + '-desk.png', fullPage: true });
    await ctx.close();
  }
}
await b.close();
