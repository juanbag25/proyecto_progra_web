'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { createClient } from '@/lib/supabase/client';

export default function ForgotPasswordPage() {
  const { show } = useToast();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
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
        <h1 className="font-display text-3xl font-bold tracking-tight text-white">
          Revisá tu mail.
        </h1>
        <p className="font-sans text-sm text-white/70">
          Si existe una cuenta con <span className="text-accent-cyan">{email}</span>, te mandamos un
          link para resetear la password.
        </p>
        <Link href="/login" className="font-sans text-xs text-white/45 hover:text-accent-cyan">
          ← Volver al login
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-3xl font-bold tracking-tight text-white">
          Resetear password
        </h1>
        <p className="font-sans text-sm text-white/65">
          Decinos tu mail y te mandamos un link para elegir una nueva.
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

      <Button type="submit" variant="primary" size="lg" disabled={submitting}>
        {submitting ? 'Enviando…' : 'Enviar link'}
      </Button>

      <Link
        href="/login"
        className="text-center font-sans text-xs text-white/55 transition-colors duration-300 ease-premium hover:text-accent-cyan"
      >
        ← Volver al login
      </Link>
    </form>
  );
}
