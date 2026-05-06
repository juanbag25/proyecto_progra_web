import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';

export default function AppHomePage() {
  return (
    <div className="mx-auto max-w-2xl py-20">
      <GlassCard variant="strong" className="flex flex-col items-center gap-6 p-12 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-hairline bg-glass px-4 py-1.5 font-display text-xs uppercase tracking-widest text-accent-cyan">
          Cuenta lista
        </span>
        <h1 className="font-display text-4xl font-bold tracking-tight text-white">
          Aún no tenés tu plan semanal.
        </h1>
        <p className="max-w-md font-sans text-base text-white/65">
          Pasá por el onboarding (cinco minutos) y te armamos la primera lista de compras esta misma
          semana — calibrada a tus macros, tu presupuesto y tu super.
        </p>
        <Link href="/onboarding">
          <Button variant="primary" size="lg">
            Empezar onboarding →
          </Button>
        </Link>
      </GlassCard>
    </div>
  );
}
