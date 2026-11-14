#!/usr/bin/env node
// Regenerate the committed NPA metadata table from a pinned upstream release.
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TAG = 'v9.0.43';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TIMEZONE_URL = `https://raw.githubusercontent.com/google/libphonenumber/${TAG}/resources/timezones/map_data.txt`;
const GEOCODING_URL = `https://raw.githubusercontent.com/google/libphonenumber/${TAG}/resources/geocoding/en/1.txt`;
const OUTPUT = path.join(ROOT, 'lib/data/npa.ts');
const LAST_REVIEWED = '2026-11-14';

// Document each correction or compatibility alias with the evidence and reason below.
const MANUAL_OVERRIDES = {
  '689': {
    // NANPA's 2026-1 NPA exhaust analysis places 689 in the 321/407/689 Central
    // Florida overlay complex (Orlando area); upstream v9.0.43 says Chicago.
    // Use Eastern time, the zone for the cited Florida rate centers.
    state: 'FL',
    zones: ['America/New_York'],
  },
  '867': {
    // v9.0.43 maps Whitehorse, YT prefixes to America/Vancouver. Yukon now uses
    // UTC-7 year-round, while Vancouver changes clocks; use Whitehorse for that region
    // and retain the upstream zones covering Northwest Territories and Nunavut.
    state: undefined,
    zones: ['America/Edmonton', 'America/Fort_Nelson', 'America/Toronto', 'America/Whitehorse', 'America/Winnipeg'],
  },
  '541': {
    // The pinned source labels eastern Oregon prefixes America/Denver. Preserve the
    // established region-specific America/Boise identifier used by the existing
    // calling-hours case; both zones apply the same Mountain offsets and DST rules.
    state: 'OR',
    zones: ['America/Los_Angeles', 'America/Boise'],
  },
  '879': {
    // CRTC Decision 2023-319 and NANPA PL-622 establish 879 as a Newfoundland and
    // Labrador overlay on 709; the v9.0.43 timezone data incorrectly labels one child
    // prefix America/Puerto_Rico. Match the verified 709 region's two local zones.
    state: 'NL',
    zones: ['America/Halifax', 'America/St_Johns'],
  },
  '907': {
    // v9.0.43 geocoding identifies 1907581 as Unalaska, AK, but its timezone row says
    // Pacific/Honolulu (fixed UTC-10). Unalaska observes AKST/AKDT, so omit fixed Hawaii
    // time and retain the source's Alaska Aleutian, Anchorage, and Juneau zones.
    state: 'AK',
    zones: ['America/Adak', 'America/Anchorage', 'America/Juneau'],
  },
};

const STATE_NAMES = new Map(Object.entries({
  Alabama: 'AL', Alaska: 'AK', Arizona: 'AZ', Arkansas: 'AR', California: 'CA',
  Colorado: 'CO', Connecticut: 'CT', Delaware: 'DE', 'District of Columbia': 'DC',
  Florida: 'FL', Georgia: 'GA', Hawaii: 'HI', Idaho: 'ID', Illinois: 'IL',
  Indiana: 'IN', Iowa: 'IA', Kansas: 'KS', Kentucky: 'KY', Louisiana: 'LA',
  Maine: 'ME', Maryland: 'MD', Massachusetts: 'MA', Michigan: 'MI', Minnesota: 'MN',
  Mississippi: 'MS', Missouri: 'MO', Montana: 'MT', Nebraska: 'NE', Nevada: 'NV',
  'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY',
  'North Carolina': 'NC', 'North Dakota': 'ND', Ohio: 'OH', Oklahoma: 'OK', Oregon: 'OR',
  Pennsylvania: 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC', 'South Dakota': 'SD',
  Tennessee: 'TN', Texas: 'TX', Utah: 'UT', Vermont: 'VT', Virginia: 'VA',
  Washington: 'WA', 'West Virginia': 'WV', Wisconsin: 'WI', Wyoming: 'WY',
  Alberta: 'AB', 'British Columbia': 'BC', Manitoba: 'MB', 'New Brunswick': 'NB',
  'Newfoundland and Labrador': 'NL', Newfoundland: 'NL', Labrador: 'NL',
  'Northwest Territories': 'NT', 'Northwest Territory': 'NT',
  'Nova Scotia': 'NS', Nunavut: 'NU', Ontario: 'ON',
  'Prince Edward Island': 'PE', Quebec: 'QC', Québec: 'QC', Saskatchewan: 'SK',
  Yukon: 'YT', 'Yukon Territory': 'YT',
}));
const POSTAL_CODES = new Set(STATE_NAMES.values());
const ALIASES = new Map([
  ['D.C.', 'DC'], ['Washington DC', 'DC'], ['Washington, DC', 'DC'], ['British Colombia', 'BC'],
  ['N.L.', 'NL'], ['N.W.T.', 'NT'], ['P.E.I.', 'PE'], ['P.E.', 'PE'],
]);
const SHORT_NAME = new Map([...STATE_NAMES].map(([name, code]) => [code, code]));
const COUNTRY_PATTERNS = [
  ['Anguilla', 'Anguilla'], ['Antigua', 'Antigua and Barbuda'], ['Bahamas', 'Bahamas'],
  ['Barbados', 'Barbados'], ['Bermuda', 'Bermuda'], ['British Virgin', 'British Virgin Islands'],
  ['Cayman', 'Cayman Islands'], ['Dominica', 'Dominica'], ['Dominican Republic', 'Dominican Republic'],
  ['Grenada', 'Grenada'], ['Jamaica', 'Jamaica'], ['Montserrat', 'Montserrat'],
  ['Puerto Rico', 'Puerto Rico'], ['Saint Kitts', 'Saint Kitts and Nevis'],
  ['St. Kitts', 'Saint Kitts and Nevis'], ['Saint Lucia', 'Saint Lucia'], ['St. Lucia', 'Saint Lucia'],
  ['Saint Vincent', 'Saint Vincent and the Grenadines'], ['St. Vincent', 'Saint Vincent and the Grenadines'],
  ['Trinidad', 'Trinidad and Tobago'], ['Turks and Caicos', 'Turks and Caicos Islands'],
  ['Virgin Islands', 'U.S. Virgin Islands'],
];
const TOLL_FREE = new Set(['800', '833', '844', '855', '866', '877', '888']);
// NANP area codes for Caribbean countries and US territories; not US state or Canadian
// province/territory calling areas, even when an island's place names lack a country label.
const OUTSIDE_US_CANADA_NPANP = new Map(Object.entries({
  '242': 'Bahamas', '246': 'Barbados', '264': 'Anguilla', '268': 'Antigua and Barbuda',
  '284': 'British Virgin Islands', '340': 'U.S. Virgin Islands', '345': 'Cayman Islands',
  '441': 'Bermuda', '473': 'Grenada', '649': 'Turks and Caicos Islands',
  '658': 'Jamaica', '664': 'Montserrat', '721': 'Sint Maarten', '758': 'Saint Lucia',
  '767': 'Dominica', '784': 'Saint Vincent and the Grenadines', '787': 'Puerto Rico',
  '809': 'Dominican Republic', '829': 'Dominican Republic', '849': 'Dominican Republic',
  '868': 'Trinidad and Tobago', '869': 'Saint Kitts and Nevis', '876': 'Jamaica',
  '939': 'Puerto Rico',
}));
const SKIP_REASON = (npa) => {
  if (TOLL_FREE.has(npa)) return 'toll-free/service NPA';
  if (npa === '500') return 'non-geographic personal communications services NPA';
  if (['600', '700', '900'].includes(npa)) return 'non-geographic/service NPA';
  if (/^[2-9]11$/.test(npa)) return 'N11 service NPA';
  return null;
};

async function download(url) {
  const response = await fetch(url, { headers: { 'User-Agent': 'verifyone-npa-generator' } });
  if (!response.ok) throw new Error(`Download failed (${response.status}): ${url}`);
  return response.text();
}
function parsePipeFile(text) {
  const rows = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue;
    const sep = line.indexOf('|');
    if (sep < 1) continue;
    rows.push([line.slice(0, sep).trim(), line.slice(sep + 1).trim()]);
  }
  return rows;
}
function normalize(text) {
  return text.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]+/g, ' ').trim().toLowerCase();
}
function mappedStates(description) {
  const states = new Set();
  const raw = description.trim();
  const normalized = normalize(raw);
  if ((/\bwashington\b/i.test(raw) && /(?:,\s*|\s)D\.?C\.?$/i.test(raw)) || /\bdistrict of columbia\b/i.test(raw)) {
    return ['DC'];
  }
  const alias = ALIASES.get(raw);
  if (alias) return [alias];

  // Match longest full state/province names first so "West Virginia" cannot
  // also be misread as Virginia. This includes multiword names and territory names.
  let remaining = ` ${normalized} `;
  const namesByLength = [...STATE_NAMES].sort((a, b) => normalize(b[0]).length - normalize(a[0]).length);
  for (const [name, code] of namesByLength) {
    const phrase = normalize(name);
    if (phrase && remaining.includes(` ${phrase} `)) {
      states.add(code);
      remaining = remaining.replaceAll(` ${phrase} `, ' ');
    }
  }
  // libphonenumber sometimes uses a locality followed by a postal abbreviation.
  const suffix = raw.match(/(?:,\s*|\s)([A-Z]{2})\.?$/);
  if (suffix && POSTAL_CODES.has(suffix[1])) states.add(suffix[1]);
  return [...states];
}
function outsideCountry(description) {
  for (const [needle, name] of COUNTRY_PATTERNS) {
    if (normalize(description).includes(normalize(needle))) return name;
  }
  return null;
}
function mostCommonState(rows) {
  const counts = new Map();
  for (const [, description] of rows) {
    for (const state of mappedStates(description)) counts.set(state, (counts.get(state) || 0) + 1);
  }
  const sorted = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return { counts, sorted, winner: sorted[0]?.[0] };
}

const [timezoneText, geocodingText] = await Promise.all([download(TIMEZONE_URL), download(GEOCODING_URL)]);
const timezoneRows = parsePipeFile(timezoneText);
const geocodingRows = parsePipeFile(geocodingText);
const geoByPrefix = new Map();
const timezoneByNpa = new Map();
const areaCodePrefixes = new Set();
for (const [prefix, description] of geocodingRows) {
  if (!/^\d+$/.test(prefix)) continue;
  const row = [prefix, description];
  const current = geoByPrefix.get(prefix) || [];
  current.push(row);
  geoByPrefix.set(prefix, current);
  if (/^1\d{3,}$/.test(prefix)) areaCodePrefixes.add(prefix.slice(1, 4));
}

for (const [prefix, rawZones] of timezoneRows) {
  if (!/^1\d{3,}$/.test(prefix)) continue;
  const npa = prefix.slice(1, 4);
  const zones = rawZones.split('&').map((zone) => zone.trim()).filter((zone) => zone && zone !== 'Etc/Unknown');
  const current = timezoneByNpa.get(npa) || new Set();
  for (const zone of zones) current.add(zone);
  timezoneByNpa.set(npa, current);
  if (prefix.length === 4) areaCodePrefixes.add(npa);
}

const npaTable = new Map();
const unverified = new Set();
const skipped = new Map();
for (const npa of [...areaCodePrefixes].sort()) {
  const zones = [...(timezoneByNpa.get(npa) || [])];
  const reason = SKIP_REASON(npa);
  if (reason) { skipped.set(npa, reason); continue; }
  const outsideRegion = OUTSIDE_US_CANADA_NPANP.get(npa);
  if (outsideRegion) { skipped.set(npa, `outside US/Canada: ${outsideRegion}`); continue; }
  if (!zones.length) { skipped.set(npa, 'no IANA timezone metadata in pinned source'); continue; }

  const npaPrefix = `1${npa}`;
  const exactRows = geoByPrefix.get(npaPrefix) || [];
  const descendantRows = [...geoByPrefix].flatMap(([prefix, rows]) => prefix.startsWith(npaPrefix) ? rows : []);
  const exactStates = new Set(exactRows.flatMap(([, description]) => mappedStates(description)));
  const exactWinner = exactStates.size === 1 ? [...exactStates][0] : null;
  const fallback = mostCommonState(descendantRows);

  let state = exactWinner || fallback.winner;
  let ambiguous = false;
  if (!exactWinner) {
    ambiguous = exactStates.size > 1 || fallback.counts.size > 1;
  } else if (fallback.counts.size > 1 && !exactRows.length) {
    ambiguous = true;
  }

  if (!state) {
    const labels = [...new Set((exactRows.length ? exactRows : descendantRows).map(([, label]) => label))];
    const foreign = labels.map(outsideCountry).find(Boolean);
    if (foreign) { skipped.set(npa, `outside US/Canada: ${foreign}`); continue; }
    unverified.add(npa);
    skipped.set(npa, `no unambiguous US state/Canadian province in geocoding prefixes; omitted pending review${labels.length ? ` (labels: ${labels.slice(0, 4).join(' | ')})` : ' (no geocoding prefixes)'}`);
    continue;
  }
  if (ambiguous) unverified.add(npa);
  const override = MANUAL_OVERRIDES[npa];
  const finalEntry = override ? { state: override.state ?? state, zones: override.zones ?? zones } : { state, zones };
  npaTable.set(npa, { state: finalEntry.state, zones: [...new Set(finalEntry.zones)] });
}

const skippedComments = [...skipped].map(([npa, reason]) => `${npa} (${reason})`);
const entries = [...npaTable].map(([npa, { state, zones }]) =>
  `  '${npa}': { state: '${state}', zones: [${zones.map((zone) => `'${zone}'`).join(', ')}] },`
).join('\n');
const oldPath = path.join(ROOT, 'lib/data/npa.ts');
const oldText = await (await import('node:fs/promises')).readFile(oldPath, 'utf8').catch(() => '');
const output = `/**
 * GENERATED — do not edit by hand; run node apps/verifyone/scripts/generate-npa.mjs
 * Source: Google libphonenumber ${TAG}
 * Time zones: ${TIMEZONE_URL}
 * Geocoding: ${GEOCODING_URL}
 * Generation date: ${new Date().toISOString().slice(0, 10)}
 * Non-geographic/service NPAs skipped: 500, 600, 700, 800, 833, 844, 855, 866, 877, 888, 900, N11 NPAs.
 * Source NPAs skipped: ${skippedComments.join('; ') || 'none'}
 * Split NPAs retain all upstream zones; gate decisions require every zone to be inside the window.
 */
export const LAST_REVIEWED = '${LAST_REVIEWED}';

export const NPA: Record<string, { state: string; zones: string[] }> = {
${entries}
};

// State/province could not be determined unambiguously from the geocoding prefixes.
export const UNVERIFIED_NPAS = [${[...unverified].sort().map((npa) => `'${npa}'`).join(', ')}] as const;
`;
await writeFile(OUTPUT, output, 'utf8');
const oldEntries = new Map([...oldText.matchAll(/^\s*'(\d{3})':\s*\{\s*state:\s*'([^']+)',\s*zones:\s*\[([^\]]*)\]\s*\},?/gm)]
  .map((match) => [match[1], { state: match[2], zones: [...match[3].matchAll(/'([^']+)'/g)].map((zone) => zone[1]) }]));
const added = [...npaTable.keys()].filter((npa) => !oldEntries.has(npa));
const removed = [...oldEntries.keys()].filter((npa) => !npaTable.has(npa));
const changed = [...npaTable].flatMap(([npa, entry]) => {
  const old = oldEntries.get(npa);
  if (!old) return [];
  const oldZones = [...old.zones].sort();
  const newZones = [...entry.zones].sort();
  if (old.state === entry.state && JSON.stringify(oldZones) === JSON.stringify(newZones)) return [];
  return [{ npa, old, generated: entry }];
});
console.log(JSON.stringify({
  tag: TAG,
  count: npaTable.size,
  unverified: [...unverified].sort(),
  added: added.sort(),
  removed: removed.sort().map((npa) => ({ npa, reason: skipped.get(npa) || 'no timezone prefix or no state/province geocoding' })),
  changed,
  skipped: [...skipped].sort(([a], [b]) => a.localeCompare(b)).map(([npa, reason]) => ({ npa, reason })),
  overrides: Object.keys(MANUAL_OVERRIDES),
}, null, 2));
