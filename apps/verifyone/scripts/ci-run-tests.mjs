import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { cp, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import net from 'node:net';

const require = createRequire(import.meta.url);
const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.resolve(app, '../..');

const LOCAL_DB_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);
function assertLocalDbUrl(label, raw) {
  let host;
  try {
    host = new URL(raw).hostname.replace(/^\[|\]$/g, '').toLowerCase();
  } catch {
    console.error(`Refusing to run CI tests: ${label} is not a valid URL.`);
    process.exit(1);
  }
  if (!LOCAL_DB_HOSTS.has(host)) {
    console.error(
      `Refusing to run CI tests against remote ${label} host "${host}". ` +
      `Use localhost/127.0.0.1/::1 or set VERIFYONE_ALLOW_REMOTE_TEST_DB=1 explicitly.`,
    );
    process.exit(1);
  }
}

// Decide mode from the runner's own environment before any child process loads .env.
const dbMode = Boolean(process.env.DATABASE_URL);
if (dbMode && process.env.VERIFYONE_ALLOW_REMOTE_TEST_DB !== '1') {
  assertLocalDbUrl('DATABASE_URL', process.env.DATABASE_URL);
  if (process.env.DIRECT_URL) assertLocalDbUrl('DIRECT_URL', process.env.DIRECT_URL);
}

const children = new Set();
const results = [];
let sandbox;
let cleaning;
async function cleanup() {
  if (cleaning) return cleaning;
  cleaning = (async () => {
    for (const child of children) {
      if ((child.exitCode !== null || child.signalCode !== null)) continue;
      if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
      else { try { process.kill(-child.pid, 'SIGKILL'); } catch {} }
    }
    await Promise.all([...children].map(child => (child.exitCode !== null || child.signalCode !== null) ? null : new Promise(resolve => child.once('exit', resolve))));
    if (sandbox) await rm(sandbox, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
  })();
  return cleaning;
}
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => { await cleanup(); process.exit(1); });
function start(args, env, cwd) {
  const child = spawn(process.execPath, args, { cwd, env, stdio: 'inherit', detached: process.platform !== 'win32' });
  children.add(child);
  child.on('error', error => console.error(error));
  return child;
}
async function freePort(port) {
  await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(port, () => server.close(resolve));
  });
}
try {
  const coverageStarted = Date.now();
  const coverage = start([path.join(app, 'scripts/test-npa-coverage.mjs')], process.env, app);
  const coverageCode = await new Promise(resolve => { coverage.once('exit', code => resolve(code ?? 1)); coverage.once('error', () => resolve(1)); });
  results.push({ suite: 'test-npa-coverage', status: coverageCode === 0 ? 'PASS' : 'FAIL', seconds: ((Date.now() - coverageStarted) / 1000).toFixed(1) });

  await freePort(3200);
  await freePort(3999);
  // Run a disposable app copy: local credentials, registries, ledgers and Next output stay untouched.
  sandbox = await mkdtemp(path.join(root, '.ci-run-'));
  await cp(app, sandbox, { recursive: true, filter: source => {
    const name = path.basename(source);
    return !['node_modules', '.next', '.data', '.git'].includes(name) && !name.startsWith('.env');
  } });
  const env = { ...process.env, NODE_ENV: 'development', VERIFYONE_CREDENTIALS_KEY: randomBytes(32).toString('base64'),
    VERIFYONE_TEST_HOOKS: '1',
    VAPI_API_BASE: 'http://localhost:3999', RETELL_API_BASE: 'http://localhost:3999',
    BASE_URL: 'http://localhost:3200', MOCK_URL: 'http://localhost:3999',
    DB_MODE: dbMode ? '1' : '0', NEXT_TELEMETRY_DISABLED: '1' };
  if (!dbMode) {
    env.VERIFYONE_FORCE_FILE_MODE = '1';
    delete env.DATABASE_URL;
    delete env.DIRECT_URL;
  }
  const mock = start([path.join(app, 'scripts/mock-voice-platform.mjs')], { ...env, PORT: '3999' }, sandbox);
  const next = start([require.resolve('next/dist/bin/next'), 'dev', '-p', '3200'], env, sandbox);
  const deadline = Date.now() + 180000;
  let ready = false;
  while (Date.now() < deadline) {
    if (mock.exitCode !== null || mock.signalCode !== null || next.exitCode !== null || next.signalCode !== null) throw new Error('Server exited before readiness');
    try {
      const response = await fetch(env.BASE_URL + '/api/v1/registry-health', { signal: AbortSignal.timeout(3000) });
      if (response.status === 200) { ready = true; break; }
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  if (!ready) throw new Error('Readiness timed out after 180 seconds');

  const sanityRes = await fetch(env.BASE_URL + '/api/v1/gate/phone', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '+12125550100', consent: { declared: true, type: 'express_written' } }),
    signal: AbortSignal.timeout(5000),
  });
  const sanityJson = await sanityRes.json().catch(() => ({}));
  const persistence = sanityJson?.audit?.persistence;
  if (dbMode) {
    if (persistence !== 'postgres') throw new Error(`Sanity check failed in DB mode: expected audit.persistence="postgres", got ${JSON.stringify(persistence)}`);
  } else if (persistence !== 'file' && persistence !== 'memory') {
    throw new Error(`Sanity check failed in file mode: expected audit.persistence="file"|"memory", got ${JSON.stringify(persistence)}`);
  }
  console.log(`Sanity check PASS: audit.persistence=${persistence} (mode=${dbMode ? 'postgres' : 'file'})`);

  for (const suite of ['test-quota', 'test-credits', 'test-dial', 'test-calling-hours', 'test-bulk', 'test-org-keys', 'test-suppression', 'test-reviews', 'test-frequency', 'test-scan', 'chain-concurrency']) {
    const started = Date.now();
    const child = start([path.join(app, 'scripts', suite + '.mjs')], env, sandbox);
    const code = await new Promise(resolve => { child.once('exit', code => resolve(code ?? 1)); child.once('error', () => resolve(1)); });
    results.push({ suite, status: code === 0 ? 'PASS' : 'FAIL', seconds: ((Date.now() - started) / 1000).toFixed(1) });
  }
  process.exitCode = results.some(result => result.status === 'FAIL') ? 1 : 0;
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  console.table(results);
  await cleanup();
}
