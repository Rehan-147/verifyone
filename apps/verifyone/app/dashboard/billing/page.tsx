export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { CreateOrganization, OrganizationSwitcher, UserButton } from '@clerk/nextjs';
import { clerkConfigured } from '../../../lib/clerk';
import { dbEnabled } from '../../../lib/db';
import { getOrCreateOrganization } from '../../../lib/orgs';
import { listOrgPaymentEvents } from '../../../lib/billing';
import { PLANS, normalizePlanKey } from '../../../lib/plans';
import BillingClient from '../../../components/BillingClient';

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <main className="bg-ground py-20 px-4">
      <div className="max-w-lg mx-auto dp-card p-8 text-center">
        <h1 className="text-xl font-extrabold text-ink font-display mb-2">{title}</h1>
        <p className="text-sm text-ink-secondary">{body}</p>
      </div>
    </main>
  );
}

export default async function BillingPage({ searchParams }: { searchParams: { plan?: string; upgraded?: string } }) {
  if (!clerkConfigured()) return <Notice title="Auth not configured" body="Clerk keys are not set in this environment." />;

  const { userId, orgId, orgSlug, orgRole } = auth();
  if (!userId) redirect('/sign-in');
  if (!orgId) {
    return (
      <main className="bg-ground py-16 px-4 flex flex-col items-center gap-6">
        <h1 className="text-2xl font-extrabold text-ink font-display">Create an organization to subscribe</h1>
        <CreateOrganization afterCreateOrganizationUrl={`/dashboard/billing${searchParams.plan ? `?plan=${encodeURIComponent(searchParams.plan)}` : ''}`} />
      </main>
    );
  }
  if (!dbEnabled()) return <Notice title="Database not configured" body="Set DATABASE_URL to manage billing." />;

  const org = await getOrCreateOrganization(orgId, orgSlug || undefined);
  if (org.disabledAt) return <Notice title="This organization has been disabled" body="Contact support to restore access." />;

  const events = await listOrgPaymentEvents(org.id, 20);
  const planName = org.plan in PLANS ? PLANS[org.plan as keyof typeof PLANS].name : 'Free';

  return (
    <main className="bg-ground py-12 px-4">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-rule">
          <div>
            <Link href="/dashboard" className="text-xs font-mono text-accent hover:underline">← Back to dashboard</Link>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-ink font-display mt-1">Billing — {org.name}</h1>
          </div>
          <div className="flex items-center gap-3">
            <OrganizationSwitcher hidePersonal afterSelectOrganizationUrl="/dashboard/billing" afterCreateOrganizationUrl="/dashboard/billing" />
            <UserButton />
          </div>
        </header>

        {searchParams.upgraded && (
          <p className="dp-card p-4 text-sm text-ink-secondary">
            Thanks — your payment is being confirmed. Credits appear here as soon as Dodo notifies us, usually within a minute.
          </p>
        )}

        <section className="grid sm:grid-cols-3 gap-4">
          <div className="dp-card p-6">
            <p className="text-xs text-ink-secondary uppercase tracking-wide">Plan</p>
            <p className="text-2xl font-extrabold text-ink font-display mt-1">{planName}</p>
          </div>
          <div className="dp-card p-6">
            <p className="text-xs text-ink-secondary uppercase tracking-wide">Credit balance</p>
            <p className="text-2xl font-extrabold text-ink font-display mt-1 font-mono">{org.credits.toLocaleString('en-US')}</p>
          </div>
          <div className="dp-card p-6">
            <p className="text-xs text-ink-secondary uppercase tracking-wide">Subscription</p>
            <p className="text-sm text-ink mt-2">{org.dodoSubscriptionId ? 'Active (billed by Dodo Payments)' : 'None'}</p>
          </div>
        </section>

        <BillingClient
          currentPlan={org.plan}
          hasSubscription={!!org.dodoSubscriptionId}
          isAdmin={orgRole === 'org:admin'}
          preselect={normalizePlanKey(searchParams.plan ?? '')}
        />

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-ink font-display">Payment history</h2>
          {events.length === 0 ? (
            <p className="text-sm text-ink-secondary">No payments yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-rule">
              <table className="w-full text-sm min-w-[520px]">
                <thead className="bg-ground-muted">
                  <tr>
                    <th className="p-3 text-left font-semibold text-ink-secondary">Date</th>
                    <th className="p-3 text-left font-semibold text-ink-secondary">Event</th>
                    <th className="p-3 text-left font-semibold text-ink-secondary">Plan</th>
                    <th className="p-3 text-left font-semibold text-ink-secondary">Credits added</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rule">
                  {events.map((e) => (
                    <tr key={e.id}>
                      <td className="p-3 font-mono text-xs">{e.createdAt.toISOString().slice(0, 10)}</td>
                      <td className="p-3 text-xs">{e.type}</td>
                      <td className="p-3 text-xs">{e.plan ?? '—'}</td>
                      <td className="p-3 font-mono text-xs">{e.credits ? e.credits.toLocaleString('en-US') : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-xs text-ink-secondary/80">Invoices and receipts are emailed by Dodo Payments, our merchant of record.</p>
        </section>
      </div>
    </main>
  );
}
