import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(here, '../lib/data/npa.ts'), 'utf8');
const failures = [];
function check(name, passed, detail = '') {
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!passed) failures.push(name);
}

const required = `
201 202 203 205 206 207 208 209 210 212 213 214 215 216 217 218 219 224 225 228 229 231
239 240 248 251 252 253 254 256 260 267 269 270 281 301 302 303 304 305 307 309 310 312
313 314 315 316 317 318 319 320 321 323 330 332 334 336 337 339 346 347 351 352 360 361
385 386 401 402 404 405 406 407 408 409 410 412 413 414 415 417 419 423 424 425 432 434
435 440 443 469 470 475 478 479 480 484 501 502 503 504 505 507 508 509 510 512 513 515
516 517 518 520 530 540 541 551 559 561 562 563 567 570 571 573 574 580 585 586 601 602
603 605 606 607 608 609 610 612 614 615 616 617 618 619 620 623 626 628 630 631 636 641
646 650 651 657 660 661 662 669 678 682 701 702 703 704 706 707 708 712 713 714 715 716
717 718 719 720 724 727 731 732 734 737 740 747 754 757 760 763 765 769 770 772 773 774
775 779 781 785 786 801 802 803 804 805 806 808 810 812 813 814 815 816 817 818 828 830
831 832 843 845 847 848 850 856 857 858 859 860 862 863 864 865 870 872 878 901 903 904
906 907 908 909 910 912 913 914 915 916 917 918 919 920 925 928 929 931 936 937 938 940
941 947 949 951 952 954 956 970 971 972 973 978 979 980 984 985 989
204 226 236 250 289 306 343 403 416 418 431 437 438 450 506 514 519 579 581 587 604 613
639 647 705 709 778 780 807 819 825 867 873 902 905`;
const entries = new Map();
for (const match of source.matchAll(/^\s*'(\d{3})':\s*\{\s*state:\s*'([A-Z]{2})',\s*zones:\s*\[([^\]]*)\]\s*\},?/gm)) {
  const [, npa, state, zonesText] = match;
  const zones = [...zonesText.matchAll(/'([^']+)'/g)].map((item) => item[1]);
  if (entries.has(npa)) failures.push(`duplicate NPA ${npa}`);
  entries.set(npa, { state, zones });
}

const requiredCodes = required.trim().split(/\s+/);
const missing = requiredCodes.filter((npa) => !entries.has(npa));
check('all assigned NPAs in the coverage list are present', missing.length === 0, missing.length ? `missing: ${missing.join(', ')}` : `${requiredCodes.length} required codes`);
check('NPA keys are unique', failures.every((failure) => !failure.startsWith('duplicate')), failures.filter((failure) => failure.startsWith('duplicate')).join(', '));

const invalidZones = [];
for (const [npa, entry] of entries) {
  if (!entry.zones.length) failures.push(`NPA ${npa} has no timezone`);
  for (const zone of entry.zones) {
    try { new Intl.DateTimeFormat('en-US', { timeZone: zone }); }
    catch { invalidZones.push(`${npa}:${zone}`); }
  }
}
check('every timezone is a valid IANA zone', invalidZones.length === 0, invalidZones.join(', '));

function hasZones(npa, expected) {
  const zones = entries.get(npa)?.zones || [];
  return expected.every((zone) => zones.includes(zone));
}
check('850 has Central and Eastern zones', hasZones('850', ['America/Chicago', 'America/New_York']));
check('541 has Pacific and Mountain zones', hasZones('541', ['America/Los_Angeles', 'America/Boise']));
check('270 has Central and Eastern zones', hasZones('270', ['America/Chicago', 'America/New_York']));
check('812 has Central and Eastern zones', hasZones('812', ['America/Chicago', 'America/New_York']));
check('915 uses Mountain time', hasZones('915', ['America/Denver']) && entries.get('915')?.zones.length === 1);
check('Florida, Oklahoma and Washington NPAs map to their states',
  entries.get('305')?.state === 'FL' && entries.get('405')?.state === 'OK' && entries.get('206')?.state === 'WA');
check('known upstream timezone corrections are preserved',
  entries.get('689')?.state === 'FL' && hasZones('689', ['America/New_York']) &&
  hasZones('867', ['America/Whitehorse']) && !entries.get('867')?.zones.includes('America/Vancouver') &&
  hasZones('907', ['America/Adak', 'America/Anchorage', 'America/Juneau']) &&
  !entries.get('907')?.zones.includes('Pacific/Honolulu') &&
  hasZones('879', ['America/Halifax', 'America/St_Johns']));
check('999 remains unassigned for the timezone review test', !entries.has('999'));
check('generated header includes a pinned libphonenumber tag', /Google libphonenumber v\d+\.\d+\.\d+/.test(source));
check('LAST_REVIEWED is preserved', /LAST_REVIEWED = '2026-11-14'/.test(source));

if (failures.length) process.exit(1);
