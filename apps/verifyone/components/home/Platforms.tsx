import Link from 'next/link';

// Content rule: do not claim a native integration unless it exists and has been
// tested. Vapi and Retell outbound calls use the REST gate before call creation;
// their inbound screening webhooks are beta and must not get a native badge.
const PLATFORMS: { name: string; note: string; native?: boolean }[] = [
  { name: 'Vapi', note: 'Outbound: REST gate before POST /call. Inbound beta rejects invalid callers, flags loaded litigators, and skips outbound DNC/consent rules.' },
  { name: 'Retell AI', note: 'Outbound: REST gate before create-phone-call. Inbound beta rejects invalid callers, flags loaded litigators, and skips outbound DNC/consent rules.' },
  { name: 'Bland AI', note: 'Works through API / webhook / custom function' },
  { name: 'Synthflow', note: 'Works through API / webhook / custom function' },
  { name: 'ElevenLabs Agents', note: 'Works through API / webhook / custom function' },
  { name: 'LiveKit Agents', note: 'Works through API / webhook / custom function' },
  { name: 'Pipecat', note: 'Works through API / webhook / custom function' },
  { name: 'n8n', note: 'Works through HTTP Request node / webhook' },
  { name: 'Make', note: 'Works through API / webhook / custom function' },
  { name: 'Zapier', note: 'Works through API / webhook / custom function' },
  { name: 'GoHighLevel', note: 'Custom webhook action template ready (docs/integrations/gohighlevel.md) — marketplace app pending' },
  { name: 'MCP', note: 'Agent-native tool endpoint (app/api/mcp) — implemented; Smithery submission pack ready in smithery.yaml' },
  { name: 'HubSpot', note: 'Webhook adapter in code — beta; not verified against a live HubSpot account' },
];

export default function Platforms() {
  return (
    <section style={{ padding: 'var(--spacing6) 0', background: 'var(--theme-page-alt)' }}>
      <div className="container">
        <span className="eyebrow">Platforms</span>
        <h2 className="landing-section-title">Built for the AI outbound stack.</h2>
        <p className="section-lede">
          For Vapi and Retell outbound, call the REST gate and start the call only on ALLOW. Inbound
          screening webhooks are in beta; other workflows use the API or a custom function.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {PLATFORMS.map((p) => (
            <div key={p.name} className="dp-card px-5 py-4">
              <div className="flex items-center justify-between gap-2 mb-1">
                <h3 className="font-semibold text-sm" style={{ color: 'var(--theme-text-primary)', fontFamily: 'var(--font-display)' }}>
                  {p.name}
                </h3>
                {p.native && (
                  <span
                    className="shrink-0 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border font-mono"
                    style={{ color: 'var(--decision-allow)', borderColor: 'currentColor' }}
                  >
                    native
                  </span>
                )}
              </div>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--theme-text-muted)' }}>{p.note}</p>
            </div>
          ))}
        </div>

        <div className="mt-10">
          <Link href="/for-platforms" className="cta-link">
            Request a platform integration
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
}
