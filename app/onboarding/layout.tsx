import type { Metadata } from 'next';
import Link from 'next/link';
import { type ReactNode } from 'react';
import { ToastProvider } from '@/components/ui/Toast';

export const metadata: Metadata = {
  title: 'Onboarding',
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <main className="relative flex min-h-screen flex-col bg-canvas-base bg-mesh-hero">
        <Link
          href="/app"
          className="absolute left-6 top-6 z-10 flex items-center gap-2 font-display text-xl font-extrabold tracking-tightest"
          aria-label="Volver al inicio"
        >
          Fit<span className="bg-accent-gradient bg-clip-text text-transparent">List</span>
        </Link>
        {children}
      </main>
    </ToastProvider>
  );
}
