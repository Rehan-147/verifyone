import Link from 'next/link';
import { INTEGRATIONS } from '../../lib/integrations/catalog-100';

export const metadata = {
  title: '100+ Integrations Catalog | VerifyOne',
  description: 'Connect VerifyOne validation to HubSpot, Salesforce, Zapier, Make, n8n, Google Sheets, and 100+ platforms with no code.',
};

export default function IntegrationsPage() {
  const categories = Array.from(new Set(INTEGRATIONS.map((i) => i.category)));

  return (
    <div className="min-h-screen bg-[#0A0F1E] text-white">
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
        <header className="text-center mb-16">
          <span className="inline-block rounded-full bg-[#A3E635]/10 border border-[#A3E635]/30 px-4 py-1 text-xs font-semibold text-[#A3E635] tracking-widest uppercase mb-4">
            Ecosystem Directory
          </span>
          <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-4">
            Connect VerifyOne with 100+ Tools
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Sanitize leads as they enter your CRM, trigger validations from Google Sheets, or orchestrate automated flows via Zapier, Make, and n8n.
          </p>
        </header>

        {/* Featured native platforms banner */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-16">
          {[
            { name: 'Zapier', status: 'Official App', desc: 'Trigger on new lead or form submission' },
            { name: 'HubSpot', status: 'Native Webhook', desc: 'Auto-scrub contacts on entry' },
            { name: 'Google Sheets', status: '=VERIFYONE()', desc: 'Apps Script custom formula' },
            { name: 'n8n / Make', status: 'Pre-built Flows', desc: 'Self-hosted and cloud orchestration' },
          ].map((feat) => (
            <div key={feat.name} className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-[#A3E635]/10 text-[#A3E635] border border-[#A3E635]/20">
                {feat.status}
              </span>
              <h3 className="font-bold text-lg text-white mt-3 mb-1">{feat.name}</h3>
              <p className="text-xs text-gray-400">{feat.desc}</p>
            </div>
          ))}
        </div>

        {/* Full 100 integrations catalog by category */}
        {categories.map((category) => {
          const list = INTEGRATIONS.filter((i) => i.category === category);
          return (
            <section key={category} className="mb-14">
              <h2 className="text-xl font-bold uppercase tracking-wider text-gray-300 border-b border-white/10 pb-3 mb-6 flex items-center justify-between">
                <span>{category}</span>
                <span className="text-xs bg-white/10 px-2 py-0.5 rounded-full font-mono text-[#A3E635]">
                  {list.length} Apps
                </span>
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {list.map((item) => (
                  <div
                    key={item.slug}
                    className="rounded-xl border border-white/10 bg-white/5 p-4 hover:border-[#A3E635]/30 transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-bold text-base text-white">{item.name}</span>
                        <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-white/10 text-gray-300">
                          {item.difficulty}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mb-4">{item.description}</p>
                    </div>

                    <div className="pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-gray-500">
                      <span>Method: <strong className="text-gray-300 uppercase">{item.method}</strong></span>
                      <span className="text-[#A3E635] font-semibold">Ready</span>
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
