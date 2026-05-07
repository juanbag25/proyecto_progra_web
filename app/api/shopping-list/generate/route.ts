import { NextResponse } from 'next/server';
import { generateAndPersistShoppingList } from '@/lib/optimizer/generate';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
// Optimizer is fast (<200ms typically), but loading 1k+ candidates over the
// network adds variance. 30s gives plenty of headroom on Vercel hobby.
export const maxDuration = 30;

export async function POST() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await generateAndPersistShoppingList(supabase, user.id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result.list);
}
