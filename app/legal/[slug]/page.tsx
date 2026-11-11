import type { Metadata } from 'next';
import Link from 'next/link';
import { LEGAL_DOCS, getLegalDoc } from '../../../lib/data/legal';

export function generateStaticParams() {
  return LEGAL_DOCS.map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const doc = getLegalDoc(params.slug);
  if (!doc) return { title: 'Legal' };
  return {
    title: doc.title,
    description: doc.intro.slice(0, 155),
    // Draft policy text pending counsel review — kept out of the index and the
    // sitemap until it is final, so it cannot be read as a published commitment.
    robots: { index: false, follow: true },
    alternates: { canonical: `https://app.verifyone.io/legal/${doc.slug}` },
  };
}

export default function LegalPage({ params }: { params: { slug: string } }) {
  const doc = getLegalDoc(params.slug);

  if (!doc) {
    return (
      <main className="bg-ground">
        <div className="max-w-3xl mx-auto px-4 py-20 text-center">
          <h1 className="text-2xl font-extrabold text-ink font-display mb-3">Page not found</h1>
          <p className="text-ink-secondary text-sm mb-6">No legal page exists at /legal/{params.slug}.</p>
          <Link href="/" className="dp-btn-primary">Back to home</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="bg-ground">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-ink font-display tracking-tight mb-3">
          {doc.title}
        </h1>
        <p className="text-xs font-mono text-ink-secondary mb-6">Last updated: {doc.updated}</p>
        <p className="text-sm text-ink-secondary leading-relaxed mb-10">{doc.intro}</p>

        <div className="space-y-8">
          {doc.sections.map((s) => (
            <section key={s.h}>
              <h2 className="text-lg font-extrabold text-ink font-display tracking-tight mb-2">{s.h}</h2>
              {s.p.map((para, i) => (
                <p key={i} className="text-sm text-ink-secondary leading-relaxed mb-2">
                  {para}
                </p>
              ))}
            </section>
          ))}
        </div>

        {/* Cross-links */}
        <nav aria-label="Other legal pages" className="mt-12 pt-6 border-t border-rule">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-secondary mb-3">Other legal pages</p>
          <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
            {LEGAL_DOCS.filter((d) => d.slug !== doc.slug).map((d) => (
              <li key={d.slug}>
                <Link href={`/legal/${d.slug}`} className="text-accent hover:underline">
                  {d.title}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/security" className="text-accent hover:underline">Security &amp; trust</Link>
            </li>
          </ul>
        </nav>
      </div>
    </main>
  );
}
