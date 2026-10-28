import Link from 'next/link';
import { INTEGRATIONS } from '../../lib/integrations/catalog-100';

export const metadata = {
  title: '100+ Integrations Catalog | VerifyOne',
  description: 'Connect VerifyOne validation to HubSpot, Salesforce, Zapier, Make, n8n, Google Sheets, and 100+ platforms with no code.',
};

export default function IntegrationsPage() {
  const categories = Array.from(new Set(INTEGRATIONS.map((i) => i.category)));

  return (
    <div className="min-h-screen bg-ground text-ink">
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
        <header className="text-center mb-16">
          <span className="inline-block rounded-full bg-accent/10 border border-accent/20 px-4 py-1 text-xs font-semibold text-accent tracking-widest uppercase mb-4">
            Ecosystem Directory
          </span>
          <h1 className="text-3xl md:text-5xl font-extrabold text-ink font-display tracking-tight mb-4">
            Connect VerifyOne with 100+ Tools
          </h1>
          <p className="text-ink-secondary text-base md:text-lg max-w-2xl mx-auto leading-relaxed">
            Sanitize leads as they enter your CRM, trigger validations from Google Sheets, or orchestrate automated flows via Zapier, Make, and n8n.
          </p>
        </header>

        {/* Featured native platforms banner */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-16">
          {[
            { name: 'Zapier', status: 'Official App', desc: 'Trigger on new lead or form submission' },
            { name: 'HubSpot', status: 'Native Webhook', desc: 'Auto-scrub contacts on entry' },
            { name: 'Google Sheets', status: '=VERIFYONE()', desc: 'Apps Script custom formula' },
            { name: 'n8n / Make', status: 'Pre-built Flows', desc: 'Self-hosted and cloud orchestration' },
          ].map((feat) => (
            <div key={feat.name} className="dp-card p-5">
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-accent/10 text-accent border border-accent/20">
                {feat.status}
              </span>
              <h3 className="font-bold text-base text-ink font-display mt-3 mb-1">{feat.name}</h3>
              <p className="text-xs text-ink-secondary leading-relaxed">{feat.desc}</p>
            </div>
          ))}
        </div>

        {/* Full 100 integrations catalog by category */}
        {categories.map((category) => {
          const list = INTEGRATIONS.filter((i) => i.category === category);
          return (
            <section key={category} className="mb-14">
              <h2 className="text-lg font-bold uppercase tracking-wider text-ink font-display border-b border-rule pb-3 mb-6 flex items-center justify-between">
                <span>{category}</span>
                <span className="text-xs bg-ground-muted border border-rule px-2.5 py-0.5 rounded-full font-mono text-ink-secondary">
                  {list.length} Apps
                </span>
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {list.map((item) => (
                  <div
                    key={item.slug}
                    className="dp-card hover:border-accent/40 p-5 transition-all duration-160 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-bold text-sm text-ink font-display">{item.name}</span>
                        <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-ground-muted border border-rule text-ink-secondary">
                          {item.difficulty}
                        </span>
                      </div>
                      <p className="text-xs text-ink-secondary leading-relaxed mb-4">{item.description}</p>
                    </div>

                    <div className="pt-3 border-t border-rule/50 flex items-center justify-between text-[11px] text-ink-secondary">
                      <span>Method: <strong className="text-ink uppercase font-mono">{item.method}</strong></span>
                      <span className="text-accent font-semibold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-accent inline-block"></span>
                        Ready
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </main>
    </div>
  );
}
