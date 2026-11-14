import type { MetadataRoute } from 'next';

const BASE = process.env.APP_URL || 'https://app.verifyone.io';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: ['/api/', '/dashboard'] },
      // AI agents are WELCOME — this product is agent-first
      { userAgent: ['GPTBot', 'ClaudeBot', 'Claude-Web', 'PerplexityBot', 'CCBot'], allow: '/' },
    ],
    sitemap: `${BASE}/sitemap.xml`,
  };
}
