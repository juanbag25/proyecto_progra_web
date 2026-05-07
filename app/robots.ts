import type { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://fitlist.app';

/**
 * Robots policy for FitList.
 *
 * Public surface (landing, design system, legal pages) is fully indexable
 * so we can be discovered. Everything behind auth or for internal tooling
 * is blocked — those routes need a session anyway, but blocking them at
 * the crawler level avoids leaking URL patterns into search engines.
 *
 * `/api/*` is blocked because the endpoints serve JSON, not user-facing
 * content; indexing them would only produce noise. `/dev/*` is admin
 * tooling and shouldn't appear anywhere public.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/app/', '/dev/', '/api/', '/onboarding/', '/auth/'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
