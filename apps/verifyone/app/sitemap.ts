import type { MetadataRoute } from 'next';
import { TOOLS } from '../lib/data/tools';
import { COMPARE } from '../lib/data/compare';

const BASE = process.env.APP_URL || 'https://app.verifyone.io';

export const dynamic = 'force-dynamic';

export default function sitemap(): MetadataRoute.Sitemap {
  // /dashboard is an authenticated app surface and /legal/* is draft text —
  // both are excluded until they are publishable.
  const staticPages = [
    '',
    '/docs',
    '/pricing',
    '/integrations',
    '/for-agents',
    '/for-platforms',
    '/security',
    '/status',
    '/tools',
    '/guides/solo-ai-voice-outbound',
  ].map((p) => ({
    url: `${BASE}${p}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: p === '' ? 1 : 0.7,
  }));

  const toolPages = TOOLS.map((t) => ({
    url: `${BASE}/tools/${t.slug}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));

  const comparePages = (COMPARE as { slug: string }[]).map((c) => ({
    url: `${BASE}/compare/${c.slug}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }));

  return [...staticPages, ...toolPages, ...comparePages];
}
