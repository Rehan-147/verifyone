import { runPhoneGate, type GateChecks, type GateResult } from './gate';

export type PhoneGateBody = Record<string, unknown> & {
  phone?: unknown;
  consent?: unknown;
  profile?: string;
  live_hlr?: boolean;
  debug_now?: string;
  mode?: string;
  channel?: string;
};

/** Shared decision runner; preserves the phone route's existing timeout fallback contract. */
export async function runPhoneGateDecision(body: PhoneGateBody, profile: string, timeoutMs: number) {
  return Promise.race([
    runPhoneGate({
      phone: String(body.phone ?? ''),
      channel: body.channel === 'sms' ? 'sms' : 'voice',
      consent: body.consent as { declared?: boolean; type?: 'express_written' | 'ebr' | 'none' },
      mode: body.mode === 'fail_open' ? 'fail_open' : 'fail_closed',
      debug_now: body.debug_now,
      profile: profile as 'ai_outbound_shield' | 'full_stack',
      live_hlr: body.live_hlr === true,
    }),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('gate_timeout')), timeoutMs)),
  ]).catch(() => {
    if (body.mode === 'fail_open') {
      return {
        decision: 'allow' as const,
        reason: 'fail_open_gate_unavailable',
        mode: 'fail_open',
        degraded: true,
        profile: profile as 'ai_outbound_shield' | 'full_stack',
        upstream_live: false,
        checks: {
          valid_number: false,
          line_type: 'unknown' as const,
          disconnected: false,
          litigator: { hit: false },
          dnc: { listed: false, source: 'unavailable' },
          reassigned: { reassigned: false, status: 'unavailable' as const },
          consent: {
            declared: !!(body.consent as { declared?: boolean } | undefined)?.declared,
            type: (body.consent as { type?: string } | undefined)?.type || 'none',
            sufficient_for_ai: (body.consent as { type?: string } | undefined)?.type === 'express_written',
          },
          calling_hours: { applicable: false },
        },
        verified_at: new Date().toISOString(),
        fresh_for_hours: 1,
        evidence_id: '',
        risk_score: 50,
      };
    }
    return {
      decision: 'block' as const,
      reason: 'gate_unavailable_fail_closed',
      mode: 'fail_closed',
      degraded: true,
      profile: profile as 'ai_outbound_shield' | 'full_stack',
      upstream_live: false,
      checks: {} as GateChecks,
      verified_at: new Date().toISOString(),
      fresh_for_hours: 1,
      evidence_id: '',
      risk_score: 50,
    };
  }) as Promise<GateResult & { mode: string; degraded: boolean; profile: 'ai_outbound_shield' | 'full_stack'; upstream_live: boolean; data_sources?: import('./data-sources').DataSourceReceipt[] }>;
}
