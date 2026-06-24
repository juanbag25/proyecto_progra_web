import Link from 'next/link';

import { Button } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface SubRow {
  status: string;
  tier: string;
}

/**
 * Landing page after the Mercado Pago checkout (`back_url`).
 *
 * The webhook (P10.C) is the source of truth, so we DON'T flip the user to
 * premium here — we just read the latest subscription row and reflect whatever
 * the webhook has recorded so far (often still `pending` for a few seconds).
 */
export default async function BillingReturnPage() {
  const user = await requireUser();
  const supabase = createClient();

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('status, tier')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<SubRow>();

  const authorized = sub?.status === 'authorized';

  return (
    <div className="mx-auto max-w-2xl py-20">
      <GlassCard variant="strong" className="flex flex-col items-center gap-6 p-12 text-center">
        <span
          className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 font-display text-xs uppercase tracking-widest ${
            authorized
              ? 'border-accent-mint/30 bg-accent-mint/[0.06] text-accent-mint'
              : 'border-hairline bg-glass text-accent-cyan'
          }`}
        >
          {authorized ? 'Suscripción activa' : 'Casi listo'}
        </span>
        <h1 className="font-display text-4xl font-bold tracking-tight text-white">
          {authorized ? '¡Ya sos premium! 💪' : 'Estamos confirmando tu suscripción…'}
        </h1>
        <p className="max-w-md font-sans text-base text-white/65">
          {authorized
            ? 'Tu pago se confirmó y tenés acceso completo a FitList. A darle.'
            : 'Mercado Pago nos está avisando que autorizaste el pago. Suele tardar unos segundos — refrescá esta página o entrá a tu panel y en breve lo vas a ver activo.'}
        </p>
        <Link href="/app">
          <Button variant="primary" size="lg">
            Ir a mi panel →
          </Button>
        </Link>
      </GlassCard>
    </div>
  );
}
