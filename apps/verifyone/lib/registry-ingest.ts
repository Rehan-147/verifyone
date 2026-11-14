import fs from 'fs/promises';
import path from 'path';
import { maybeReload, persistRegistryMeta, parsePhoneToken } from './compliance-cache';

const DATA = path.join(process.cwd(), '.data');
const DNC_FILE = path.join(DATA, 'dnc-us.txt');
const DNC_CA_FILE = path.join(DATA, 'dnc-ca.txt'); // CRTC Canada National Do Not Call List
const LITIGATOR_FILE = path.join(DATA, 'litigators.txt');

async function downloadToFile(url: string, dest: string, timeoutMs = 120_000) {
  const r = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!r.ok) throw new Error(`download_${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  await fs.mkdir(DATA, { recursive: true });
  await fs.writeFile(dest, buf);
  return { bytes: buf.length, dest };
}

// Area-code-scoped ingest: FTC lets subscribers download per-NPA files, which is the
// scale-safe path (the full registry is hundreds of millions of records). Point
// DNC_REGISTRY_URL at a URL containing '{areacode}' (e.g. a presigned R2/S3 auto
// -refreshed per-area bundle) and set DNC_AREA_CODES to a comma-separated NPA list.
// Without a template, the single full-file ingest is used (dev + small deployments).

async function ingestSingle(url: string, dest: string, append: boolean): Promise<{ bytes: number; dest: string }> {
  const meta = await downloadToFile(url, dest);
  return meta;
}

const DEFAULT_AREA_CODES = [
  // Top-50 outbound-dialing NPAs (agency campaigns concentrate hard here)
  '202','212','213','214','215','216','281','301','303','305','312','313','314','315','323','330','336','346','347','404',
  '407','408','412','415','416','419','424','425','469','470','480','484','502','503','504','512','513','516','517','562',
  '602','614','615','617','619','623','626','630','646','650',
];

export async function ingestDncRegistry() {
  const url = process.env.DNC_REGISTRY_URL?.trim();
  if (!url) return { ok: false as const, reason: 'DNC_REGISTRY_URL_not_set' };
  try {
    if (url.includes('{areacode}')) {
      const listRaw = process.env.DNC_AREA_CODES?.trim();
      const list = (listRaw ? listRaw.split(',').map((s) => s.trim()).filter(/^\d{3}$/.test.bind(/^\d{3}$/)) : DEFAULT_AREA_CODES);
      let bytes = 0; let files = 0; const failed: string[] = [];
      await fs.mkdir(DATA, { recursive: true });
      // start fresh: area files rebuild the picture each run
      await fs.rm(DNC_FILE, { force: true }).catch(() => {});
      for (const areacode of list) {
        try {
          const meta = await downloadToFile(url.replace('{areacode}', areacode), `${DATA}/dnc-${areacode}.txt`, 60_000);
          bytes += meta.bytes; files += 1;
        } catch {
          failed.push(areacode);
        }
      }
      // stitch into one normalized file so compliance-cache keeps a single loader path.
      // Only US per-area temporaries (dnc-<NPA>.txt) are inputs — never dnc-us.txt,
      // the Canadian master dnc-ca.txt, or Canadian per-area temps (dnc-ca-<NPA>.txt).
      const stitched: string[] = [];
      for (const f of await fs.readdir(DATA)) {
        if (!/^dnc-\d{3}\.txt$/.test(f)) continue;
        const content = await fs.readFile(path.join(DATA, f), 'utf8');
        for (const line of content.split('\n')) {
          const t = parsePhoneToken(line);
          if (t) stitched.push(t);
        }
      }
      await fs.writeFile(DNC_FILE, stitched.join('\n') + (stitched.length ? '\n' : ''));
      // clean the per-area temporaries after stitching
      for (const f of await fs.readdir(DATA)) {
        if (/^dnc-\d{3}\.txt$/.test(f)) await fs.rm(path.join(DATA, f), { force: true }).catch(() => {});
      }
      maybeReload();
      const health = persistRegistryMeta();
      return { ok: true as const, bytes, area_codes: files, failed, records: health.dnc.records };
    }
    const meta = await ingestSingle(url, DNC_FILE, false);
    maybeReload();
    const health = persistRegistryMeta();
    return { ok: true as const, bytes: meta.bytes, dest: meta.dest, records: health.dnc.records };
  } catch (e) {
    return { ok: false as const, reason: String((e as Error)?.message || e) };
  }
}

// DEFAULT_CA_AREA_CODES: major Canadian NPAs for the {areacode} template path
// (CRTC DNCL area downloads). Override with DNC_CA_AREA_CODES.
const DEFAULT_CA_AREA_CODES = [
  '204','226','236','250','289','343','403','416','431','438','450','506','514','519','587',
  '604','613','639','647','705','709','778','780','807','819','873','902','905',
];

// CRTC Canada National Do Not Call List (DNCL). Canadian numbers share the +1
// NANP numbering plan with the US, so the gate answers both registries with one
// normalized 10-digit lookup — the receipt tells the caller which registry
// produced the verdict (ftc_registry_cache vs crtc_dncl_cache).
// Access: registrant account with the CRTC DNCL operator; point DNC_CA_REGISTRY_URL
// at the downloaded extract (full-file or a '{areacode}' per-NPA template like the US path).
export async function ingestDncCaRegistry() {
  const url = process.env.DNC_CA_REGISTRY_URL?.trim();
  if (!url) return { ok: false as const, reason: 'DNC_CA_REGISTRY_URL_not_set' };
  try {
    if (url.includes('{areacode}')) {
      const listRaw = process.env.DNC_CA_AREA_CODES?.trim();
      const list = (listRaw ? listRaw.split(',').map((s) => s.trim()).filter(/^\d{3}$/.test.bind(/^\d{3}$/)) : DEFAULT_CA_AREA_CODES);
      let bytes = 0; let files = 0; const failed: string[] = [];
      await fs.mkdir(DATA, { recursive: true });
      // start fresh: per-area files rebuild the Canadian picture each run
      await fs.rm(DNC_CA_FILE, { force: true }).catch(() => {});
      for (const areacode of list) {
        try {
          const meta = await downloadToFile(url.replace('{areacode}', areacode), `${DATA}/dnc-ca-${areacode}.txt`, 60_000);
          bytes += meta.bytes; files += 1;
        } catch {
          failed.push(areacode);
        }
      }
      // stitch only Canadian per-area temps (dnc-ca-<NPA>.txt) into dnc-ca.txt
      const stitched: string[] = [];
      for (const f of await fs.readdir(DATA)) {
        if (!/^dnc-ca-\d{3}\.txt$/.test(f)) continue;
        const content = await fs.readFile(path.join(DATA, f), 'utf8');
        for (const line of content.split('\n')) {
          const t = parsePhoneToken(line);
          if (t) stitched.push(t);
        }
      }
      await fs.writeFile(DNC_CA_FILE, stitched.join('\n') + (stitched.length ? '\n' : ''));
      for (const f of await fs.readdir(DATA)) {
        if (/^dnc-ca-\d{3}\.txt$/.test(f)) await fs.rm(path.join(DATA, f), { force: true }).catch(() => {});
      }
      maybeReload();
      const health = persistRegistryMeta();
      return { ok: true as const, bytes, area_codes: files, failed, records: health.dnc_ca.records };
    }
    const meta = await downloadToFile(url, DNC_CA_FILE);
    maybeReload();
    const health = persistRegistryMeta();
    return { ok: true as const, bytes: meta.bytes, dest: meta.dest, records: health.dnc_ca.records };
  } catch (e) {
    return { ok: false as const, reason: String((e as Error)?.message || e) };
  }
}

export async function ingestLitigatorRegistry() {
  const url = process.env.LITIGATOR_REGISTRY_URL?.trim();
  if (!url) return { ok: false as const, reason: 'LITIGATOR_REGISTRY_URL_not_set' };
  try {
    const meta = await downloadToFile(url, LITIGATOR_FILE);
    maybeReload();
    const health = persistRegistryMeta();
    return { ok: true as const, bytes: meta.bytes, dest: meta.dest, records: health.litigator.records };
  } catch (e) {
    return { ok: false as const, reason: String((e as Error)?.message || e) };
  }
}

export async function ingestAllRegistries() {
  const dnc = await ingestDncRegistry();
  const dncCa = await ingestDncCaRegistry();
  const lit = await ingestLitigatorRegistry();
  maybeReload();
  const health = persistRegistryMeta();
  return { dnc, dnc_ca: dncCa, litigator: lit, health };
}

// Re-export so cron/API callers can sanity-check a file without downloading.
export { parsePhoneToken };
