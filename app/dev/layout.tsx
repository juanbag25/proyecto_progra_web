import Link from 'next/link';
import { notFound } from 'next/navigation';
import { type ReactNode } from 'react';
import { ToastProvider } from '@/components/ui/Toast';

/**
 * /dev/* is gated to local development. NODE_ENV is 'production' in Vercel
 * preview AND production deploys, so this layout 404s anywhere except
 * `npm run dev`. The pages inside use the service role key (admin client)
 * which we never want exposed via a public route.
 */
export default function DevLayout({ children }: { children: ReactNode }) {
  if (process.env.NODE_ENV !== 'development') {
    notFound();
  }

  return (
    <ToastProvider>
      <div className="min-h-screen bg-canvas-base text-white">
        <header className="sticky top-0 z-30 border-b border-hairline bg-canvas-base/80 backdrop-blur-glass">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            <div className="flex items-center gap-6">
              <Link href="/" className="font-display text-xl font-extrabold tracking-tightest">
                Fit<span className="bg-accent-gradient bg-clip-text text-transparent">List</span>
                <span className="ml-2 rounded-full border border-warn-coral/40 bg-warn-coral/[0.08] px-2 py-0.5 align-middle font-sans text-[10px] uppercase tracking-widest text-warn-coral">
                  dev
                </span>
              </Link>
              <nav className="flex items-center gap-4 font-sans text-xs text-white/55">
                <DevNavLink href="/dev/products">Productos</DevNavLink>
                <DevNavLink href="/dev/foods">Foods</DevNavLink>
              </nav>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
      </div>
    </ToastProvider>
  );
}

function DevNavLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="transition-colors duration-300 ease-premium hover:text-accent-cyan"
    >
      {children}
    </Link>
  );
}
