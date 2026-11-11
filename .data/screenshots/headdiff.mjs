const get = async (u) => (await (await fetch(u)).text());

const clean = (t) =>
  t
    .replace(/<!--.*?-->/g, '')
    .replace(/\/_next\/[^"']*/g, '/ASSET')
    .replace(/<script[^>]*><\/script>/g, '')
    .replace(/\s+/g, ' ')
    .replace(/></g, '>\n<')
    .trim();

const routes = [
  '/',
  '/docs',
  '/pricing',
  '/security',
  '/legal/terms',
  '/for-agents',
  '/for-platforms',
  '/tools',
  '/status',
  '/integrations',
  '/compare/twilio',
];

const sliceHead = (t) => {
  const i = t.indexOf('<head');
  const j = t.indexOf('</head>', i);
  return clean(t.slice(i, j));
};

let allSame = true;
for (const r of routes) {
  const A = await get('http://127.0.0.1:3000' + r);
  const B = await get('http://127.0.0.1:3021' + r);
  const a = sliceHead(A), b = sliceHead(B);
  const la = a.split('\n'), lb = b.split('\n');
  const setB = new Set(lb), setA = new Set(la);
  const only3000 = la.filter((l) => !setB.has(l));
  const only3021 = lb.filter((l) => !setA.has(l));
  if (!only3000.length && !only3021.length) {
    console.log(`${r} HEAD: identical (${la.length} lines)`);
    continue;
  }
  allSame = false;
  console.log(`${r} HEAD: DIFF`);
  only3000.slice(0, 8).forEach((l) => console.log('   - ' + l.slice(0, 200)));
  only3021.slice(0, 8).forEach((l) => console.log('   + ' + l.slice(0, 200)));
}
console.log(allSame ? '\nALL HEADS MATCH' : '\nhead deltas above');

// whole-page body line counts, as a coarse fidelity signal
for (const r of routes) {
  const A = await get('http://127.0.0.1:3000' + r);
  const B = await get('http://127.0.0.1:3021' + r);
  const body = (t) => clean(t.slice(t.indexOf('<body')));
  const a = body(A).split('\n'), b = body(B).split('\n');
  const setB = new Set(b);
  const diff = a.filter((l) => !setB.has(l)).length;
  console.log(`${r}\t3000=${a.length} lines\t3021=${b.length} lines\tmissing-in-3021=${diff}`);
}
