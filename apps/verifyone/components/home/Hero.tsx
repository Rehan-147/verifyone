import Link from 'next/link';

// ── SSR hero — React Server Component, zero client JS ────────────────────────
// Layout follows the Caution reference: large left-aligned title, description
// and CTAs in a right-hand column, generous vertical space, radial page glow.
// The allow/review/block switcher is pure CSS (:checked sibling selectors).
//
// Per content rules: this panel is NOT a live API call and stays labeled as an
// illustrative example. The live v1 API currently returns ALLOW | DENY.
// See /docs#decision-values for the live v1 response reference.

const REQUEST_JSON = `{
  "phone": "+14155550123",
  "channel": "ai_voice",
  "campaign_type": "sales",
  "consent": {
    "status": "express_written",
    "captured_at": "2026-11-01T18:22:00Z",
    "source": "web_form"
  },
  "last_contacted_at": "2026-09-14T15:04:00Z"
}`;

const RESPONSES: { id: string; key: string; cls: string; note: string; json: string }[] = [
  {
    id: 'allow',
    key: 'panel-allow',
    cls: 'decision-allow',
    note: 'The requested action passed the enabled checks. The agent may proceed and stores the evidence ID.',
    json: `{
  "decision": "allow",
  "reason": "All enabled checks passed",
  "risk_score": 4,
  "checks": [
    "internal_suppression",
    "ftc_dnc",
    "fcc_rnd",
    "carrier_status",
    "litigator_risk",
    "calling_hours"
  ],
  "evidence_id": "ev_01J9X7Q2M8"
}`,
  },
  {
    id: 'review',
    key: 'panel-review',
    cls: 'decision-review',
    note: 'One or more checks are inconclusive or need human approval. The agent should pause or route to a reviewer.',
    json: `{
  "decision": "review",
  "reason": "Reassigned-number result inconclusive since consent date",
  "risk_score": 57,
  "checks": [
    "internal_suppression",
    "ftc_dnc",
    "fcc_rnd",
    "carrier_status",
    "litigator_risk",
    "calling_hours"
  ],
  "evidence_id": "ev_01J9X7Q2M6"
}`,
  },
  {
    id: 'block',
    key: 'panel-block',
    cls: 'decision-block',
    note: 'The action should not proceed. The agent receives a specific reason and the evidence ID.',
    json: `{
  "decision": "block",
  "reason": "Number is on the National Do Not Call Registry",
  "risk_score": 98,
  "checks": [
    "internal_suppression",
    "ftc_dnc",
    "fcc_rnd",
    "carrier_status",
    "litigator_risk",
    "calling_hours"
  ],
  "evidence_id": "ev_01J9X7Q2M4"
}`,
  },
];

export default function Hero() {
  return (
    <div className="hero-wrap">
      {/* ── Hero copy — Caution layout: title left, description right ── */}
      <section className="hero">
        <div className="container hero-content">
          <div>
            <span className="eyebrow">Pre-action compliance gate for AI agents</span>
            <h1 className="hero-title">
              Your AI agent dials.
              <br />
              VerifyOne decides whether it should.
            </h1>
          </div>
          <div>
            <p className="hero-description">
              Before every outbound call or message, VerifyOne checks DNC status, reassigned-number
              risk, consent, calling hours, and known-litigator risk. It returns an auditable{' '}
              <span className="decision-allow">allow</span>,{' '}
              <span className="decision-review">review</span>, or{' '}
              <span className="decision-block">block</span> decision — so your agent stops risky
              contacts before they happen.
            </p>
            <div className="cta-group">
              <Link href="/dashboard" className="cta-btn">Test the Pre-Dial Gate</Link>
              <Link href="/dashboard" className="cta-link">
                Get API Key
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12h14" />
                  <path d="m12 5 7 7-7 7" />
                </svg>
              </Link>
            </div>
            <p className="hero-trust">
              Live API · MCP-ready · Tamper-evident audit records · U.S. phone coverage first
            </p>
          </div>
        </div>
      </section>

      {/* ── The one call — quiet API panel below the hero ── */}
      <section className="hero-api">
        <div className="container">
          <span className="eyebrow">The one call your agent makes</span>
          <div className="csstabs" style={{ maxWidth: 900 }}>
            <input type="radio" name="gate-decision" id="gd-allow" />
            <input type="radio" name="gate-decision" id="gd-review" />
            <input type="radio" name="gate-decision" id="gd-block" defaultChecked />

            <div className="tabbtns flex flex-wrap gap-2 pb-4">
              {RESPONSES.map((r) => (
                <label
                  key={r.id}
                  htmlFor={`gd-${r.id}`}
                  className="tabbtn rounded-md border px-3 py-1.5 text-xs font-mono"
                  style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-text-muted)', minHeight: 44 }}
                >
                  {r.id}
                </label>
              ))}
              <span className="ml-auto self-center text-xs font-mono" style={{ color: 'var(--theme-text-faint)' }}>
                Illustrative example — not a live response
              </span>
            </div>

            <div className="grid lg:grid-cols-2">
              <div className="terminal min-w-0" style={{ borderRadius: 'var(--radius-md)' }}>
                <div className="terminal-head"><span>Request</span><span className="normal-case tracking-normal">POST /api/v1/gate/phone</span></div>
                <pre>{REQUEST_JSON}</pre>
              </div>

              <div className="min-w-0">
                {RESPONSES.map((r) => (
                  <div key={r.key} id={r.key} className={`tabpanel ${r.id === 'block' ? 'active-by-default' : ''}`}>
                    <div className="terminal" style={{ borderRadius: 'var(--radius-md)' }}>
                      <div className="terminal-head">
                        <span>Response</span>
                        <span className={`normal-case tracking-normal font-mono font-semibold ${r.cls}`}>{r.id}</span>
                      </div>
                      <pre aria-live="polite">{r.json}</pre>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {RESPONSES.map((r) => (
              <p
                key={`note-${r.key}`}
                id={`note-${r.key}`}
                className={`tabpanel ${r.id === 'block' ? 'active-by-default' : ''}`}
                style={{ color: 'var(--theme-text-secondary)', fontSize: '0.95rem', padding: '12px 2px 0' }}
              >
                {r.note}
              </p>
            ))}

            <p style={{ color: 'var(--theme-text-faint)', fontSize: '0.8rem', padding: '10px 2px 0', fontFamily: 'ui-monospace, monospace' }}>
              Illustrative example — final request fields and response shape may change before general
              availability. The live v1 API returns ALLOW | DENY — see <a href="/docs#decision-values" className="underline">/docs#decision-values</a>.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
