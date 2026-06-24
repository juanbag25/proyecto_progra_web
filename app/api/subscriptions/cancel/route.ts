import { NextResponse } from 'next/server';

import { getUser } from '@/lib/auth';
import { cancelSubscription } from '@/lib/mercadopago/subscriptions';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** Cancel the caller's active subscription (terminal). */
export async function POST() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  // Ownership is enforced by RLS: this read only returns the caller's own row.
  const supabase = createClient();
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('id, mp_preapproval_id')
    .eq('user_id', user.id)
    .in('status', ['authorized', 'paused'])
    .order('current_period_end', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle<{ id: string; mp_preapproval_id: string | null }>();

  if (!sub?.mp_preapproval_id) {
    return NextResponse.json({ error: 'No tenés una suscripción activa' }, { status: 404 });
  }

  try {
    await cancelSubscription(sub.mp_preapproval_id);
  } catch (err) {
    console.error('[subscriptions/cancel] Mercado Pago error:', err);
    return NextResponse.json({ error: 'No se pudo cancelar en Mercado Pago' }, { status: 502 });
  }

  // Optimistic local update; the webhook will also sync the cancelled status.
  const admin = createAdminClient();
  await admin
    .from('subscriptions')
    .update({
      status: 'cancelled',
      cancel_at_period_end: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sub.id);

  return NextResponse.json({ ok: true });
}
