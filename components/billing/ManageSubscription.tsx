'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';

export function ManageSubscription({ status }: { status: string }) {
  const router = useRouter();
  const { show } = useToast();
  const [busy, setBusy] = useState<null | 'pause' | 'cancel'>(null);

  const paused = status === 'paused';

  async function act(kind: 'pause' | 'cancel') {
    if (kind === 'cancel' && !window.confirm('¿Seguro que querés cancelar tu suscripción?')) {
      return;
    }
    setBusy(kind);
    try {
      const res = await fetch(`/api/subscriptions/${kind}`, { method: 'POST' });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'No se pudo completar la acción');
      show({
        message:
          kind === 'cancel'
            ? 'Suscripción cancelada.'
            : paused
              ? 'Suscripción reanudada.'
              : 'Suscripción pausada.',
        variant: 'success',
      });
      router.refresh();
    } catch (err) {
      show({
        message: err instanceof Error ? err.message : 'Error inesperado',
        variant: 'error',
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap gap-3 pt-1">
      <Button variant="secondary" size="sm" onClick={() => act('pause')} disabled={busy !== null}>
        {busy === 'pause' ? '…' : paused ? 'Reanudar' : 'Pausar'}
      </Button>
      <Button variant="ghost" size="sm" onClick={() => act('cancel')} disabled={busy !== null}>
        {busy === 'cancel' ? '…' : 'Cancelar'}
      </Button>
    </div>
  );
}
