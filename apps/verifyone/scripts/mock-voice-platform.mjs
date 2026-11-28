import http from 'node:http';

let sequence = 0;
const calls = [];
const checkouts = [];
const server = http.createServer(async (req, res) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (req.method === 'GET' && req.url === '/__calls') {
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ calls }));
  }
  // Mock Dodo Payments checkout (DODO_API_BASE points here in tests).
  if (req.method === 'GET' && req.url === '/__checkouts') {
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ checkouts }));
  }
  if (req.method === 'POST' && req.url === '/checkouts') {
    const body = (() => { try { return JSON.parse(raw); } catch { return null; } })();
    checkouts.push({ authorization_last4: (req.headers.authorization || '').slice(-4), body });
    const id = `cks_mock_${checkouts.length}`;
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ session_id: id, checkout_url: `https://checkout.mock/${id}` }));
  }
  const platform = req.url === '/call' ? 'vapi' : req.url === '/v2/create-phone-call' ? 'retell' : null;
  if (req.method !== 'POST' || !platform) {
    res.writeHead(404, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ error: 'not_found' }));
  }
  const authorization = req.headers.authorization || '';
  calls.push({
    platform,
    authorization_last4: authorization.slice(-4),
    body: (() => { try { return JSON.parse(raw); } catch { return null; } })(),
  });
  sequence += 1;
  const id = `mock_call_${sequence}`;
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify(platform === 'vapi' ? { id } : { call_id: id }));
});

server.listen(Number(process.env.PORT || 3999), '127.0.0.1', () => {
  console.log(`Mock voice platform listening on ${server.address().port}`);
});
