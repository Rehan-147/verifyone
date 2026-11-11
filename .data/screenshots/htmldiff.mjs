const get = async (u) => {
  const t = await (await fetch(u)).text();
  const s = t.indexOf('<main');
  const e = t.indexOf('</main>');
  return t
    .slice(s, e)
    .replace(/<!-- -->/g, '')
    .replace(/class="([^"]*)"/g, (m, c) => `class="${c.split(/\s+/).filter(Boolean).sort().join(' ')}"`)
    .replace(/\s+/g, ' ')
    .replace(/></g, '>\n<');
};

const a = (await get('http://127.0.0.1:3000/')).split('\n');
const b = (await get('http://127.0.0.1:3021/')).split('\n');
console.log(`lines: 3000=${a.length} 3021=${b.length}`);

const setB = new Map();
b.forEach((l) => setB.set(l, (setB.get(l) || 0) + 1));
const setA = new Map();
a.forEach((l) => setA.set(l, (setA.get(l) || 0) + 1));

const onlyA = a.filter((l) => (setB.get(l) || 0) < (setA.get(l) || 0));
const onlyB = b.filter((l) => (setA.get(l) || 0) < (setB.get(l) || 0));
console.log(`\nlines only in 3000 (${onlyA.length}):`);
[...new Set(onlyA)].slice(0, 25).forEach((l) => console.log('  - ' + l.slice(0, 190)));
console.log(`\nlines only in 3021 (${onlyB.length}):`);
[...new Set(onlyB)].slice(0, 25).forEach((l) => console.log('  + ' + l.slice(0, 190)));
