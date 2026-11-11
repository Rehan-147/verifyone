const get = async (u) => {
  const t = await (await fetch(u)).text();
  return t
    .slice(t.indexOf('<main'), t.indexOf('</main>'))
    .replace(/<!-- -->/g, '')
    .replace(/class="([^"]*)"/g, (m, c) => `class="${c.split(/\s+/).filter(Boolean).sort().join(' ')}"`)
    .replace(/\s+/g, ' ')
    .replace(/></g, '>\n<');
};

const norm = (s) =>
  s
    .replace(/font-family:var\(--font-display\)/g, 'font-family:&quot;Plus Jakarta Sans&quot;, system-ui, sans-serif')
    .replace(/font-family:var\(--font-mono\)/g, 'ui-monospace, monospace')
    .replace(/font-family:var\(--font-body\)/g, 'font-family:&quot;Plus Jakarta Sans&quot;, system-ui, sans-serif');

const a = norm(await get('http://127.0.0.1:3000/'));
const b = norm(await get('http://127.0.0.1:3021/'));
const la = a.split('\n');
const lb = b.split('\n');
const ca = new Map(), cb = new Map();
la.forEach((l) => ca.set(l, (ca.get(l) || 0) + 1));
lb.forEach((l) => cb.set(l, (cb.get(l) || 0) + 1));
const onlyA = [...ca].filter(([l, n]) => (cb.get(l) || 0) < n);
const onlyB = [...cb].filter(([l, n]) => (ca.get(l) || 0) < n);
console.log(`after font normalisation: lines 3000=${la.length} 3021=${lb.length} | diffs: -${onlyA.length} +${onlyB.length}`);
onlyA.slice(0, 20).forEach(([l]) => console.log('  - ' + l.slice(0, 200)));
onlyB.slice(0, 20).forEach(([l]) => console.log('  + ' + l.slice(0, 200)));
