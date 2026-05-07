'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';
import { useToast } from '@/components/ui/Toast';
import { ErrorState } from './ErrorState';
import { LoadingState } from './LoadingState';

type Phase = 'empty' | 'loading' | 'error';

const ERROR_FALLBACK =
  'Algo salió mal de nuestro lado. Probá de nuevo en unos segundos — si vuelve a fallar, mandanos un mail.';

/**
 * Owns the entire "no list yet" experience and its transitions:
 *   empty → loading → (success → router.refresh) | (error → retry)
 *
 * Lives client-side because the empty / loading / error states all rerender
 * in place without a route change — App Router's `loading.tsx` boundary
 * doesn't apply since we're triggering the work via `fetch`, not a nav.
 *
 * On success, `router.refresh()` re-runs the parent server component so
 * the page re-reads the freshly-persisted `shopping_lists` row and shows
 * the real list. We don't navigate; the URL is already /app/list.
 */
export function EmptyListState() {
  const router = useRouter();
  const { show } = useToast();
  const [phase, setPhase] = useState<Phase>('empty');
  const [errorMessage, setErrorMessage] = useState<string>(ERROR_FALLBACK);

  async function generate() {
    setPhase('loading');
    let res: Response;
    try {
      res = await fetch('/api/shopping-list/generate', { method: 'POST' });
    } catch {
      setErrorMessage(
        'No pudimos llegar al servidor. Revisá tu conexión y probá de nuevo.',
      );
      setPhase('error');
      return;
    }

    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setErrorMessage(body?.error ?? ERROR_FALLBACK);
      setPhase('error');
      return;
    }

    show({ message: 'Lista lista. A comprar.', variant: 'success' });
    // Server component re-runs and renders the real list; this component
    // unmounts. No need to flip phase back — the component is gone.
    router.refresh();
  }

  if (phase === 'loading') return <LoadingState />;
  if (phase === 'error') {
    return <ErrorState message={errorMessage} onRetry={generate} />;
  }

  return (
    <div className="mx-auto max-w-2xl py-16 sm:py-24">
      <GlassCard
        variant="strong"
        className="flex flex-col items-center gap-6 p-10 text-center sm:p-12"
      >
        <span className="inline-flex items-center gap-2 rounded-full border border-hairline bg-glass px-4 py-1.5 font-display text-[10px] font-semibold uppercase tracking-widest text-accent-cyan">
          Lista pendiente
        </span>
        <h1 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Falta el primer paso.
        </h1>
        <p className="max-w-md font-sans text-base leading-relaxed text-white/65">
          Tu plan ya está calculado. Tocá el botón y armamos la lista de la semana
          con los precios más frescos de tu zona.
        </p>
        <Button type="button" variant="primary" size="lg" onClick={generate}>
          Generar mi lista
        </Button>
      </GlassCard>
    </div>
  );
}
