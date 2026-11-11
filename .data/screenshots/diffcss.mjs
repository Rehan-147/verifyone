import fs from 'fs';

function selectors(file) {
  const css = fs.readFileSync(file, 'utf8');
  const out = [];
  let depth = 0, buf = '';
  for (const ch of css) {
    buf += ch;
    if (ch === '{') depth++;
    else if (ch === '}') { if (depth === 1) out.push(buf.trim()); buf = depth > 0 ? '' : buf; depth = Math.max(0, depth - 1); }
  }
  return out.filter(Boolean);
}

const a = selectors('.data/screenshots/recovered.css');
const b = selectors('.next/static/css/3cda5c5a4a9ec8ea.css');
const setB = new Set(b.map((r) => r.slice(0, r.indexOf('{')).trim()));
const setA = new Set(a.map((r) => r.slice(0, r.indexOf('{')).trim()));

const onlyOld = a.filter((r) => !setB.has(r.slice(0, r.indexOf('{')).trim()));
const onlyNew = b.filter((r) => !setA.has(r.slice(0, r.indexOf('{')).trim()));
console.log(`old rules: ${a.length}  new rules: ${b.length}  only-in-gate-era: ${onlyOld.length}  only-in-current: ${onlyNew.length}`);
console.log('\n=== ONLY IN GATE-ERA (lost) ===');
onlyOld.forEach((r) => console.log(r.slice(0, 240)));
console.log('\n=== ONLY IN CURRENT (added) ===');
onlyNew.slice(0, 40).forEach((r) => console.log(r.slice(0, 200)));
