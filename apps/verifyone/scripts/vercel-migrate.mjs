import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
if (process.env.VERCEL_ENV !== 'production' || !process.env.DIRECT_URL) {
  console.log('Skipping migrations: requires VERCEL_ENV=production and DIRECT_URL.');
} else {
  const result = spawnSync(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'deploy'], { stdio: 'inherit', env: process.env });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
}
