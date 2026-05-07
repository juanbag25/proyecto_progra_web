import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';

/**
 * Rendered automatically by Next when /app/list/[id] calls notFound() —
 * either because the id is malformed, owned by a different user (RLS
 * filtered it out), or genuinely doesn't exist. We don't distinguish: a
 * single "doesn't exist for you" message covers all three.
 */
export default function PastListNotFound() {
  return (
    <div className="mx-auto max-w-2xl py-20">
      <GlassCard
        variant="strong"
        className="flex flex-col items-center gap-4 p-10 text-center"
      >
        <h1 className="font-display text-2xl font-bold tracking-tight text-white">
          Esa lista no existe.
        </h1>
        <p className="font-sans text-sm text-white/60">
          Quizás cambió la URL, o nunca fue tuya. Volvé al historial.
        </p>
        <Link href="/app/history">
          <Button variant="primary" size="md">
            Ir al historial
          </Button>
        </Link>
      </GlassCard>
    </div>
  );
}
