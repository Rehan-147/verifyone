// Vendoring step: copy the prebuilt theme CSS out of the npm tarball of
// @astryxdesign/theme-neutral (MIT — Meta Platforms) into vendor/design-system/,
// with an attribution header prepended. Idempotent — re-running overwrites.
//
// Prerequisite: npm pack @astryxdesign/theme-neutral@0.7.12, then
//   tar -xzf astryxdesign-theme-neutral-0.7.12.tgz -C .tmp-astryx
// Run from the project root:  node scripts/vendor-astryx-theme.mjs
import fs from 'node:fs';
import path from 'node:path';

const SRC = path.join('.tmp-astryx', 'package', 'dist', 'theme.css');
const OUT_DIR = path.join('vendor', 'design-system');
const OUT = path.join(OUT_DIR, 'astryx-neutral-theme.css');
const LICENSE_SRC = path.join('.tmp-astryx', 'package', 'LICENSE');
const LICENSE_OUT = path.join(OUT_DIR, 'astryx-neutral.LICENSE');

const header = [
  '/*',
  ' * VENDORED DESIGN SYSTEM TOKENS — @astryxdesign/theme-neutral@0.7.12',
  ' * dist/theme.css as published to npm; verbatim bytes below this header.',
  ' * Source: https://github.com/meta/astryx (packages/themes/neutral)',
  ' * MIT License — Copyright (c) Meta Platforms, Inc. and affiliates.',
  ' * See astryx-neutral.LICENSE beside this file.',
  ' *',
  ' * Vendored via "npm pack @astryxdesign/theme-neutral@0.7.12" (reproducible',
  ' * with scripts/vendor-astryx-theme.mjs). Why vendored: the @astryxdesign/core',
  ' * React component package has a react>=19 peer dependency while VerifyOne',
  ' * runs React 18, so only this prebuilt CSS is consumed — the documented',
  ' * non-StyleX integration path for plain-CSS/Tailwind apps.',
  ' *',
  ' * These variables are inert until an element with data-astryx-theme="neutral"',
  ' * wraps them (the file gates its tokens behind @scope). VerifyOne maps its',
  ' * Tailwind + CSS custom-property tokens to the LIGHT values resolved from',
  ' * this file (tailwind.config.js + the light :root blocks in app/globals.css;',
  ' * provenance notes in README section 7).',
  ' * Deviations: fonts stay Plus Jakarta Sans / IBM Plex (not Figtree), and the',
  ' * action color uses the theme blue ramp (--color-info / --color-text-info)',
  ' * instead of the verbatim monochrome neutral accent.',
  ' */',
  '',
].join('\n');

const css = fs.readFileSync(SRC, 'utf8');
fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT, header + css);
fs.copyFileSync(LICENSE_SRC, LICENSE_OUT);
const bytes = fs.statSync(OUT).size;
const head = fs.readFileSync(OUT).subarray(0, 3);
console.log('wrote', OUT, '=>', bytes, 'bytes; BOM:', head[0] === 0xef && head[1] === 0xbb && head[2] === 0xbf);
console.log('wrote', LICENSE_OUT, '=>', fs.statSync(LICENSE_OUT).size, 'bytes');
