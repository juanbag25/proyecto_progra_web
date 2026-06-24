import { NextResponse } from 'next/server';

import { getUser } from '@/lib/auth';
import { pauseSubscription, resumeSubscription } from '@/lib/mercadopago/subscriptions';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** Toggle the caller's subscription between paused and authorized. */
export async function POST() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const supabase = createClient();
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('id, mp_preapproval_id, status')
    .eq('user_id', user.id)
    .in('status', ['authorized', 'paused'])
    .order('current_period_end', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle<{ id: string; mp_preapproval_id: string | null; status: string }>();

  if (!sub?.mp_preapproval_id) {
    return NextResponse.json({ error: 'No tenés una suscripción activa' }, { status: 404 });
  }

  const resume = sub.status === 'paused';
  try {
    if (resume) await resumeSubscription(sub.mp_preapproval_id);
    else await pauseSubscription(sub.mp_preapproval_id);
  } catch (err) {
    console.error('[subscriptions/pause] Mercado Pago error:', err);
    return NextResponse.json({ error: 'No se pudo actualizar en Mercado Pago' }, { status: 502 });
  }

  const nextStatus = resume ? 'authorized' : 'paused';
  const admin = createAdminClient();
  await admin
    .from('subscriptions')
    .update({ status: nextStatus, updated_at: new Date().toISOString() })
    .eq('id', sub.id);

  return NextResponse.json({ ok: true, status: nextStatus });
}
