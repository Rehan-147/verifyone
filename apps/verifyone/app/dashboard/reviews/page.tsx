export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { OrganizationSwitcher, UserButton } from '@clerk/nextjs';
import { clerkConfigured } from '../../../lib/clerk';
import { dbEnabled } from '../../../lib/db';
import { getOrCreateOrganization } from '../../../lib/orgs';
import { listReviews, reviewStats, toMaskedItem, REVIEW_APPROVAL_TTL_HOURS, type MaskedReviewItem } from '../../../lib/reviews';
import OrgReviewsClient from '../../../components/OrgReviewsClient';
export default async function DashboardReviewsPage({
  searchParams,
}: {
  searchParams?: { status?: string };
}) {
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
        <p className="text-sm text-ink-secondary">You need an organization to manage review items.</p>
        <Link href="/dashboard" className="text-xs font-mono text-accent hover:underline">← Back to dashboard</Link>
      </main>
    );
  }

  if (!dbEnabled()) {
    return (
      <main className="bg-ground py-16 px-4">
        <div className="max-w-lg mx-auto dp-card p-8 text-center">
          <h1 className="text-xl font-extrabold text-ink font-display mb-2">Database not configured</h1>
          <p className="text-sm text-ink-secondary">Set DATABASE_URL to manage review items.</p>
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
          <p className="text-sm text-ink-secondary">Review queue access is disabled for this organization.</p>
          <Link href="/dashboard" className="text-xs font-mono text-accent hover:underline inline-block">← Back to dashboard</Link>
        </div>
      </main>
    );
  }

  const ownerKey = `org:${org.id}`;
  const activeStatus = (searchParams?.status ?? 'open') as 'open' | 'approved' | 'rejected' | 'expired';
  const [initialPage, stats] = await Promise.all([
    listReviews({ ownerKey, status: activeStatus, limit: 50 }),
    reviewStats(ownerKey),
  ]);

  return (
    <main className="bg-ground py-12 px-4">
      <div className="max-w-5xl mx-auto space-y-8">
        <header className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-rule">
          <div>
            <Link href="/dashboard" className="text-xs font-mono text-accent hover:underline">
              ← Back to dashboard
            </Link>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-ink font-display mt-1">
              Review Queue — {org.name}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <OrganizationSwitcher
              hidePersonal
              afterSelectOrganizationUrl="/dashboard/reviews"
              afterCreateOrganizationUrl="/dashboard/reviews"
            />
            <UserButton />
          </div>
        </header>

        {/* Stats card */}
        <div className="dp-card p-5 flex flex-wrap gap-6">
          <div>
            <div className="text-3xl font-extrabold text-ink font-display">{stats.open_count}</div>
            <div className="text-xs text-ink-secondary mt-0.5">Open items</div>
          </div>
          {Object.entries(stats.approval_rate_by_reason).map(([reason, s]) => (
            <div key={reason}>
              <div className="text-2xl font-bold text-ink font-display">{s.rate}%</div>
              <div className="text-xs text-ink-secondary mt-0.5">{reason} approval (30d)</div>
              <div className="text-xs text-ink-secondary/60">{s.approved}/{s.total} resolved</div>
            </div>
          ))}
        </div>

        <OrgReviewsClient
          initialItems={initialPage.items.map(toMaskedItem)}
          initialCursor={initialPage.next_cursor}
          activeStatus={activeStatus}
          isAdmin={orgRole === 'org:admin'}
          approvalTtlHours={REVIEW_APPROVAL_TTL_HOURS}
          orgId={org.id}
        />
      </div>
    </main>
  );
}
