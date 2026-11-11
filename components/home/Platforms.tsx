import Link from 'next/link';

// Content rule: do not claim a native integration unless it exists and has been
// tested. Only the Vapi and Retell webhook endpoints are implemented in this
// codebase — every other platform is labeled as API/webhook/custom-function.
const PLATFORMS: { name: string; note: string; native?: boolean }[] = [
  { name: 'Vapi', note: 'Pre-connect server URL webhook — implemented', native: true },
  { name: 'Retell AI', note: 'Pre-call webhook — implemented', native: true },
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
  { name: 'HubSpot', note: 'Contact webhook with signed v3 verification + property write-back — implemented (pending live-key verification)' },
];

export default function Platforms() {
  return (
    <section style={{ padding: 'var(--spacing6) 0', background: 'var(--theme-page-alt)' }}>
      <div className="container">
        <span className="eyebrow">Platforms</span>
        <h2 className="landing-section-title">Built for the AI outbound stack.</h2>
        <p className="section-lede">
          If your platform can make an HTTPS call before it dials, VerifyOne fits. Native endpoints are
          labeled; everything else works through the API.
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
