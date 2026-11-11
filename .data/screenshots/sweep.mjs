import { chromium } from 'playwright-core';
import fs from 'node:fs';

const BASE = 'http://127.0.0.1:3021';
const TOOLS = 'area-code-lookup dkim-checker dmarc-checker domain-age-checker email-spam-score free-carrier-lookup free-email-verifier free-hlr-lookup free-ip-lookup free-phone-validator free-voip-checker is-this-a-scam is-this-link-safe mnp-checker phishing-email-checker phone-spam-check reverse-phone-lookup tech-stack-lookup vin-decoder who-called-me'.split(' ');
const CMP = 'abstract-api hlrlookup ipstack mailgun neverbounce telesign twilio'.split(' ');
const LEG = 'acceptable-use compliance-disclaimer data-processing privacy terms'.split(' ');
const TOP = 'docs for-agents for-platforms integrations pricing security status tools'.split(' ');

const routes = [
  { path: '/', name: 'index' },
  ...TOP.map((s) => ({ path: '/' + s, name: s })),
  ...TOOLS.map((s) => ({ path: '/tools/' + s, name: 'tools-' + s })),
  ...CMP.map((s) => ({ path: '/compare/' + s, name: 'cmp-' + s })),
  ...LEG.map((s) => ({ path: '/legal/' + s, name: 'legal-' + s })),
];

const views = [
  { tag: 'desk', width: 1440, height: 900 },
  { tag: 'mob', width: 390, height: 844 },
];

async function stepScroll(page) {
  await page.evaluate(async () => {
    const h = document.body.scrollHeight;
    for (let y = 0; y < h; y += 320) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 110));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(1400);
}

async function audit(page) {
  return page.evaluate(() => {
    const de = document.documentElement;
    const hidden = Array.from(
      document.querySelectorAll('main [data-reveal], main .ar')
    ).filter((el) => {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      // collapsed boxes (inactive CSS-only tab panels) are not missing content
      if (r.width + r.height === 0) return false;
      return parseFloat(cs.opacity) < 0.9;
    }).length;
    const themeHits = Array.from(document.querySelectorAll('button, a, [role=switch], svg'))
      .filter((el) => {
        const t = ((el.getAttribute('aria-label') || '') + ' ' + (el.textContent || '') + ' ' +
          (el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className || '')).toLowerCase();
        return /theme|dark mode|light mode|toggle/.test(t);
      }).map((el) => el.tagName + ':' + (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 24));
    const stored = (() => { try { return Object.keys(localStorage).filter((k) => /theme/.test(k)); } catch (e) { return []; } })();
    const body = getComputedStyle(document.body);
    const htmlBg = getComputedStyle(de).backgroundColor;
    const heroH1 = document.querySelector('main h1');
    // Content inside the current viewport that is still transparent is broken
    // either way; content below the fold is legitimately not revealed yet.
    const stranded = Array.from(
      document.querySelectorAll('main [data-reveal], main .ar')
    ).filter((el) => {
      const r = el.getBoundingClientRect();
      if (r.width + r.height === 0) return false;
      if (r.top >= window.innerHeight || r.bottom <= 0) return false;
      return parseFloat(getComputedStyle(el).opacity) < 0.9;
    }).map((el) => (el.className || el.tagName).toString().split(' ')[0] + '@' + Math.round(el.getBoundingClientRect().top));
    return {
      hidden,
      stranded,
      themeHits,
      stored,
      dataTheme: de.getAttribute('data-theme'),
      jsMotion: de.classList.contains('js-motion'),
      bodyColor: body.color,
      htmlBg,
      h1: heroH1 ? heroH1.textContent.trim().slice(0, 70) : null,
      h1Opacity: heroH1 ? parseFloat(getComputedStyle(heroH1.closest('[data-reveal],.ar') || heroH1).opacity) : null,
      overflowX: de.scrollWidth - de.clientWidth,
      scrollW: de.scrollWidth,
      winW: de.clientWidth,
    };
  });
}

const browser = await chromium.launch({ executablePath: process.env.PW_CHROME });
const results = [];

for (const view of views) {
  for (const r of routes) {
    const page = await browser.newPage({ viewport: { width: view.width, height: view.height } });
    const errs = [];
    page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)); });
    page.on('pageerror', (e) => errs.push('PAGEERROR ' + String(e.message).slice(0, 160)));
    let status = 0, row;
    try {
      const resp = await page.goto(BASE + r.path, { waitUntil: 'load', timeout: 45000 });
      status = resp ? resp.status() : 0;
      // 1400ms lets the mount-time reveal finish its 700ms transition before
      // the first-paint assertion runs, so mid-flight opacity is not a false hit
      await page.waitForTimeout(1400);
      const pre = await audit(page);
      await stepScroll(page);
      const a = await audit(page);
      a.preStranded = pre.stranded;
      a.name = r.name; a.path = r.path; a.view = view.tag; a.status = status;
      a.bad = status !== 200 || errs.length > 0 || a.overflowX > 1 || a.hidden > 0 ||
              a.stranded.length > 0 || a.preStranded.length > 0 ||
              a.themeHits.length > 0 || a.stored.length > 0 || a.dataTheme !== 'dark' ||
              !(a.h1Opacity > 0.9);
      a.errs = errs;
      row = a;
      const dir = 'redesign/sweep-' + view.tag;
      fs.mkdirSync(dir, { recursive: true });
      await page.screenshot({ path: dir + '/' + r.name + '-full.png', fullPage: true });
    } catch (e) {
      row = { name: r.name, path: r.path, view: view.tag, status, bad: true, errs: ['THROWN ' + e.message] };
    }
    results.push(row);
    console.log((row.bad ? 'FAIL ' : 'ok   ') + view.tag + ' ' + r.path +
      ' [' + row.status + '] hid=' + row.hidden + ' stranded=' + (row.stranded || []).length +
      '/' + (row.preStranded || []).length + ' ox=' + row.overflowX +
      ' theme=' + (row.themeHits || []).length + ' err=' + (row.errs || []).length);
    await page.close();
  }
}

fs.writeFileSync('redesign/sweep.json', JSON.stringify(results, null, 1));
const bad = results.filter((x) => x.bad);
console.log('\n== ' + results.length + ' checks, ' + bad.length + ' failing ==');
for (const b of bad) console.log(b.view + ' ' + b.path + ' ' + JSON.stringify({ s: b.status, hid: b.hidden, st: b.stranded, pre: b.preStranded, ox: b.overflowX, th: b.themeHits, ls: b.stored, dt: b.dataTheme, e: (b.errs || []).slice(0, 2) }));
await browser.close();
