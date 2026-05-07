'use client';

import { Button } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';

interface ErrorStateProps {
  /** Human-readable message — pass the error from the failed action. */
  message: string;
  /** Fires when the user clicks "Reintentar". Parent re-runs the action. */
  onRetry: () => void;
  /** Optional override for the report link target. Defaults to a mailto. */
  reportHref?: string;
}

/**
 * Shown when /api/shopping-list/generate (or similar) returns a non-2xx.
 * Coral border so it reads as "something's off" without crying wolf.
 *
 * The "Reintentar" path is the primary recovery — most failures are
 * transient (Vercel cold start, scrape DB blip). The report link is the
 * escape hatch when retry doesn't help and the user wants us to know.
 */
export function ErrorState({
  message,
  onRetry,
  reportHref = 'mailto:jgramaglia@metanoia.net.ar?subject=FitList%20%E2%80%94%20problema%20generando%20la%20lista',
}: ErrorStateProps) {
  return (
    <div className="mx-auto max-w-2xl py-16 sm:py-24">
      <GlassCard
        variant="strong"
        className="flex flex-col items-center gap-6 border-warn-coral/30 p-10 text-center sm:p-12"
      >
        <span className="inline-flex items-center gap-2 rounded-full border border-warn-coral/40 bg-warn-coral/[0.08] px-4 py-1.5 font-display text-[10px] font-semibold uppercase tracking-widest text-warn-coral">
          Algo falló
        </span>
        <h1 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
          No pudimos armar tu lista.
        </h1>
        <p className="max-w-md font-sans text-sm leading-relaxed text-white/65">
          {message}
        </p>
        <div className="flex flex-col items-center gap-3">
          <Button type="button" variant="primary" size="lg" onClick={onRetry}>
            Reintentar
          </Button>
          <a
            href={reportHref}
            className="font-sans text-xs text-white/55 underline-offset-4 transition-colors duration-300 ease-premium hover:text-accent-cyan hover:underline"
          >
            Reportar un problema
          </a>
        </div>
      </GlassCard>
    </div>
  );
}
