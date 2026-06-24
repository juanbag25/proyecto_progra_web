'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';
import { useToast } from '@/components/ui/Toast';
import { formatARS } from '@/lib/format';
import type { Tier } from '@/lib/mercadopago/tiers';

export function PricingCard({ tier, highlight = false }: { tier: Tier; highlight?: boolean }) {
  const [loading, setLoading] = useState(false);
  const { show } = useToast();

  async function subscribe() {
    setLoading(true);
    try {
      const res = await fetch('/api/subscriptions/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier: tier.id }),
      });
      const data = (await res.json().catch(() => ({}))) as { init_point?: string; error?: string };
      if (!res.ok || !data.init_point) {
        throw new Error(data.error ?? 'No pudimos iniciar la suscripción');
      }
      // Hand off to Mercado Pago's hosted checkout.
      window.location.href = data.init_point;
    } catch (err) {
      setLoading(false);
      show({
        message: err instanceof Error ? err.message : 'Error inesperado',
        variant: 'error',
      });
    }
  }

  const period = tier.id === 'annual' ? 'año' : 'mes';

  return (
    <GlassCard
      variant={highlight ? 'strong' : 'default'}
      className={`flex flex-col gap-5 ${highlight ? 'border border-accent-mint/30 shadow-glow-mint' : ''}`}
    >
      {highlight && (
        <span className="self-start rounded-full bg-accent-gradient px-3 py-1 font-display text-[10px] font-bold uppercase tracking-widest text-canvas-base">
          Mejor precio
        </span>
      )}
      <div>
        <p className="font-display text-xl font-bold">{tier.label}</p>
        <p className="mt-1 font-sans text-sm text-white/55">{tier.blurb}</p>
      </div>
      <p className="flex items-baseline gap-1">
        <span className="tabular font-display text-4xl font-extrabold">{formatARS(tier.amount)}</span>
        <span className="font-sans text-sm text-white/50">/{period}</span>
      </p>
      <Button
        variant={highlight ? 'primary' : 'secondary'}
        size="lg"
        onClick={subscribe}
        disabled={loading}
        className="mt-auto w-full"
      >
        {loading ? 'Redirigiendo…' : 'Suscribirme'}
      </Button>
    </GlassCard>
  );
}
