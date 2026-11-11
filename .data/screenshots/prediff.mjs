const get = async (u) => {
  const t = await (await fetch(u)).text();
  return t.slice(t.indexOf('<main'), t.indexOf('</main>'));
};
const A = await get('http://127.0.0.1:3000/');
const B = await get('http://127.0.0.1:3021/');

const grab = (s, needle) => {
  const i = s.indexOf(needle);
  return i === -1 ? null : s.slice(i, i + 900);
};

for (const needle of ['aria-live="polite"', 'curl -X POST', 'claude_desktop_config']) {
  let ia = 0, ib = 0, n = 0;
  while (n < 3) {
    ia = A.indexOf(needle, ia + 1);
    ib = B.indexOf(needle, ib + 1);
    if (ia === -1 || ib === -1) break;
    const a = A.slice(ia, ia + 700);
    const b = B.slice(ib, ib + 700);
    if (a !== b) {
      console.log(`\n##### ${needle} (occ ${n})`);
      for (let k = 0; k < Math.max(a.length, b.length); k++) {
        if (a[k] !== b[k]) {
          console.log('  3000: ...' + a.slice(Math.max(0, k - 60), k + 90).replace(/\s+/g, ' '));
          console.log('  3021: ...' + b.slice(Math.max(0, k - 60), k + 90).replace(/\s+/g, ' '));
          break;
        }
      }
    }
    n++;
  }
}
