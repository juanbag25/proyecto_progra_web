import Link from 'next/link';
import { type ReactNode } from 'react';
import { GlassCard } from '@/components/ui/GlassCard';
import { ToastProvider } from '@/components/ui/Toast';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-canvas-base bg-mesh-hero px-6 py-12">
        <Link href="/" className="absolute left-6 top-6 flex items-center gap-2">
          <span className="font-display text-xl font-extrabold tracking-tightest">
            Fit<span className="bg-accent-gradient bg-clip-text text-transparent">List</span>
          </span>
        </Link>

        <div className="w-full max-w-md animate-fade-up">
          <GlassCard variant="strong" className="p-10">
            {children}
          </GlassCard>
          <p className="mt-6 text-center font-sans text-xs text-white/35">
            Tu data nunca sale de tu cuenta. RLS-protected en Supabase.
          </p>
        </div>
      </main>
    </ToastProvider>
  );
}
