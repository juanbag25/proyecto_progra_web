/**
 * Supabase client for SERVER components, route handlers, and server actions.
 *
 * Uses the cookie store from `next/headers` so auth state stays in sync with
 * the user's session. Always call `createClient()` per-request — never cache
 * across requests.
 *
 * For browser/client components, import from `@/lib/supabase/client` instead.
 */
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // `setAll` called from a Server Component — safe to ignore as long
            // as middleware (added in Phase 2) is refreshing the session.
          }
        },
      },
    },
  );
}
