import { complianceCacheStats, type RegistryHealth } from './compliance-cache';

export function requireRegistriesInProduction(): boolean {
  if (process.env.COMPLIANCE_REQUIRE_REGISTRIES === 'false') return false;
  return process.env.NODE_ENV === 'production';
}

export function allowDevMocks(): boolean {
  return process.env.NODE_ENV !== 'production' || process.env.COMPLIANCE_ALLOW_DEV_MOCKS === 'true';
}

export function shieldRegistriesReady(health: RegistryHealth): boolean {
  return health.dnc.ready && health.litigator.ready;
}

export function evaluateShieldReadiness() {
  const health = complianceCacheStats();
  const require = requireRegistriesInProduction();
  const ready = shieldRegistriesReady(health);
  return {
    require_registries: require,
    shield_ready: ready,
    health,
    block_reason: require && !ready ? 'registry_unavailable_fail_closed' : undefined,
  };
}
