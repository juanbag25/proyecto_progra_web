import 'server-only';

import { createClient } from '@supabase/supabase-js';

/**
 * Admin Supabase client using the SERVICE ROLE key.
 *
 * BYPASSES Row Level Security. Use ONLY for trusted server-only code paths
 * that need to write across users (cron jobs, scrapers, system migrations).
 * The service role key MUST NEVER reach a client bundle — `import 'server-only'`
 * makes Webpack hard-fail if anyone imports this from a client component.
 *
 * For per-user requests, keep using `lib/supabase/server.ts` which inherits
 * the user's auth and runs under their RLS policies.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set');
  if (!serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
