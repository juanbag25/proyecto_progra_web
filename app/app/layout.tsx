import Link from 'next/link';
import { type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { requireUser } from '@/lib/auth';

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();

  return (
    <div className="min-h-screen bg-canvas-base text-white">
      <header className="sticky top-0 z-30 border-b border-hairline bg-canvas-base/70 backdrop-blur-glass">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/app" className="flex items-center gap-2">
            <span className="font-display text-xl font-extrabold tracking-tightest">
              Fit<span className="bg-accent-gradient bg-clip-text text-transparent">List</span>
            </span>
          </Link>

          <div className="flex items-center gap-4">
            <Link
              href="/app/profile"
              className="hidden font-sans text-xs text-white/55 transition-colors duration-300 ease-premium hover:text-accent-cyan sm:inline"
            >
              {user.email}
            </Link>
            <form action="/auth/signout" method="post">
              <Button type="submit" variant="ghost" size="sm">
                Salir
              </Button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
    </div>
  );
}
