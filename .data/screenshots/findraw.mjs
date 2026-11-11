import fs from 'fs';
import path from 'path';

const dirs = ['.next/cache/webpack/client-production', '.next/cache/webpack/server-production', '.next/cache/webpack/edge-server-production'];
const anchors = ['--theme-text-primary: #', '--theme-border: #', '--theme-text-primary:#', ':root {\n    --theme'];
const printable = (ch) => ch.charCodeAt(0) >= 0x20 && ch.charCodeAt(0) <= 0x7e;
const seen = new Set();

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
        const run = b.slice(s, e);
        const key = a + run.length;
        if (run.length > 500 && !seen.has(key)) {
          seen.add(key);
          const out = `.data/screenshots/raw-${path.basename(fp)}-${anchors.indexOf(a)}.txt`;
          fs.writeFileSync(out, run, 'utf8');
          console.log(`${out} len=${run.length} from ${fp} anchor=${JSON.stringify(a)}`);
          console.log('   ' + JSON.stringify(run.slice(0, 260)));
        }
        i = b.indexOf(a, i + 1);
      }
    }
  }
}
if (!seen.size) console.log('none');
