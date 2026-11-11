const get = async (u) => (await (await fetch(u)).text());
const A = await get('http://127.0.0.1:3000/');
const B = await get('http://127.0.0.1:3021/');
const pres = (t) => [...t.matchAll(/<pre aria-live="polite">([\s\S]*?)<\/pre>/g)].map((m) => m[1]);
const pa = pres(A), pb = pres(B);
console.log('count', pa.length, pb.length);
for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
  if (pa[i] === pb[i]) { console.log(`pre[${i}] identical`); continue; }
  const la = (pa[i] || '').split('\n'), lb = (pb[i] || '').split('\n');
  console.log(`pre[${i}] DIFF`);
  la.forEach((l, j) => { if (l !== lb[j]) console.log('   - ' + l + '\n   + ' + (lb[j] || '')); });
}
