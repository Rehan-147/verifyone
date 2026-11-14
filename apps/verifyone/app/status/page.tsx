import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'API Status',
  description: 'VerifyOne API status: gate endpoints, MCP endpoint, and data-source receipts.',
  alternates: { canonical: 'https://app.verifyone.io/status' },
};

// Neutral status page. It describes what is implemented in this deployment and
// links to the live machine-readable endpoints — it does not fabricate uptime
// percentages or history.
const ENDPOINTS: { name: string; path: string; status: string }[] = [
  { name: 'Pre-dial phone gate', path: '/api/v1/gate/phone', status: 'Live' },
  { name: 'Batch pre-screening', path: '/api/v1/gate/batch', status: 'Live' },
  { name: 'Pre-send email gate', path: '/api/v1/gate/email', status: 'Live' },
  { name: 'MCP server', path: '/api/mcp', status: 'Live' },
  { name: 'Vapi inbound screening webhook', path: '/api/webhooks/vapi', status: 'Beta' },
  { name: 'Retell inbound screening webhook', path: '/api/webhooks/retell', status: 'Beta' },
  { name: 'Audit chain verification', path: '/api/v1/gate/audit/chain', status: 'Live' },
];

export default function StatusPage() {
  return (
    <main className="bg-ground">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
        <h1 className="text-3xl sm:text-5xl font-extrabold text-ink font-display tracking-tight mb-4">
          API status
        </h1>
        <p className="text-ink-secondary leading-relaxed mb-8">
          VerifyOne gate endpoints as implemented in this deployment. Data-source readiness (which registry
          files and upstream providers are loaded) is reported live — no uptime history is claimed here.
        </p>

        <div className="dp-card overflow-hidden mb-10">
          <table className="w-full text-sm">
            <thead className="bg-ground-muted">
              <tr>
                <th className="p-3 text-left font-semibold text-ink-secondary">Endpoint</th>
                <th className="p-3 text-left font-semibold text-ink-secondary">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {ENDPOINTS.map((e) => (
                <tr key={e.path}>
                  <td className="p-3">
                    <span className="text-ink font-medium">{e.name}</span>
                    <code className="block font-mono text-[11px] text-ink-secondary mt-0.5">{e.path}</code>
                  </td>
                  <td className="p-3">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
                      {e.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 className="text-lg font-extrabold text-ink font-display tracking-tight mb-3">
          Data-source receipts (live)
        </h2>
        <p className="text-sm text-ink-secondary leading-relaxed mb-6">
          Machine-readable status of the underlying registries and providers — including which files are
          loaded and which upstreams are configured — is served by the health endpoint:
        </p>
        <div className="terminal">
          <div className="terminal-head">
            <span>GET /api/v1/registry-health</span>
            <span className="normal-case tracking-normal">json</span>
          </div>
          <pre>{`{
  "shield_ready": boolean,        // is the default gate profile fully provisioned?
  "health": { ... },              // per-source readiness
  "data_sources": [ ... ],        // receipts: what is loaded, since when
  "catalog": [ ... ]              // supported sources
}`}</pre>
        </div>

        <p className="text-xs text-ink-secondary/70 mt-8 leading-relaxed">
          This page describes implemented endpoints only. Historical uptime, incident history, and SLA
          commitments are not published yet.
        </p>
      </div>
    </main>
  );
}
