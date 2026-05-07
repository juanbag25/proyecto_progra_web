'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost';

interface RegenerateListButtonProps {
  variant?: ButtonVariant;
  /** Copy variant for first-time generation when no list row exists yet. */
  firstRun?: boolean;
}

/**
 * Calls POST /api/shopping-list/generate and refreshes the route on success
 * so the server component re-reads the new list/items rows. Distinct from
 * `RegenerateButton` (in components/nutrition/) — that one recalculates
 * macro targets, this one rebuilds the weekly cart from current candidates.
 */
export function RegenerateListButton({
  variant = 'ghost',
  firstRun = false,
}: RegenerateListButtonProps) {
  const router = useRouter();
  const { show } = useToast();
  const [busy, setBusy] = useState(false);

  async function trigger() {
    setBusy(true);
    const res = await fetch('/api/shopping-list/generate', { method: 'POST' });
    setBusy(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      show({
        message: body?.error ?? 'No pudimos armar la lista. Probá de nuevo.',
        variant: 'error',
      });
      return;
    }
    show({
      message: firstRun ? 'Lista lista. A comprar.' : 'Lista regenerada con precios frescos.',
      variant: 'success',
    });
    router.refresh();
  }

  const idle = firstRun ? 'Generar mi lista' : 'Regenerar';
  const busyLabel = firstRun ? 'Armando…' : 'Regenerando…';

  return (
    <Button type="button" variant={variant} size="md" onClick={trigger} disabled={busy}>
      {busy ? busyLabel : idle}
    </Button>
  );
}
