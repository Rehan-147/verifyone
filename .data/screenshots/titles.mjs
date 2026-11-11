const routes = ['/', '/docs', '/pricing', '/security', '/legal/terms', '/for-agents', '/for-platforms', '/tools', '/status', '/integrations', '/compare/twilio', '/tools/free-ip-lookup'];
const grab = async (base, r) => {
  const t = await (await fetch(base + r)).text();
  const title = (t.match(/<title>(.*?)<\/title>/s) || [, ''])[1];
  const canon = (t.match(/rel="canonical" href="([^"]*)"/) || [, ''])[1];
  const robots = (t.match(/name="robots" content="([^"]*)"/) || [, ''])[1];
  return `${title}\t| canon=${canon}\t| robots=${robots}`;
};
for (const r of routes) {
  const a = await grab('http://127.0.0.1:3000', r);
  const b = await grab('http://127.0.0.1:3021', r);
  console.log(`### ${r}\n  3000: ${a}\n  3021: ${b}${a === b ? '   [MATCH]' : ''}`);
}
