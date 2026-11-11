import fs from 'fs';

const css = fs.readFileSync('.data/screenshots/recovered.css', 'utf8');
const rules = [];
let depth = 0, buf = '';
for (const ch of css) {
  buf += ch;
  if (ch === '{') depth++;
  else if (ch === '}') { if (depth === 1) rules.push(buf.trim()); buf = depth > 0 ? '' : buf; depth = Math.max(0, depth - 1); }
}
const sel = (r) => r.slice(0, r.indexOf('{')).trim();
const body = (r) => r.slice(r.indexOf('{') + 1, -1).trim();

const isUtility = (s) => /\\:|^\*|^[a-z]+\\\\/.test(s);
const custom = rules.filter((r) => !isUtility(sel(r)) && !body(r).includes('--tw-'));
console.log('non-utility rules: ' + custom.length);
custom.forEach((r) => console.log(r.slice(0, 300)));
