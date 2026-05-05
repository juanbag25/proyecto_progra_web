/**
 * GET /api/health
 *
 * Smoke-test endpoint that proves the Supabase env vars are wired and the
 * project is reachable. No table access is required, so this works even
 * before any migrations run.
 *
 * Used by:
 *   - Local sanity check during P0.C setup.
 *   - Vercel deploy verification.
 *   - (Future) uptime monitoring.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Always run on the server with fresh data — never cache the response.
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = createClient();
    // `auth.getSession()` is the cheapest call that actually round-trips to
    // Supabase: validates URL + anon key without requiring any tables.
    const { error } = await supabase.auth.getSession();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
