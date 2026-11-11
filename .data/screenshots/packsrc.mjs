import fs from 'fs';
import path from 'path';

const dirs = [
  '.next/cache/webpack/server-production',
  '.next/cache/webpack/client-production',
  '.next/cache/webpack/edge-server-production',
];
const anchors = ['@tailwind base;', '@tailwind components;', 'Design-system CSS tokens'];
const printable = (ch) => ch.charCodeAt(0) >= 0x20 && ch.charCodeAt(0) <= 0x7e;

for (const d of dirs) {
  if (!fs.existsSync(d)) continue;
  for (const f of fs.readdirSync(d)) {
    const fp = path.join(d, f);
    if (!fs.statSync(fp).isFile()) continue;
    const b = fs.readFileSync(fp).toString('latin1');
    for (const anchor of anchors) {
      let i = b.indexOf(anchor);
      while (i !== -1) {
        let s = i; while (s > 0 && printable(b[s - 1])) s--;
        let e = i; while (e < b.length && printable(b[e])) e++;
        const run = b.slice(s, e);
        if (run.length > 400) {
          console.log(`### ${fp} :: "${anchor}" @${i} run=${s}..${e} len=${run.length}`);
          console.log(JSON.stringify(run.slice(0, 200)));
          console.log('...');
          console.log(JSON.stringify(run.slice(-200)));
          const out = `.data/screenshots/src-${path.basename(fp)}-${anchor.replace(/[^a-z]/gi, '')}.css`;
          fs.writeFileSync(out, run, 'utf8');
          console.log('wrote ' + out);
        }
        i = b.indexOf(anchor, i + 1);
      }
    }
  }
}
