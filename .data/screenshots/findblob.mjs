import fs from 'fs';
import path from 'path';

const dirs = [
  '.next/cache/webpack/server-production',
  '.next/cache/webpack/client-production',
  '.next/cache/webpack/edge-server-production',
];
const printable = (ch) => ch.charCodeAt(0) >= 0x20 && ch.charCodeAt(0) <= 0x7e;
const anchors = ['.csstabs{', '.csstabs ', '.tabpanel{', '.decision-allow{', '.hero-title{', '.hero-wrap{', '.landing-section-title{'];

for (const d of dirs) {
  if (!fs.existsSync(d)) continue;
  for (const f of fs.readdirSync(d)) {
    const fp = path.join(d, f);
    if (!fs.statSync(fp).isFile()) continue;
    const b = fs.readFileSync(fp).toString('latin1');
    for (const a of anchors) {
      let i = b.indexOf(a);
      while (i !== -1) {
        let s = i; while (s > 0 && printable(b[s - 1])) s--;
        let e = i; while (e < b.length && printable(b[e])) e++;
        const len = e - s;
        const run = b.slice(s, e);
        const light = run.includes('--dp-color');
        const dark = /--brand|--ink-\d/.test(run);
        if (len > 2000) {
          console.log(`${fp} "${a}" @${i} runlen=${len} light=${light} dark=${dark}`);
          const out = `.data/screenshots/blob-${path.basename(fp)}-${a.replace(/[^a-z]/gi, '')}-${light ? 'light' : dark ? 'dark' : 'x'}.css`;
          if (!fs.existsSync(out)) { fs.writeFileSync(out, run, 'utf8'); console.log('   wrote ' + out); }
        }
        i = b.indexOf(a, i + 1);
      }
    }
  }
}
