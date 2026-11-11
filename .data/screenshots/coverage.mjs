import fs from 'fs';
import path from 'path';

const css = fs.readFileSync('.data/screenshots/recovered.css', 'utf8');
const esc = (c) => c.replace(/([.:\/\[\]()#%,&*>~'"|+=!^${}])/g, '\\$1');
const has = (c) => css.includes('.' + esc(c) + '{') || css.includes('.' + esc(c) + ':') || css.includes('.' + esc(c) + ',');

const files = [];
const walk = (d) => {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    const s = fs.statSync(p);
    if (s.isDirectory()) { if (f !== 'node_modules' && f !== '.next' && f !== '.data') walk(p); }
    else if (/\.(tsx|ts)$/.test(f) && !/_\d\./.test(f)) files.push(p);
  }
};
walk('app'); walk('components');

const missing = new Map();
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  const toks = new Set();
  for (const m of src.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\}|\{'([^']*)'\})/g)) {
    const raw = (m[1] || m[2] || m[3] || '').replace(/\$\{[^}]*\}/g, ' ');
    raw.split(/\s+/).forEach((t) => { if (/^[a-z-]/i.test(t) && t.length > 1) toks.add(t); });
  }
  for (const t of toks) {
    if (!has(t)) missing.set(t, (missing.get(t) || 0) + 1);
    if (!missing.has(t + ' [file]')) { }
  }
}
const list = [...missing.entries()].sort((a, b) => b[1] - a[1]);
console.log('distinct class tokens missing from recovered css: ' + list.length);
console.log(list.map((e) => e[0]).join(' | '));
