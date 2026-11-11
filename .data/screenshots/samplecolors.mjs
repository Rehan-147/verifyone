import { createRequire } from 'node:module';
const require = createRequire('C:/Users/SHAIK MOHAMMAD REHAN/Downloads/verifyone-FINAL-ALL/package.json');
const { chromium } = require('playwright-core');

const FILE =
  'file:///C:/Users/SHAIK MOHAMMAD REHAN/Downloads/verifyone-FINAL-ALL/.data/screenshots/localhost-home-current.png'.replace(
    / /g,
    '%20',
  );

// points of interest, in image pixels
const PTS = {
  pageBg: [360, 120],
  headerBg: [300, 40],
  headerRule: [360, 89],
  brandOne: [142, 47],
  verifyBlack: [60, 47],
  eyebrowText: [60, 219],
  h1Ink: [30, 290],
  bodyText: [40, 533],
  allowGreen: [546, 533],
  reviewAmber: [630, 533],
  blockRed: [95, 573],
};

const browser = await chromium.launch({
  executablePath: 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
});
const page = await browser.newPage();
await page.goto(FILE);
const out = await page.evaluate(async (pts) => {
  const img = document.querySelector('img');
  await img.decode();
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const hex = (x, y, r = 2) => {
    // darkest / most saturated pixel in a small box, to hit glyph ink not antialias bg
    let best = null;
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        const d = ctx.getImageData(x + dx, y + dy, 1, 1).data;
        const lum = 0.299 * d[0] + 0.587 * d[1] + 0.114 * d[2];
        const sat = Math.max(d[0], d[1], d[2]) - Math.min(d[0], d[1], d[2]);
        const score = sat * 3 + (255 - lum);
        if (!best || score > best.score) best = { score, d };
      }
    return (
      '#' +
      [...best.d.slice(0, 3)].map((v) => v.toString(16).padStart(2, '0')).join('') +
      ` (box ${2 * r + 1}px)`
    );
  };
  const res = {};
  for (const [k, v] of Object.entries(pts)) res[k] = hex(v[0], v[1]);
  res.__size = img.naturalWidth + 'x' + img.naturalHeight;
  return res;
}, PTS);
console.log(JSON.stringify(out, null, 2));
await browser.close();
