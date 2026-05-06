'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { createClient } from '@/lib/supabase/client';

function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const redirectTo = search.get('redirect') ?? '/app';
  const { show } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);

    if (error) {
      show({ message: error.message, variant: 'error' });
      return;
    }
    // router.refresh() so server components re-read the new auth cookies.
    router.replace(redirectTo);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-3xl font-bold tracking-tight text-white">
          Volvé al ruedo
        </h1>
        <p className="font-sans text-sm text-white/65">Tu lista de la semana te está esperando.</p>
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
        autoComplete="current-password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      <Button type="submit" variant="primary" size="lg" disabled={submitting}>
        {submitting ? 'Entrando…' : 'Entrar'}
      </Button>

      <div className="flex items-center justify-between text-xs">
        <Link
          href="/forgot-password"
          className="font-sans text-white/55 transition-colors duration-300 ease-premium hover:text-accent-cyan"
        >
          Olvidaste la password?
        </Link>
        <Link
          href="/sign-up"
          className="font-sans text-white/55 transition-colors duration-300 ease-premium hover:text-accent-cyan"
        >
          Crear cuenta →
        </Link>
      </div>
    </form>
  );
}

export default function LoginPage() {
  // Suspense boundary required by Next.js 14 because `LoginForm` reads
  // useSearchParams() — without it, prerender bails for the whole route.
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
