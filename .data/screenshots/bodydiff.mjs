const get = async (u) => (await (await fetch(u)).text());
const clean = (t) =>
  t.replace(/<!--.*?-->/g, '').replace(/\/_next\/[^"']*/g, '/ASSET').replace(/\s+/g, ' ').replace(/></g, '>\n<').trim();
for (const r of process.argv.slice(2).map(x => x === 'home' ? '/' : '/' + x)) {
  const A = await get('http://127.0.0.1:3000' + r);
  const B = await get('http://127.0.0.1:3021' + r);
  const a = clean(A.slice(A.indexOf('<body'))).split('\n');
  const b = clean(B.slice(B.indexOf('<body'))).split('\n');
  const setB = new Set(b), setA = new Set(a);
  console.log(`##### ${r}  only-3000=${a.filter((l) => !setB.has(l)).length} only-3021=${b.filter((l) => !setA.has(l)).length}`);
  a.filter((l) => !setB.has(l)).slice(0, 12).forEach((l) => console.log('  - ' + l.slice(0, 150)));
  b.filter((l) => !setA.has(l)).slice(0, 12).forEach((l) => console.log('  + ' + l.slice(0, 150)));
}
