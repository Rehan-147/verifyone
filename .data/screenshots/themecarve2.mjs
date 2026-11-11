import fs from 'node:fs';
import path from 'node:path';

const base = 'C:/Users/SHAIK MOHAMMAD REHAN/Downloads/verifyone-FINAL-ALL/.next/cache/webpack';
const dirs = ['client-production', 'server-production'];

function printableRuns(buf) {
  const runs = [];
  let i = 0;
  while (i < buf.length) {
    if (buf[i] >= 0x20 && buf[i] <= 0x7e) {
      let s = i;
      while (i < buf.length && buf[i] >= 0x20 && buf[i] <= 0x7e) i++;
      const r = buf.slice(s, i).toString('latin1');
      if (r.includes('--theme-')) runs.push(r);
    } else i++;
  }
  return runs;
}

// naive css rule splitter: selector { body } selector { body } ...
function rulesWithTheme(text) {
  const out = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(text))) {
    if (m[2].includes('--theme-')) {
      out.push({ sel: m[1].trim().replace(/\s+/g, ' ').slice(-160), body: m[2].trim() });
    }
  }
  return out;
}

const seen = new Set();
const lines = [];
for (const d of dirs) {
  const dir = path.join(base, d);
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.pack'))) {
    const p = path.join(dir, f);
    const buf = fs.readFileSync(p);
    const mt = fs.statSync(p).mtime.toISOString();
    for (const run of printableRuns(buf)) {
      for (const r of rulesWithTheme(run)) {
        const key = d + '/' + f + '|' + r.sel + '|' + r.body;
        if (seen.has(key)) continue;
        seen.add(key);
        lines.push(`### ${d}/${f} (mtime ${mt})\nSELECTOR: ${r.sel}\n${r.body}\n`);
      }
    }
  }
}
const dest = 'C:/Users/SHAIK MOHAMMAD REHAN/Downloads/verifyone-FINAL-ALL/.data/screenshots/theme-rules-carved.txt';
fs.writeFileSync(dest, lines.join('\n'));
console.log('rules:', lines.length);
console.log(lines.slice(0, 12).join('\n'));
