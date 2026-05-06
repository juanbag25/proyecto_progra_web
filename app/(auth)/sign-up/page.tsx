'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { createClient } from '@/lib/supabase/client';

const MIN_PASSWORD = 8;

export default function SignUpPage() {
  const { show } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

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
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setSubmitting(false);

    if (error) {
      show({ message: error.message, variant: 'error' });
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="flex flex-col gap-4 text-center">
        <h1 className="font-display text-3xl font-bold tracking-tight text-white">Mail enviado.</h1>
        <p className="font-sans text-sm text-white/70">
          Te mandamos un link a <span className="text-accent-cyan">{email}</span> para confirmar tu
          cuenta. Cliquealo y arrancamos el onboarding.
        </p>
        <Link
          href="/login"
          className="font-sans text-xs text-white/45 hover:text-accent-cyan"
          aria-label="Volver al login"
        >
          ← Volver al login
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-3xl font-bold tracking-tight text-white">Crear cuenta</h1>
        <p className="font-sans text-sm text-white/65">
          El primer paso para no abrir Excel nunca más.
        </p>
      </header>

      <Input
        label="Email"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <Input
        label="Password"
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
        {submitting ? 'Creando…' : 'Crear cuenta'}
      </Button>

      <Link
        href="/login"
        className="text-center font-sans text-xs text-white/55 transition-colors duration-300 ease-premium hover:text-accent-cyan"
      >
        Ya tenés cuenta? Entrar →
      </Link>
    </form>
  );
}
