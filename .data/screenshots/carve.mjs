import fs from 'fs';

const file = process.argv[2] || '.next/cache/webpack/client-production/1.pack';
const anchor = process.argv[3] || '.eyebrow{';
const b = fs.readFileSync(file).toString('latin1');
const a = b.indexOf(anchor);
if (a === -1) { console.log('anchor not found'); process.exit(1); }

const printable = (ch) => ch.charCodeAt(0) >= 0x20 && ch.charCodeAt(0) <= 0x7e;
let s = a; while (s > 0 && printable(b[s - 1])) s--;
let e = a; while (e < b.length && printable(b[e])) e++;

const css = b.slice(s, e);
console.log(`run: ${s}..${e}  length=${css.length}`);
console.log('head: ' + JSON.stringify(css.slice(0, 160)));
console.log('tail: ' + JSON.stringify(css.slice(-160)));
for (const k of ['.hero-title', '.hero-description', '.dp-card', '.cta-btn', '.terminal', '.tabpanel', '.gate-']) {
  console.log(`  ${k}: ${css.includes(k) ? 'yes' : 'no'}`);
}
fs.writeFileSync('.data/screenshots/recovered.css', css, 'utf8');
console.log('wrote .data/screenshots/recovered.css');
