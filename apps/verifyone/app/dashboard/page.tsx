export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { CreateOrganization, OrganizationList, OrganizationSwitcher, UserButton } from '@clerk/nextjs';
import { clerkConfigured } from '../../lib/clerk';
import { dbEnabled } from '../../lib/db';
import { getOrCreateOrganization, listOrgApiKeys } from '../../lib/orgs';

export default async function DashboardPage() {
  if (!clerkConfigured()) {
    return (
      <main className="bg-ground py-20 px-4">
        <div className="max-w-lg mx-auto dp-card p-8 text-center">
          <h1 className="text-xl font-extrabold text-ink font-display mb-2">Auth not configured</h1>
          <p className="text-sm text-ink-secondary">
            Clerk keys are not set in this environment. Set{' '}
            <code className="font-mono text-xs">NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</code> and{' '}
            <code className="font-mono text-xs">CLERK_SECRET_KEY</code> to enable the dashboard.
          </p>
        </div>
      </main>
    );
  }

  const { userId, orgId, orgSlug, orgRole } = auth();
  if (!userId) {
    redirect('/sign-in');
  }

  if (!orgId) {
    return (
      <main className="bg-ground py-16 px-4">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-ink font-display">
            Create or join an organization
          </h1>
          <p className="text-sm text-ink-secondary max-w-xl mx-auto">
            VerifyOne credits and API keys belong to an organization. Select an existing organization or
            create a new one to continue to the dashboard.
          </p>
          <div className="flex flex-col items-center gap-6">
            <OrganizationList
              hidePersonal
              afterSelectOrganizationUrl="/dashboard"
              afterCreateOrganizationUrl="/dashboard"
            />
            <CreateOrganization afterCreateOrganizationUrl="/dashboard" />
          </div>
        </div>
      </main>
    );
  }

  const org = dbEnabled() ? await getOrCreateOrganization(orgId, orgSlug || undefined) : null;
  if (org?.disabledAt) {
    return (
      <main className="bg-ground py-20 px-4">
        <div className="max-w-lg mx-auto dp-card p-8 text-center space-y-3">
          <h1 className="text-xl font-extrabold text-ink font-display">This organization has been disabled</h1>
          <p className="text-sm text-ink-secondary">
            API keys for <strong className="text-ink">{org.name}</strong> are revoked and key creation is disabled.
          </p>
        </div>
      </main>
    );
  }
  const activeKeys = org ? (await listOrgApiKeys(org.id)).filter((k) => !k.revokedAt).length : 0;

  return (
    <main className="bg-ground py-12 px-4">
      <div className="max-w-5xl mx-auto space-y-8">
        <header className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-rule">
          <div>
            <p className="text-xs font-mono uppercase tracking-widest text-ink-secondary mb-1">
              Organization Dashboard
            </p>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-ink font-display">
              {org?.name ?? orgSlug ?? 'Organization'}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <OrganizationSwitcher
              hidePersonal
              afterSelectOrganizationUrl="/dashboard"
              afterCreateOrganizationUrl="/dashboard"
            />
            <UserButton />
          </div>
        </header>

        {!org ? (
          <div className="dp-card p-6 border-amber-500/40">
            <p className="text-sm text-ink-secondary">
              Database persistence is not configured (<code className="font-mono text-xs">DATABASE_URL</code> unset).
              Connect Postgres to manage organization credits and API keys.
            </p>
          </div>
        ) : (
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="dp-card p-5">
              <p className="text-xs text-ink-secondary font-mono uppercase">Plan</p>
              <p className="text-2xl font-extrabold text-ink font-display mt-1">{org.plan}</p>
            </div>
            <div className="dp-card p-5">
              <p className="text-xs text-ink-secondary font-mono uppercase">Credits remaining</p>
              <p className="text-2xl font-extrabold text-ink font-display mt-1">
                {org.credits.toLocaleString()}
              </p>
            </div>
            <div className="dp-card p-5">
              <p className="text-xs text-ink-secondary font-mono uppercase">Active API keys</p>
              <p className="text-2xl font-extrabold text-ink font-display mt-1">{activeKeys}</p>
            </div>
            <div className="dp-card p-5">
              <p className="text-xs text-ink-secondary font-mono uppercase">Your role</p>
              <p className="text-2xl font-extrabold text-ink font-display mt-1">
                {orgRole === 'org:admin' ? 'Admin' : 'Member'}
              </p>
            </div>
          </section>
        )}

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link href="/dashboard/api-keys" className="dp-card p-6 hover:border-accent/40 transition-colors">
            <h2 className="font-bold text-base text-ink font-display mb-1">API keys →</h2>
            <p className="text-xs text-ink-secondary leading-relaxed">
              Create, view, and revoke organization API keys. Plaintext keys are shown once at creation.
            </p>
          </Link>
          <Link href="/docs" className="dp-card p-6 hover:border-accent/40 transition-colors">
            <h2 className="font-bold text-base text-ink font-display mb-1">API documentation →</h2>
            <p className="text-xs text-ink-secondary leading-relaxed">
              Pre-dial gate contract, Vapi/Retell webhooks, MCP server, and bulk screening endpoints.
            </p>
          </Link>
          <Link href="/pricing" className="dp-card p-6 hover:border-accent/40 transition-colors">
            <h2 className="font-bold text-base text-ink font-display mb-1">Plans &amp; credits →</h2>
            <p className="text-xs text-ink-secondary leading-relaxed">
              Compare Starter, Growth, and Pro credit allowances.
            </p>
          </Link>
        </section>
      </div>
    </main>
  );
}
