'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { createClient } from '@/lib/supabase/client';

const MIN_PASSWORD = 8;

export default function ResetPasswordPage() {
  const router = useRouter();
  const { show } = useToast();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (password.length < MIN_PASSWORD) {
      show({
        message: `La password tiene que ser de al menos ${MIN_PASSWORD} caracteres.`,
        variant: 'error',
      });
      return;
    }
    if (password !== confirm) {
      show({ message: 'Las passwords no coinciden.', variant: 'error' });
      return;
    }

    setSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setSubmitting(false);

    if (error) {
      show({ message: error.message, variant: 'error' });
      return;
    }
    show({ message: 'Password actualizada. Te llevamos a tu cuenta.', variant: 'success' });
    router.replace('/app');
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-3xl font-bold tracking-tight text-white">
          Nueva password
        </h1>
        <p className="font-sans text-sm text-white/65">Decila fuerte. Esta vez sí.</p>
      </header>

      <Input
        label="Nueva password"
        type="password"
        autoComplete="new-password"
        required
        minLength={MIN_PASSWORD}
        helperText={`Mínimo ${MIN_PASSWORD} caracteres.`}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <Input
        label="Confirmar password"
        type="password"
        autoComplete="new-password"
        required
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
      />

      <Button type="submit" variant="primary" size="lg" disabled={submitting}>
        {submitting ? 'Actualizando…' : 'Actualizar password'}
      </Button>
    </form>
  );
}
