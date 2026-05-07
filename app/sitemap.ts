import type { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://fitlist.app';

/**
 * Sitemap of the public surface area. Mirrors the `allow` list in
 * `app/robots.ts`: only routes that are actually reachable without a
 * session belong here. `/design-system` is included because it's a
 * legitimate showcase that doubles as marketing for the brand stack;
 * `/onboarding` and `/app/*` stay out because they require auth.
 *
 * Adding new public routes (legal pages, blog, etc.) means appending
 * here AND making sure `robots.ts` doesn't disallow them.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    {
      url: `${SITE_URL}/`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    {
      url: `${SITE_URL}/design-system`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    // /login + /sign-up are intentionally excluded — they're functional
    // entry points (noindex'd by the (auth) layout), not content worth
    // surfacing in search results.
  ];
}
