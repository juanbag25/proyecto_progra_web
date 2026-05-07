'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

interface AppNavLinkProps {
  href: string;
  children: ReactNode;
  /** Optional secondary tone (used by the email link, which is muted). */
  variant?: 'primary' | 'muted';
}

/**
 * Nav link for the /app shell. Centralizes the active-page styling and
 * stamps `aria-current="page"` so screen readers announce which tab the
 * user is on. Without this the SR-only experience reads every link the
 * same regardless of context — a basic a11y win.
 *
 * Active match is prefix-based (`startsWith`) so visiting
 * `/app/list/[id]` still highlights "Mi lista". The root `/app` is the
 * exception: only an exact match counts as active so it doesn't claim
 * every nested route.
 */
export function AppNavLink({ href, children, variant = 'primary' }: AppNavLinkProps) {
  const pathname = usePathname();
  const isActive = href === '/app' ? pathname === '/app' : pathname.startsWith(href);

  const base =
    variant === 'muted'
      ? 'hidden font-sans text-xs transition-colors duration-300 ease-premium sm:inline'
      : 'hidden font-display text-xs font-semibold uppercase tracking-widest transition-colors duration-300 ease-premium sm:inline';

  const tone = isActive ? 'text-accent-cyan' : 'text-white/65 hover:text-accent-cyan';
  const mutedTone = isActive ? 'text-accent-cyan' : 'text-white/55 hover:text-accent-cyan';

  return (
    <Link
      href={href}
      aria-current={isActive ? 'page' : undefined}
      className={`${base} ${variant === 'muted' ? mutedTone : tone}`}
    >
      {children}
    </Link>
  );
}
