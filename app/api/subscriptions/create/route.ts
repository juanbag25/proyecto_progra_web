import { NextResponse } from 'next/server';

import { getUser } from '@/lib/auth';
import { createSubscription } from '@/lib/mercadopago/subscriptions';
import { TIERS, isTierId } from '@/lib/mercadopago/tiers';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * Starts a subscription: creates a Mercado Pago preapproval (status `pending`)
 * and returns its `init_point` so the client can redirect to MP's checkout.
 *
 * The pending row is written with the service-role client (users never write
 * `subscriptions` directly — RLS only grants them read). The webhook (P10.C) is
 * the source of truth for the final status.
 */
export async function POST(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }
  if (!user.email) {
    return NextResponse.json({ error: 'Tu cuenta no tiene un email asociado' }, { status: 400 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 });
  }

  const tier = (payload as { tier?: unknown }).tier;
  if (!isTierId(tier)) {
    return NextResponse.json({ error: 'Tier inválido' }, { status: 400 });
  }

  const t = TIERS[tier];

  // 1) Create the preapproval on Mercado Pago first, so we never leave an orphan
  //    pending row if MP rejects the request.
  let created;
  try {
    created = await createSubscription({ userId: user.id, email: user.email, tier });
  } catch (err) {
    console.error('[subscriptions/create] Mercado Pago error:', err);
    return NextResponse.json(
      { error: `Mercado Pago rechazó la suscripción: ${mpErrorMessage(err)}` },
      { status: 502 },
    );
  }

  // 2) Persist a pending row keyed by the MP id. `ignoreDuplicates` avoids
  //    clobbering a row the webhook may have already created/authorized in a race.
  const admin = createAdminClient();
  const { error: upsertError } = await admin.from('subscriptions').upsert(
    {
      user_id: user.id,
      mp_preapproval_id: created.id,
      tier,
      status: 'pending',
      amount: t.amount,
      currency: t.currency,
      frequency: t.frequency,
      frequency_type: t.frequency_type,
    },
    { onConflict: 'mp_preapproval_id', ignoreDuplicates: true },
  );
  if (upsertError) {
    // The subscription already exists on MP and the webhook will reconcile it,
    // so don't fail the user's checkout over a local write hiccup — just log.
    console.error('[subscriptions/create] could not persist pending row:', upsertError);
  }

  return NextResponse.json({ init_point: created.initPoint });
}

/** Pull a human-readable reason out of a Mercado Pago SDK error. */
function mpErrorMessage(err: unknown): string {
  if (err && typeof err === 'object') {
    const cause = (err as { cause?: unknown }).cause;
    if (Array.isArray(cause)) {
      const descriptions = cause
        .map((c) => (c && typeof c === 'object' ? (c as { description?: string }).description : null))
        .filter((d): d is string => Boolean(d));
      if (descriptions.length) return descriptions.join('; ');
    }
    const message = (err as { message?: unknown }).message;
    if (typeof message === 'string' && message) return message;
  }
  return String(err);
}
