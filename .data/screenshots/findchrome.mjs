import fs from 'fs';
import path from 'path';

const dirs = fs.readdirSync('.next/cache/webpack').map((d) => '.next/cache/webpack/' + d);
const anchors = ['Switch to dark theme', '--theme-surface-translucent', 'For AI platforms', 'Skip to content', 'application/ld+json'];
const printable = (ch) => ch.charCodeAt(0) >= 0x20 && ch.charCodeAt(0) <= 0x7e;

for (const d of dirs) {
  for (const f of fs.readdirSync(d)) {
    const fp = path.join(d, f);
    if (!fs.statSync(fp).isFile()) continue;
    const b = fs.readFileSync(fp).toString('latin1');
    const hits = anchors.map((a) => (b.includes(a) ? 1 : 0)).join('');
    if (/1/.test(hits)) {
      const i = b.indexOf('--theme-surface-translucent');
      let ctx = '';
      if (i !== -1) {
        let s = i; while (s > 0 && printable(b[s - 1])) s--;
        ctx = b.slice(Math.max(s, i - 200), i + 200);
      }
      console.log(`${fp} hits[${anchors.map((a, k) => a.split(' ')[0] + '=' + hits[k]).join(' ')}] size=${(b.length / 1e6).toFixed(1)}MB`);
      if (ctx) console.log('   ' + JSON.stringify(ctx.slice(0, 240)));
    }
  }
}
