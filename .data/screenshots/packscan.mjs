import fs from 'fs';
import path from 'path';

const dirs = [
  '.next/cache/webpack/server-production',
  '.next/cache/webpack/client-production',
  '.next/cache/webpack/edge-server-production',
];
const pats = ['.hero-title{', '.hero-title {', '.eyebrow{', 'ff8318959450c366', '.hero-title'];
const seen = new Set();
for (const d of dirs) {
  if (!fs.existsSync(d)) continue;
  for (const f of fs.readdirSync(d)) {
    const fp = path.join(d, f);
    const stat = fs.statSync(fp);
    if (!stat.isFile()) continue;
    const b = fs.readFileSync(fp).toString('latin1');
    for (const p of pats) {
      const i = b.indexOf(p);
      if (i === -1 || seen.has(p)) continue;
      seen.add(p);
      console.log(`### ${fp} (${(b.length / 1e6).toFixed(1)}MB) :: "${p}" @${i}`);
      console.log(JSON.stringify(b.slice(i, i + 260)));
    }
  }
}
if (!seen.size) console.log('no css rule text found in packs');
