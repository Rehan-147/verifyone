export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { CreateOrganization, OrganizationSwitcher, UserButton } from '@clerk/nextjs';
import { clerkConfigured } from '../../../lib/clerk';
import { dbEnabled } from '../../../lib/db';
import { getOrCreateOrganization } from '../../../lib/orgs';
import { listSuppression } from '../../../lib/suppression';
import OrgSuppressionClient from '../../../components/OrgSuppressionClient';

export default async function DashboardSuppressionPage() {
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
        <CreateOrganization afterCreateOrganizationUrl="/dashboard/suppression" />
      </main>
    );
  }

  if (!dbEnabled()) {
    return (
      <main className="bg-ground py-16 px-4">
        <div className="max-w-lg mx-auto dp-card p-8 text-center">
          <h1 className="text-xl font-extrabold text-ink font-display mb-2">Database not configured</h1>
          <p className="text-sm text-ink-secondary">Set DATABASE_URL to manage internal suppression.</p>
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
          <p className="text-sm text-ink-secondary">Suppression management is disabled for this organization.</p>
          <Link href="/dashboard" className="text-xs font-mono text-accent hover:underline inline-block">
            ← Back to dashboard
          </Link>
        </div>
      </main>
    );
  }

  const initialPage = await listSuppression({ ownerKey: `org:${org.id}` });

  return (
    <main className="bg-ground py-12 px-4">
      <div className="max-w-5xl mx-auto space-y-8">
        <header className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-rule">
          <div>
            <Link href="/dashboard" className="text-xs font-mono text-accent hover:underline">
              ← Back to dashboard
            </Link>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-ink font-display mt-1">
              Internal Suppression (DNC) — {org.name}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <OrganizationSwitcher
              hidePersonal
              afterSelectOrganizationUrl="/dashboard/suppression"
              afterCreateOrganizationUrl="/dashboard/suppression"
            />
            <UserButton />
          </div>
        </header>

        <OrgSuppressionClient
          initialItems={initialPage.items}
          initialCursor={initialPage.next_cursor}
          isAdmin={orgRole === 'org:admin'}
        />
      </div>
    </main>
  );
}
