import { createRequire } from 'node:module';
const require = createRequire('C:/Users/SHAIK MOHAMMAD REHAN/Downloads/verifyone-FINAL-ALL/package.json');
const { chromium } = require('playwright-core');

const FILE =
  'file:///C:/Users/SHAIK MOHAMMAD REHAN/Downloads/verifyone-FINAL-ALL/.data/screenshots/localhost-home-current.png'.replace(
    / /g,
    '%20',
  );

const browser = await chromium.launch({
  executablePath: 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
});
const page = await browser.newPage();
await page.goto(FILE);
const res = await page.evaluate(async () => {
  const img = document.querySelector('img');
  await img.decode();
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const { data } = ctx.getImageData(0, 0, c.width, c.height);
  // quantize to 16 levels per channel, count
  const counts = new Map();
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const key = [r, g, b].map((v) => (v >> 3) << 3).join(',');
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const all = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const hex = (k) => '#' + k.split(',').map((v) => Number(v).toString(16).padStart(2, '0')).join('');
  const sat = (k) => {
    const [r, g, b] = k.split(',').map(Number);
    return Math.max(r, g, b) - Math.min(r, g, b);
  };
  const lum = (k) => {
    const [r, g, b] = k.split(',').map(Number);
    return 0.299 * r + 0.587 * g + 0.114 * b;
  };
  return {
    size: c.width + 'x' + c.height,
    top20: all.slice(0, 20).map(([k, n]) => `${hex(k)} x${n}`),
    colored: all
      .filter(([k]) => sat(k) > 30)
      .slice(0, 25)
      .map(([k, n]) => `${hex(k)} sat${sat(k)} x${n}`),
    darkInk: all
      .filter(([k]) => lum(k) < 90 && sat(k) <= 30)
      .slice(0, 6)
      .map(([k, n]) => `${hex(k)} x${n}`),
  };
});
console.log(JSON.stringify(res, null, 2));
await browser.close();
