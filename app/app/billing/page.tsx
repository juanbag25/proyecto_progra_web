import { ManageSubscription } from '@/components/billing/ManageSubscription';
import { PricingCard } from '@/components/billing/PricingCard';
import { GlassCard } from '@/components/ui/GlassCard';
import { requireUser } from '@/lib/auth';
import { getEntitlement } from '@/lib/entitlements';
import { formatARS, formatDate } from '@/lib/format';
import { syncUserSubscription } from '@/lib/mercadopago/reconcile';
import { TIERS } from '@/lib/mercadopago/tiers';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const DAY_MS = 86_400_000;

interface PaymentRow {
  id: string;
  amount: number | string | null;
  status: string | null;
  paid_at: string | null;
}

export default async function BillingPage() {
  const user = await requireUser();
  // Self-heal: if the latest sub is still `pending` locally (webhook not landed
  // yet), pull its real status from MP before computing access.
  await syncUserSubscription(user.id);
  const supabase = createClient();
  const ent = await getEntitlement(supabase, user);

  if (ent.reason === 'subscription' && ent.tier) {
    const tier = TIERS[ent.tier];
    const { data: payments } = await supabase
      .from('subscription_payments')
      .select('id, amount, status, paid_at')
      .eq('user_id', user.id)
      .order('paid_at', { ascending: false, nullsFirst: false })
      .limit(10);

    return (
      <div className="mx-auto max-w-2xl space-y-8 py-6">
        <header className="space-y-2">
          <h1 className="font-display text-3xl font-bold tracking-tight">Tu suscripción</h1>
          <p className="font-sans text-white/60">Gestioná tu plan FitList Premium.</p>
        </header>

        <GlassCard variant="strong" className="space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-display text-2xl font-bold">FitList {tier.label}</p>
              <p className="font-sans text-sm text-white/55">
                {formatARS(tier.amount)} /{tier.id === 'annual' ? 'año' : 'mes'}
              </p>
            </div>
            <StatusPill status={ent.status} />
          </div>
          {ent.currentPeriodEnd && (
            <p className="font-sans text-sm text-white/65">
              {ent.status === 'paused' ? 'Acceso hasta' : 'Próximo cobro'}:{' '}
              <span className="tabular text-white">{formatDate(ent.currentPeriodEnd)}</span>
            </p>
          )}
          <ManageSubscription status={ent.status ?? 'authorized'} />
        </GlassCard>

        <section className="space-y-3">
          <h2 className="font-display text-lg font-semibold text-white/80">Historial de pagos</h2>
          {payments && payments.length > 0 ? (
            <ul className="divide-y divide-hairline overflow-hidden rounded-2xl border border-hairline">
              {(payments as PaymentRow[]).map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-4 bg-glass px-5 py-3">
                  <span className="font-sans text-sm text-white/70">
                    {p.paid_at ? formatDate(p.paid_at) : '—'}
                  </span>
                  <span className="font-sans text-xs uppercase tracking-wide text-white/45">
                    {p.status ?? '—'}
                  </span>
                  <span className="tabular font-display text-sm font-semibold">
                    {p.amount != null ? formatARS(p.amount) : '—'}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="font-sans text-sm text-white/45">Todavía no hay cobros registrados.</p>
          )}
        </section>
      </div>
    );
  }

  // Not subscribed → show pricing, plus a trial countdown or an expired notice.
  const trialEnd = new Date(ent.trialEndsAt);
  const daysLeft = Math.max(0, Math.ceil((trialEnd.getTime() - Date.now()) / DAY_MS));

  return (
    <div className="mx-auto max-w-3xl space-y-8 py-6">
      <header className="space-y-3 text-center">
        <h1 className="font-display text-4xl font-bold tracking-tight">Sumate a FitList Premium</h1>
        <p className="mx-auto max-w-xl font-sans text-white/60">
          Tu plan semanal calibrado a tus macros, tu presupuesto y tu súper. Elegí cómo querés
          arrancar.
        </p>
        {ent.reason === 'trial' ? (
          <span className="inline-flex items-center gap-2 rounded-full border border-accent-cyan/30 bg-accent-cyan/[0.06] px-4 py-1.5 font-display text-xs uppercase tracking-widest text-accent-cyan">
            Te {daysLeft === 1 ? 'queda' : 'quedan'} {daysLeft} {daysLeft === 1 ? 'día' : 'días'} de
            prueba
          </span>
        ) : (
          <span className="inline-flex items-center gap-2 rounded-full border border-warn-coral/30 bg-warn-coral/[0.06] px-4 py-1.5 font-display text-xs uppercase tracking-widest text-warn-coral">
            Tu prueba terminó — activá tu plan para seguir
          </span>
        )}
      </header>

      <div className="grid gap-5 sm:grid-cols-2">
        <PricingCard tier={TIERS.monthly} />
        <PricingCard tier={TIERS.annual} highlight />
      </div>

      <p className="text-center font-sans text-xs text-white/40">
        Cobro recurrente vía Mercado Pago. Cancelás cuando quieras desde acá.
      </p>
    </div>
  );
}

function StatusPill({ status }: { status: string | null }) {
  const map: Record<string, { label: string; cls: string }> = {
    authorized: {
      label: 'Activa',
      cls: 'border-accent-mint/30 bg-accent-mint/[0.06] text-accent-mint',
    },
    paused: {
      label: 'Pausada',
      cls: 'border-warn-orange/30 bg-warn-orange/[0.06] text-warn-orange',
    },
    pending: { label: 'Pendiente', cls: 'border-hairline bg-glass text-white/60' },
    cancelled: {
      label: 'Cancelada',
      cls: 'border-warn-coral/30 bg-warn-coral/[0.06] text-warn-coral',
    },
  };
  const s = map[status ?? ''] ?? map.pending;
  return (
    <span
      className={`inline-flex flex-shrink-0 items-center rounded-full border px-3 py-1 font-display text-xs uppercase tracking-widest ${s.cls}`}
    >
      {s.label}
    </span>
  );
}
