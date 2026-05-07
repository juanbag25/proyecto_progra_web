import type { Metadata } from 'next';
import Link from 'next/link';
import { type ReactNode } from 'react';
import { AppNavLink } from '@/components/app/AppNavLink';
import { Button } from '@/components/ui/Button';
import { ToastProvider } from '@/components/ui/Toast';
import { requireUser } from '@/lib/auth';

// Defense-in-depth: robots.ts already disallows /app/* at the crawler
// level, but stamping noindex into the rendered <head> means even a
// search engine that ignores robots.txt (or a human sharing the URL into
// a bot-scraped channel) won't surface the user's private app surface.
export const metadata: Metadata = {
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();

  return (
    <ToastProvider>
      <div className="min-h-screen bg-canvas-base text-white">
        <header className="sticky top-0 z-30 border-b border-hairline bg-canvas-base/70 backdrop-blur-glass">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            <Link href="/app" className="flex items-center gap-2">
              <span className="font-display text-xl font-extrabold tracking-tightest">
                Fit<span className="bg-accent-gradient bg-clip-text text-transparent">List</span>
              </span>
            </Link>

            <nav aria-label="Navegación principal" className="flex items-center gap-4">
              <AppNavLink href="/app/list">Mi lista</AppNavLink>
              <AppNavLink href="/app/history">Historial</AppNavLink>
              <AppNavLink href="/app/feedback">Feedback</AppNavLink>
              <AppNavLink href="/app/profile" variant="muted">
                {user.email}
              </AppNavLink>
              <form action="/auth/signout" method="post">
                <Button type="submit" variant="ghost" size="sm">
                  Salir
                </Button>
              </form>
            </nav>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
      </div>
    </ToastProvider>
  );
}
