import { SignIn } from '@clerk/nextjs';
import { clerkPublishableKeyConfigured } from '../../../lib/clerk';

export const dynamic = 'force-dynamic';

export default function SignInPage() {
  if (!clerkPublishableKeyConfigured()) {
    return (
      <main className="bg-ground py-20 px-4">
        <div className="max-w-md mx-auto dp-card p-8 text-center">
          <h1 className="text-xl font-extrabold text-ink font-display mb-2">Auth not configured</h1>
          <p className="text-sm text-ink-secondary">
            Set <code className="font-mono text-xs">NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</code> and{' '}
            <code className="font-mono text-xs">CLERK_SECRET_KEY</code> to enable sign-in.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="bg-ground py-16 px-4 flex justify-center">
      <SignIn path="/sign-in" routing="path" signUpUrl="/sign-up" fallbackRedirectUrl="/dashboard" />
    </main>
  );
}
