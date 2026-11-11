import fs from 'fs';
import path from 'path';

const html = fs.readFileSync('.data/screenshots/p3000.html', 'utf8');
const dir = 'components/home';
const rows = [];
for (const f of fs.readdirSync(dir)) {
  const src = fs.readFileSync(path.join(dir, f), 'utf8');
  const strings = [...src.matchAll(/>([A-Z][^<>{}"]{18,70})</g)].map((m) => m[1].trim());
  const long = [...src.matchAll(/"([A-Za-z0-9 ,.\-'’&:;()/]{40,110})"/g)].map((m) => m[1]);
  const probes = [...new Set([...strings, ...long])].filter((s) => html.includes(s));
  const first = Math.min(...probes.map((p) => html.indexOf(p)), Infinity);
  rows.push({ comp: f, matched: probes.length, firstIndex: first === Infinity ? -1 : first, sample: probes[0] || '' });
}
rows.sort((a, b) => (a.firstIndex < 0 ? 1e9 : a.firstIndex) - (b.firstIndex < 0 ? 1e9 : b.firstIndex));
for (const r of rows) console.log(`${String(r.firstIndex).padStart(7)}  ${r.comp.padEnd(22)} probes=${r.matched}  "${r.sample.slice(0, 60)}"`);

console.log('\n=== <head> metadata ===');
const head = html.slice(html.indexOf('<head>'), html.indexOf('</head>'));
for (const m of head.matchAll(/<title>([^<]*)<\/title>|<meta name="([^"]*)" content="([^"]*)"|<link rel="([^"]*)" href="([^"]*)"/g)) {
  console.log(m[0].slice(0, 220));
}
