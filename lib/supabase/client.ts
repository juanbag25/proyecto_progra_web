/**
 * Supabase client for BROWSER / client components.
 *
 * Only uses the public anon key (`NEXT_PUBLIC_*`); all access is gated by
 * Row Level Security policies on the database side.
 *
 * For server components, route handlers, and server actions, import from
 * `@/lib/supabase/server` instead — that variant wires cookies for auth.
 */
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
