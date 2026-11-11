import { createRequire } from 'node:module';
const require = createRequire('C:/Users/SHAIK MOHAMMAD REHAN/Downloads/verifyone-FINAL-ALL/package.json');
const { chromium } = require('playwright-core');

const FILE =
  'file:///C:/Users/SHAIK MOHAMMAD REHAN/Downloads/verifyone-FINAL-ALL/.data/screenshots/localhost-home-current.png'.replace(
    / /g,
    '%20',
  );
// coordinates in the 720-wide preview I inspected; image is 635 wide -> scale 0.882
const S = 635 / 720;
const PTS = {
  brandOne: [142, 47],
  eyebrow: [60, 219],
  h1: [30, 290],
  body: [40, 533],
  allow: [548, 533],
  review: [628, 533],
  block: [95, 573],
};

const browser = await chromium.launch({
  executablePath: 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
});
const page = await browser.newPage();
await page.goto(FILE);
const out = await page.evaluate(
  async ({ pts, s }) => {
    const img = document.querySelector('img');
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const res = { size: `${c.width}x${c.height}` };
    for (const [k, p] of Object.entries(pts)) {
      const X = Math.round(p[0] * s), Y = Math.round(p[1] * s);
      let best = null;
      for (let dy = -6; dy <= 6; dy++)
        for (let dx = -6; dx <= 6; dx++) {
          const d = ctx.getImageData(X + dx, Y + dy, 1, 1).data;
          const sat = Math.max(d[0], d[1], d[2]) - Math.min(d[0], d[1], d[2]);
          const lum = 0.299 * d[0] + 0.587 * d[1] + 0.114 * d[2];
          if (lum > 240) continue; // skip page background
          const score = sat > 25 ? sat * 4 + (255 - lum) : 255 - lum;
          if (!best || score > best.score) best = { score, d, x: X + dx, y: Y + dy };
        }
      res[k] =
        '#' + [...best.d.slice(0, 3)].map((v) => v.toString(16).padStart(2, '0')).join('') +
        ` @${best.x},${best.y}`;
    }
    return res;
  },
  { pts: PTS, s: S },
);
console.log(JSON.stringify(out, null, 2));
await browser.close();
