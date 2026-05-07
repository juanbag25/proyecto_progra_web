'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';

interface RegenerateButtonProps {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  /** First-time generation copy when no targets row exists yet. */
  firstRun?: boolean;
}

export function RegenerateButton({ variant = 'outline', firstRun = false }: RegenerateButtonProps) {
  const router = useRouter();
  const { show } = useToast();
  const [busy, setBusy] = useState(false);

  async function trigger() {
    setBusy(true);
    const res = await fetch('/api/nutrition/targets', { method: 'POST' });
    setBusy(false);

    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      show({
        message: body?.error ?? 'No pudimos calcular tu plan. Probá de nuevo en un rato.',
        variant: 'error',
      });
      return;
    }
    show({
      message: firstRun ? 'Plan generado.' : 'Plan recalculado.',
      variant: 'success',
    });
    router.refresh();
  }

  const idleLabel = firstRun ? 'Generar mi plan' : 'Recalcular plan';
  const busyLabel = firstRun ? 'Generando…' : 'Recalculando…';

  return (
    <Button type="button" variant={variant} size="md" onClick={trigger} disabled={busy}>
      {busy ? busyLabel : idleLabel}
    </Button>
  );
}
