import { NextResponse } from 'next/server';
import { generateAndPersistTargets } from '@/lib/nutrition/generate';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
// LLM call may take 5-15s; default Vercel hobby max is 10s, raise headroom.
export const maxDuration = 30;

export async function POST() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await generateAndPersistTargets(supabase, user.id);
  if (!result.ok) {
    const body: Record<string, unknown> = { error: result.error };
    if (result.missing) body.missing = result.missing;
    return NextResponse.json(body, { status: result.status });
  }

  return NextResponse.json({ ok: true, targets: result.targets });
}
