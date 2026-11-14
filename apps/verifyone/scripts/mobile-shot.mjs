// Mobile viewport audit — real device-metrics emulation via Chrome DevTools
// Protocol (plain headless --window-size gets clamped on Windows, so CSS-pixel
// widths below ~560 are unreliable). Spawns headless Chrome with a debugging
// port, emulates a 390x844 mobile viewport, and captures:
//   <name>-full.png  — full page, deviceScaleFactor 1 (whole-page layout check)
//   <name>-top.png   — first 844 CSS px, deviceScaleFactor 2 (text crispness)
// Usage: node scripts/mobile-shot.mjs <outDir> [name=url ...]
// Defaults to the localhost:3100 audit set when no urls are given.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const PORT = 9337;
const CHROME_CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
];
const WIDTH = Number(process.env.SHOT_W || 390);
const HEIGHT = Number(process.env.SHOT_H || 844);

const DEFAULT_PAGES = [
  ['home', 'http://localhost:3100/'],
  ['pricing', 'http://localhost:3100/pricing'],
  ['guide', 'http://localhost:3100/guides/solo-ai-voice-outbound'],
  ['dashboard', 'http://localhost:3100/dashboard'],
  ['tool', 'http://localhost:3100/tools/free-carrier-lookup'],
];

const args = process.argv.slice(2);
const outDir = args[0] || path.join(os.tmpdir(), 'mobile-audit');
const pages = args.length > 1
  ? args.slice(1).map((s) => { const i = s.indexOf('='); return [s.slice(0, i), s.slice(i + 1)]; })
  : DEFAULT_PAGES;

const chrome = CHROME_CANDIDATES.find((p) => fs.existsSync(p));
if (!chrome) { console.error('no chrome/edge found'); process.exit(2); }

const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shot-profile-'));
const proc = spawn(chrome, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profileDir}`, 'about:blank',
], { stdio: 'ignore' });

async function waitForEndpoint() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (r.ok) return await r.json();
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('chrome devtools endpoint never came up');
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// One flat WebSocket client per target: id-matched responses + event tap.
function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const pending = new Map();
    const events = [];
    ws.onmessage = (m) => {
      const msg = JSON.parse(m.data);
      if (msg.id && pending.has(msg.id)) {
        const { resolve: res, reject: rej } = pending.get(msg.id);
        pending.delete(msg.id);
        msg.error ? rej(new Error(msg.error.message)) : res(msg.result);
      } else if (msg.method) {
        events.push(msg);
      }
    };
    ws.onopen = () => resolve({
      send(method, params = {}) {
        const id = Math.floor(Math.random() * 1e9);
        return new Promise((res, rej) => {
          pending.set(id, { resolve: res, reject: rej });
          ws.send(JSON.stringify({ id, method, params }));
        });
      },
      nextEvent(method, timeoutMs = 20000) {
        const have = events.find((e) => e.method === method);
        if (have) return Promise.resolve(have);
        return new Promise((res, rej) => {
          const t0 = Date.now();
          const iv = setInterval(() => {
            const e = events.find((x) => x.method === method);
            if (e) { clearInterval(iv); res(e); }
            else if (Date.now() - t0 > timeoutMs) { clearInterval(iv); rej(new Error(`timeout waiting ${method}`)); }
          }, 50);
        });
      },
      close: () => ws.close(),
    });
    ws.onerror = (e) => reject(new Error('ws error ' + (e.message || '')));
  });
}

await waitForEndpoint();
fs.mkdirSync(outDir, { recursive: true });

for (const [name, url] of pages) {
  const created = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' }).then((r) => r.json());
  const c = await connect(created.webSocketDebuggerUrl);
  // True mobile viewport — applies before navigation so first paint is mobile.
  await c.send('Emulation.setDeviceMetricsOverride', {
    width: WIDTH, height: HEIGHT, deviceScaleFactor: 1, mobile: true,
  });
  await c.send('Page.enable');
  await c.send('Page.navigate', { url });
  await c.nextEvent('Page.loadEventFired', 45000);
  await sleep(2500); // hydration settle

  // full page at DPR 1
  const full = await c.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  fs.writeFileSync(path.join(outDir, `${name}-full.png`), Buffer.from(full.data, 'base64'));

  // top-of-page at DPR 2 for crisp text
  await c.send('Emulation.setDeviceMetricsOverride', {
    width: WIDTH, height: HEIGHT, deviceScaleFactor: 2, mobile: true,
  });
  await sleep(400);
  const top = await c.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(outDir, `${name}-top.png`), Buffer.from(top.data, 'base64'));

  // horizontal overflow check + offender list
  const metrics = await c.send('Runtime.evaluate', {
    expression: `(() => {
      const cw = document.documentElement.clientWidth;
      const offenders = [];
      for (const el of document.querySelectorAll('*')) {
        const r = el.getBoundingClientRect();
        if (r.right <= cw + 1 || r.width < 24) continue;
        // skip elements clipped by an overflow scroller ancestor
        let clipped = false;
        for (let a = el.parentElement; a; a = a.parentElement) {
          const s = getComputedStyle(a);
          if (/(auto|scroll|hidden|clip)/.test(s.overflowX) && a.getBoundingClientRect().left <= cw) { clipped = true; break; }
        }
        if (clipped) continue;
        offenders.push({ tag: el.tagName, cls: String(el.className || '').slice(0, 90), id: el.id || '', w: Math.round(r.width), right: Math.round(r.right) });
        if (offenders.length >= 10) break;
      }
      return JSON.stringify({ sw: document.documentElement.scrollWidth, cw, ch: document.documentElement.scrollHeight, offenders });
    })()`,
    returnByValue: true,
  });
  const m = JSON.parse(metrics.result.value);
  console.log(`${name}: scrollWidth=${m.sw} clientWidth=${m.cw} pageHeight=${m.ch} overflowX=${m.sw > m.cw}`);
  for (const o of m.offenders) console.log(`   > <${o.tag.toLowerCase()}${o.id ? '#' + o.id : ''}> w=${o.w} right=${o.right} cls="${o.cls}"`);
  c.close();
}

proc.kill();
try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch { /* chrome may hold the dir briefly */ }
console.log('done ->', outDir);
