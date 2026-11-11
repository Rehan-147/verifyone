import fs from 'node:fs';
import path from 'node:path';

const base = 'C:/Users/SHAIK MOHAMMAD REHAN/Downloads/verifyone-FINAL-ALL/.next/cache/webpack';
const targets = process.argv.slice(2);

function runs(buf) {
  const out = [];
  let i = 0;
  while (i < buf.length) {
    if (buf[i] >= 0x20 && buf[i] <= 0x7e) {
      const s = i;
      while (i < buf.length && buf[i] >= 0x20 && buf[i] <= 0x7e) i++;
      out.push([s, buf.slice(s, i).toString('latin1')]);
    } else i++;
  }
  return out;
}

const found = new Map();
for (const d of ['client-production', 'server-production']) {
  const dir = path.join(base, d);
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.pack'))) {
    const buf = fs.readFileSync(path.join(dir, f));
    for (const [off, run] of runs(buf)) {
      for (const t of targets) {
        if (!run.includes(t)) continue;
        // pull every complete rule whose selector mentions the target
        const re = /([^{}]{0,300}?)\{([^{}]{0,900}?)\}/g;
        let m;
        while ((m = re.exec(run))) {
          if (!m[1].includes(t)) continue;
          const sel = m[1].trim().replace(/\s+/g, ' ');
          const key = sel + '{' + m[2].trim() + '}';
          if (!found.has(key)) found.set(key, `${d}/${f}@${off + m.index}`);
        }
      }
    }
  }
}
const lines = [...found.entries()].map(([k, where]) => `${k}   /* ${where} */`);
console.log(lines.join('\n') || 'no rules found');
