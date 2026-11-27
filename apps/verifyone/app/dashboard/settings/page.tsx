export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { CreateOrganization, OrganizationSwitcher, UserButton } from '@clerk/nextjs';
import { clerkConfigured } from '../../../lib/clerk';
import { dbEnabled } from '../../../lib/db';
import { getOrCreateOrganization } from '../../../lib/orgs';
import { ORG_CALL_CAP_MAX, ORG_CALL_CAP_MIN, STATE_FREQUENCY_RULES } from '../../../lib/data/state-frequency-rules';
import FrequencySettingsClient from '../../../components/FrequencySettingsClient';

export default async function DashboardSettingsPage() {
  if (!clerkConfigured()) {
    return (
      <main className="bg-ground py-20 px-4">
        <div className="max-w-lg mx-auto dp-card p-8 text-center">
          <h1 className="text-xl font-extrabold text-ink font-display mb-2">Auth not configured</h1>
          <p className="text-sm text-ink-secondary">Clerk keys are not set in this environment.</p>
        </div>
      </main>
    );
  }

  const { userId, orgId, orgSlug, orgRole } = auth();
  if (!userId) redirect('/sign-in');

  if (!orgId) {
    return (
      <main className="bg-ground py-16 px-4 flex flex-col items-center gap-6">
        <h1 className="text-2xl font-extrabold text-ink font-display">Select or create an organization</h1>
        <CreateOrganization afterCreateOrganizationUrl="/dashboard/settings" />
      </main>
    );
  }

  if (!dbEnabled()) {
    return (
      <main className="bg-ground py-16 px-4">
        <div className="max-w-lg mx-auto dp-card p-8 text-center">
          <h1 className="text-xl font-extrabold text-ink font-display mb-2">Database not configured</h1>
          <p className="text-sm text-ink-secondary">Set DATABASE_URL to manage organization settings.</p>
        </div>
      </main>
    );
  }

  const org = await getOrCreateOrganization(orgId, orgSlug || undefined);
  if (org.disabledAt) {
    return (
      <main className="bg-ground py-20 px-4">
        <div className="max-w-lg mx-auto dp-card p-8 text-center space-y-3">
          <h1 className="text-xl font-extrabold text-ink font-display">This organization has been disabled</h1>
          <Link href="/dashboard" className="text-xs font-mono text-accent hover:underline inline-block">
            ← Back to dashboard
          </Link>
        </div>
      </main>
    );
  }

  const stateRules = Object.entries(STATE_FREQUENCY_RULES).map(([state, r]) => ({
    state,
    maxCalls: r.maxCalls,
    windowHours: r.windowHours,
    citation: r.citation,
  }));

  return (
    <main className="bg-ground py-12 px-4">
      <div className="max-w-5xl mx-auto space-y-8">
        <header className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-rule">
          <div>
            <Link href="/dashboard" className="text-xs font-mono text-accent hover:underline">
              ← Back to dashboard
            </Link>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-ink font-display mt-1">
              Call frequency — {org.name}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <OrganizationSwitcher
              hidePersonal
              afterSelectOrganizationUrl="/dashboard/settings"
              afterCreateOrganizationUrl="/dashboard/settings"
            />
            <UserButton />
          </div>
        </header>

        <FrequencySettingsClient
          initialCap={org.callCap24h ?? null}
          isAdmin={orgRole === 'org:admin'}
          stateRules={stateRules}
          min={ORG_CALL_CAP_MIN}
          max={ORG_CALL_CAP_MAX}
        />
      </div>
    </main>
  );
}
