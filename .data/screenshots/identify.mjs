import fs from 'fs';
import crypto from 'crypto';

const target = 'ff8318959450c366';
const files = fs.readdirSync('.data/screenshots').filter((f) => f.endsWith('.css')).map((f) => '.data/screenshots/' + f);
files.push('.next/static/css/3cda5c5a4a9ec8ea.css');

const md4 = (s) => { try { return crypto.createHash('md4').update(s).digest('hex').slice(0, 16); } catch { return null; } };
const md5 = (s) => crypto.createHash('md5').update(s).digest('hex').slice(0, 16);

for (const f of files) {
  const css = fs.readFileSync(f, 'utf8');
  const count = (re) => (css.match(re) || []).length;
  console.log(
    `${f.split('/').pop().padEnd(42)} size=${String(css.length).padEnd(7)} dp=${count(/--dp-color/g)} brand=${count(/--brand/g)} ink=${count(/--ink-\d/g)} csstabs=${css.includes('.csstabs') ? 1 : 0} tabpanel=${css.includes('.tabpanel') ? 1 : 0} eyebrow=${css.includes('.eyebrow') ? 1 : 0} themePage=${css.includes('--theme-page') ? 1 : 0} md4=${md4(css)} md5=${md5(css)}`
  );
}
console.log('target hash: ' + target);
