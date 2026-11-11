import { chromium } from 'playwright-core';

const EXE = 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe';
const BASE = 'http://127.0.0.1:3021';
const OUT = '.data/screenshots';
const routes = process.argv.slice(2).length
  ? process.argv.slice(2).map((r) => (r === 'home' ? '/' : `/${r.replace(/^\/+/, '')}`))
  : ['/', '/docs', '/pricing'];

const browser = await chromium.launch({ executablePath: EXE, args: ['--disable-dev-shm-usage'] });

for (const route of routes) {
  const slug = route === '/' ? 'home' : route.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '');
  for (const [tag, vp] of [['desk', { width: 1440, height: 900 }], ['mob', { width: 390, height: 844, isMobile: true, hasTouch: true }]]) {
    const page = await browser.newPage({ viewport: vp, deviceScaleFactor: 1 });
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 140)); });
    page.on('pageerror', (e) => errors.push('PAGEERROR ' + String(e).slice(0, 140)));
    await page.goto(BASE + route, { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(1200);

    if (tag === 'desk') {
      const probe = await page.evaluate(() => {
        const pick = (sel, props) => {
          const el = document.querySelector(sel);
          if (!el) return { sel, missing: true };
          const cs = getComputedStyle(el);
          const out = { sel };
          for (const p of props) out[p] = cs[p];
          const r = el.getBoundingClientRect();
          out.box = `${Math.round(r.width)}x${Math.round(r.height)} @${Math.round(r.x)},${Math.round(r.y)}`;
          return out;
        };
        return {
          tokens: (() => {
            const cs = getComputedStyle(document.documentElement);
            const keys = ['--page', '--surface', '--ink', '--brand', '--rule', '--theme-hover', '--spacing6', '--site-max-width', '--font-display', '--font-body', '--radius-md'];
            const o = {};
            for (const k of keys) o[k] = cs.getPropertyValue(k).trim();
            return o;
          })(),
          body: pick('body', ['backgroundColor', 'color', 'fontFamily', 'lineHeight']),
          header: pick('header', ['height', 'backgroundColor', 'backdropFilter', 'position', 'borderBottomColor']),
          container: pick('.container', ['maxWidth', 'paddingLeft', 'height']),
          hero: pick('.hero', ['paddingTop', 'paddingBottom']),
          heroTitle: pick('.hero-title', ['fontSize', 'fontFamily', 'letterSpacing', 'color', 'lineHeight']),
          eyebrow: pick('.eyebrow', ['fontSize', 'textTransform', 'letterSpacing', 'color']),
          ctaBtn: pick('.cta-btn', ['backgroundColor', 'color', 'borderRadius', 'padding', 'fontSize']),
          tabbtn: pick('.tabbtn', ['borderColor', 'color', 'fontSize']),
          terminal: pick('.terminal', ['backgroundColor', 'borderRadius', 'color']),
          heroApi: pick('.hero-api', ['paddingTop', 'paddingBottom', 'borderTopColor']),
          footer: pick('footer', ['backgroundColor', 'color', 'paddingTop', 'borderTopColor']),
          panelVisible: [...document.querySelectorAll('.tabpanel')]
            .filter((e) => getComputedStyle(e).display !== 'none')
            .map((e) => e.id),
          scrollW: document.documentElement.scrollWidth,
          innerW: window.innerWidth,
        };
      });
      console.log(`\n===== ${route} =====`);
      console.log(JSON.stringify(probe, null, 1));
      console.log('errors:', errors.length ? errors : 'none');
    }

    await page.evaluate(async () => {
      const step = Math.round(window.innerHeight * 0.7);
      for (let y = 0; y < document.body.scrollHeight; y += step) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 120));
      }
      window.scrollTo(0, 0);
      await new Promise((r) => setTimeout(r, 500));
    });
    await page.screenshot({ path: `${OUT}/gate-${slug}-${tag}-hero.png` });
    await page.screenshot({ path: `${OUT}/gate-${slug}-${tag}-full.png`, fullPage: true });
    console.log(`shot gate-${slug}-${tag}`);
    await page.close();
  }
}
await browser.close();
