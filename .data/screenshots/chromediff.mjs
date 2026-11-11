const get = async (u) => (await (await fetch(u)).text());

const slice = (t, open, close) => {
  const i = t.indexOf(open);
  if (i === -1) return '';
  const j = close ? t.indexOf(close, i) : t.indexOf('>', i);
  return t.slice(i, j === -1 ? i + 400 : j);
};
const norm = (s) => s.replace(/<!--.*?-->/g, '').replace(/\s+/g, ' ').replace(/></g, '>\n<').trim();

for (const route of ['/docs', '/pricing', '/tools']) {
  const A = await get('http://127.0.0.1:3000' + route);
  const B = await get('http://127.0.0.1:3021' + route);
  for (const [name, open, close] of [['HEADER', '<header', '</header>'], ['FOOTER', '<footer', '</footer>'], ['BODYHEAD', '<body', '<header']]) {
    const a = norm(slice(A, open, close)), b = norm(slice(B, open, close));
    if (a === b) { console.log(`${route} ${name}: identical (${a.length} chars)`); continue; }
    const la = a.split('\n'), lb = b.split('\n');
    const setB = new Set(lb), setA = new Set(la);
    console.log(`${route} ${name}: DIFF  old=${la.length} lines new=${lb.length} lines`);
    la.filter((l) => !setB.has(l)).slice(0, 6).forEach((l) => console.log('   - ' + l.slice(0, 165)));
    lb.filter((l) => !setA.has(l)).slice(0, 6).forEach((l) => console.log('   + ' + l.slice(0, 165)));
  }
}
