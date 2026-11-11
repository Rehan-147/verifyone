import fs from 'node:fs';
import path from 'node:path';

const root = 'C:/Users/SHAIK MOHAMMAD REHAN/Downloads/verifyone-FINAL-ALL';
const css = fs.readFileSync(path.join(root, 'app/globals.css'), 'utf8');

const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.next' || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(tsx|ts)$/.test(e.name)) files.push(p);
  }
})(path.join(root, 'components'));
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.next' || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(tsx|ts)$/.test(e.name)) files.push(p);
  }
})(path.join(root, 'app'));

// tokens that Tailwind can generate — heuristic prefix list from this project's config usage
const tw =
  /^(text-|bg-|border-|rounded|p-|px-|py-|pt-|pb-|pl-|pr-|m-|mx-|my-|mt-|mb-|ml-|mr-|space-|flex|grid|gap-|w-|h-|min-|max-|leading-|tracking-|font-|shadow|opacity|transition|duration|ease|hover:|focus|active:|sm:|md:|lg:|xl:|2xl:|hidden|block|inline|absolute|relative|sticky|top-|left-|right-|bottom-|inset|z-|overflow|truncate|whitespace|break-|divide|col-|row-|items-|justify|content-|self-|place-|object-|cursor|select-|pointer|uppercase|lowercase|capitalize|italic|underline|antialiased|list-|ring|outline|from-|to-|via-|backdrop|animate|aspect|order|first:|last:|even|odd|group|peer|sr-only|not-|size-)/;

const used = new Map(); // class -> Set(files)
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  for (const m of src.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\}|\{'([^']*)'\}|\{"([^"]*)"\})/g)) {
    const raw = (m[1] || m[2] || m[3] || m[4] || '').replace(/\$\{[^}]*\}/g, ' ');
    for (const tok of raw.split(/\s+/)) {
      if (!tok || /[^a-zA-Z0-9_:.\-\[\]]/.test(tok)) continue;
      if (tw.test(tok)) continue;
      if (!used.has(tok)) used.set(tok, new Set());
      used.get(tok).add(path.relative(root, f));
    }
  }
}

const missing = [];
for (const [cls, fs_] of [...used].sort()) {
  const esc = cls.replace(/[.\[\]]/g, (c) => '\\' + c);
  const hasRule = new RegExp('\\.' + esc + '(?![\\w-])').test(css);
  if (!hasRule) missing.push(`${cls}  <- ${[...fs_].slice(0, 3).join(', ')}`);
}
console.log('custom classes used:', used.size, '| with no rule in globals.css:', missing.length);
console.log(missing.join('\n'));
