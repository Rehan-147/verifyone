import fs from 'fs';
import path from 'path';

const dirs = [
  '.next/cache/webpack/client-production',
  '.next/cache/webpack/server-production',
  '.next/cache/webpack/edge-server-production',
];
const anchors = ['--theme-surface-translucent', '.skip-link{', '--theme-text-primary'];
const printable = (ch) => ch.charCodeAt(0) >= 0x20 && ch.charCodeAt(0) <= 0x7e;
const found = new Map();

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
        if (len > 1200) {
          const key = `${a}|${len}`;
          if (!found.has(key)) {
            found.set(key, fp);
            const out = `.data/screenshots/cand-${a.replace(/[^a-z]/gi, '')}-${len}.css`;
            fs.writeFileSync(out, b.slice(s, e), 'utf8');
            const css = b.slice(s, e);
            console.log(`${out}  from ${fp}`);
            console.log(`   dp=${(css.match(/--dp-color/g) || []).length} theme=${(css.match(/--theme-/g) || []).length} brand=${(css.match(/--brand/g) || []).length} jakarta=${css.includes('Plus Jakarta') ? 1 : 0} plex=${css.includes('IBM Plex') ? 1 : 0} instrument=${css.includes('Instrument Sans') ? 1 : 0} host=${css.includes('Host Grotesk') ? 1 : 0}`);
          }
        }
        i = b.indexOf(a, i + 1);
      }
    }
  }
}
if (!found.size) console.log('no candidate blob found');
