import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface PatchBody {
  checked?: unknown;
}

interface UpdatedRow {
  id: string;
  checked: boolean;
}

/**
 * PATCH /api/shopping-list/items/[id]/check
 * Body: { checked: boolean }
 *
 * Sets the explicit checked state (not a server-side toggle) so the client
 * stays the source of truth for the optimistic UI — eliminates the race
 * where a stale double-tap inverts the value the user just saw.
 *
 * Ownership is enforced by the "users manage own list items" RLS policy on
 * shopping_list_items: the EXISTS subquery against shopping_lists.user_id
 * means a user trying to flip somebody else's item gets an empty update
 * (PostgREST returns the rows it was allowed to touch, so a 404 is the
 * correct response in that case — no row matched the id under our policies).
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as PatchBody | null;
  if (typeof body?.checked !== 'boolean') {
    return NextResponse.json(
      { error: 'Body must include `checked: boolean`' },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from('shopping_list_items')
    .update({ checked: body.checked })
    .eq('id', params.id)
    .select('id, checked')
    .limit(1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const row = (data as UpdatedRow[] | null)?.[0];
  if (!row) {
    return NextResponse.json({ error: 'Item not found' }, { status: 404 });
  }
  return NextResponse.json(row);
}
