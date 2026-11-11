import { chromium } from 'playwright-core';

const browser = await chromium.launch({ executablePath: process.env.PW_CHROME });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });

async function grab(url) {
  const p = await ctx.newPage();
  await p.goto(url, { waitUntil: 'domcontentloaded' });
  const data = await p.evaluate(() => {
    const main = document.querySelector('main');
    const secs = [...main.children].map((el) => el.tagName.toLowerCase() + '.' + (el.className || '').toString().trim().split(/\s+/).slice(0, 2).join('.'));
    const norm = (s) => s.replace(/\s+/g, ' ').trim();
    return {
      title: document.title,
      secs,
      text: norm(main.innerText).slice(0, 400),
      textLen: norm(main.innerText).length,
      h2: [...main.querySelectorAll('h2')].map((h) => norm(h.innerText).slice(0, 60)),
      mainHtmlLen: main.innerHTML.length,
    };
  });
  await p.close();
  return data;
}

const a = await grab('http://127.0.0.1:3000/');
const b = await grab('http://127.0.0.1:3021/');

console.log('title  3000: ' + a.title);
console.log('title  3021: ' + b.title);
console.log('\nsections 3000 (' + a.secs.length + '): ' + a.secs.join(' | '));
console.log('sections 3021 (' + b.secs.length + '): ' + b.secs.join(' | '));
console.log('\nh2 3000: ' + JSON.stringify(a.h2, null, 0));
console.log('h2 3021: ' + JSON.stringify(b.h2, null, 0));
console.log('\nmain innerHTML length 3000=' + a.mainHtmlLen + ' 3021=' + b.mainHtmlLen);
console.log('visible text length  3000=' + a.textLen + ' 3021=' + b.textLen);
console.log('\nfirst 200 chars 3000: ' + a.text.slice(0, 200));
console.log('first 200 chars 3021: ' + b.text.slice(0, 200));
await browser.close();
