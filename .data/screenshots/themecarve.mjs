import fs from 'node:fs';
import path from 'node:path';

const dirs = [
  'C:/Users/SHAIK MOHAMMAD REHAN/Downloads/verifyone-FINAL-ALL/.next/cache/webpack/client-production',
  'C:/Users/SHAIK MOHAMMAD REHAN/Downloads/verifyone-FINAL-ALL/.next/cache/webpack/server-production',
];

// Maximal printable run around an index, same technique used for recovered.css
function runAt(buf, i) {
  let s = i;
  while (s > 0 && buf[s - 1] >= 0x20 && buf[s - 1] <= 0x7e) s--;
  let e = i;
  while (e < buf.length && buf[e] >= 0x20 && buf[e] <= 0x7e) e++;
  return buf.slice(s, e).toString('latin1');
}

const defs = new Map(); // varName -> Set of "value"
const blocks = new Set();

for (const dir of dirs) {
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.pack'))) {
    const buf = fs.readFileSync(path.join(dir, f));
    let idx = 0;
    while ((idx = buf.indexOf('--theme-', idx + 1)) !== -1) {
      const r = runAt(buf, idx);
      // find the enclosing brace scope: cut at the nearest preceding '}' and following '}'
      const openBrace = r.lastIndexOf('--theme-');
      let scopeStart = r.lastIndexOf('}', idx - s(r, buf));
      blocks.add(trimScope(r));
      for (const m of r.matchAll(/--theme-[a-zA-Z-]+:[^;}]*/g)) {
        const name = m[0].split(':')[0];
        const val = m[0].slice(name.length + 1).trim();
        if (!defs.has(name)) defs.set(name, new Set());
        defs.get(name).add(val);
      }
    }
  }
}

function s() { return 0; }
function trimScope(r) { return r.slice(0, 4000); }

const out = [];
for (const [name, vals] of [...defs].sort()) {
  out.push(name + ' => ' + [...vals].join(' || '));
}
fs.writeFileSync(
  'C:/Users/SHAIK MOHAMMAD REHAN/Downloads/verifyone-FINAL-ALL/.data/screenshots/theme-vars-carved.txt',
  out.join('\n'),
);
console.log(out.join('\n'));
