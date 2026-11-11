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

const dp = rules.filter((r) => body(r).includes('--dp-'));
console.log('total rules: ' + rules.length + ' | rules using --dp- tokens: ' + dp.length);
console.log('--- custom rules (use design tokens) ---');
dp.forEach((r) => console.log(r));
console.log('--- selectors containing :root or @layer ---');
rules.filter((r) => sel(r) === ':root' || r.startsWith('@')).forEach((r) => console.log(r.slice(0, 400)));
