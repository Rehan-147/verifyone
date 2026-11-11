import fs from 'fs';

const html = fs.readFileSync('.data/screenshots/p3000.html', 'utf8');
const classes = new Set();
for (const m of html.matchAll(/class="([^"]*)"/g)) m[1].split(/\s+/).filter(Boolean).forEach((c) => classes.add(c));
const custom = [...classes].filter((c) => !/^(sm|md|lg|xl|2xl):/.test(c));

const esc = (c) => c.replace(/([.:\/\[\]()#%,&*>~'"|+=!^${}])/g, '\\$1');
const cands = fs.readdirSync('.data/screenshots').filter((f) => f.startsWith('pal-') || f === 'recovered.css').map((f) => '.data/screenshots/' + f);

for (const f of cands) {
  const css = fs.readFileSync(f, 'utf8');
  const missing = custom.filter((c) => !css.includes('.' + esc(c) + '{') && !css.includes('.' + esc(c) + ':') && !css.includes('.' + esc(c) + ',') && !css.includes('.' + esc(c) + ' '));
  const keys = ['skip-link', 'hero-wrap', 'hero-title', 'landing-section-title', 'section-lede', 'tabpanel', 'csstabs', 'decision-allow']
    .map((k) => `${k}=${css.includes('.' + k) ? 1 : 0}`).join(' ');
  console.log(`${f.padEnd(52)} size=${String(css.length).padEnd(7)} missing=${String(missing.length).padStart(3)}/${custom.length}  ${keys}`);
  if (missing.length && missing.length < 26) console.log('     missing: ' + missing.slice(0, 25).join(', '));
}
