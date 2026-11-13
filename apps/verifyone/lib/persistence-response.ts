import { NextResponse } from 'next/server';
import {
  platformDecisionHeaders,
  platformDenyPayload,
  type VoicePlatform,
} from './agent-webhooks';

export function persistenceUnavailableResponse(headers?: HeadersInit) {
  return NextResponse.json(
    { error: 'persistence_unavailable', decision: 'DENY' },
    { status: 503, headers },
  );
}

export function platformPersistenceUnavailableResponse(platform: VoicePlatform, headers?: HeadersInit) {
  const responseHeaders = new Headers(headers);
  for (const [name, value] of Object.entries(
    platformDecisionHeaders('DENY', 'persistence_unavailable'),
  )) {
    responseHeaders.set(name, value);
  }
  return NextResponse.json(
    platformDenyPayload(platform),
    { status: 200, headers: responseHeaders },
  );
}
