// 1200x630 social card — astryx-neutral light palette: gray canvas, black ink, astryx blue.
import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'VerifyOne — Pre-Dial Compliance Gate for AI Agents';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const INK = '#000000';   // astryx text-primary (neutral[0])
const BRAND = '#0074e2'; // astryx --color-info light
const MUTED = '#6a6a6a'; // astryx neutral[45] (icon-secondary)
const RULE = '#d4d4d4';  // astryx border-emphasized (neutral[85])

export default function og() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '72px 80px',
          backgroundColor: '#f1f1f1',
          backgroundImage:
            'radial-gradient(58% 70% at 82% 12%, rgba(0,116,226,0.10) 0%, transparent 70%), radial-gradient(46% 60% at 8% 92%, rgba(255,255,255,0.9) 0%, transparent 72%)',
          color: INK,
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 40 }}>
          <div
            style={{
              width: 46, height: 46, borderRadius: 12,
              border: '2px solid ' + BRAND,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22, fontWeight: 700, color: BRAND,
            }}
          >
            ✓
          </div>
          <div style={{ display: 'flex', fontSize: 30, fontWeight: 600, letterSpacing: -0.5 }}>
            Verify<span style={{ color: BRAND }}>One</span>
          </div>
          <div
            style={{
              marginLeft: 'auto', display: 'flex', padding: '8px 16px', borderRadius: 999,
              border: '1px solid ' + RULE, background: '#ffffff',
              fontSize: 17, letterSpacing: 2, color: MUTED, textTransform: 'uppercase',
            }}
          >
            Pre-action gate
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', fontSize: 62, fontWeight: 700, lineHeight: 1.1, letterSpacing: -1.6, maxWidth: 980 }}>
          <span>Your AI agent is about to dial.</span>
          <span style={{ color: BRAND }}>Should it be allowed to?</span>
        </div>

        <div style={{ display: 'flex', gap: 12, marginTop: 40 }}>
          {['National DNC', 'Reassigned numbers', 'Litigator traps', 'Quiet hours', 'AI voice consent', 'Audit evidence'].map((t) => (
            <div
              key={t}
              style={{
                display: 'flex', padding: '9px 18px', borderRadius: 999,
                border: '1px solid ' + RULE, background: '#ffffff',
                fontSize: 19, color: INK,
              }}
            >
              {t}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', marginTop: 42, fontSize: 22, color: MUTED, fontFamily: 'monospace' }}>
          POST /api/v1/gate/phone → {'{ decision: "ALLOW" | "DENY", reason, evidence_id }'}
        </div>
      </div>
    ),
    size
  );
}
