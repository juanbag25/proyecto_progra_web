'use client';

import { useState } from 'react';
import { GlassCard } from './GlassCard';

interface GroceryCardProps {
  title: string;
  store: string;
  /** Pre-formatted price string (e.g. "$8.450 ARS"). */
  price: string;
  /** Macro/calorie summary (e.g. "165 kcal · 31g protein"). */
  macro: string;
  /** Single emoji standing in for a transparent food PNG. */
  emoji?: string;
  /** Tailwind gradient class applied to the image disc, e.g. "from-accent-cyan to-accent-mint". */
  accent?: string;
}

export function GroceryCard({
  title,
  store,
  price,
  macro,
  emoji = '🥗',
  accent = 'from-accent-cyan to-accent-mint',
}: GroceryCardProps) {
  const [checked, setChecked] = useState(false);

  return (
    <GlassCard
      className={[
        'relative flex items-center gap-4 transition-all duration-500 ease-premium',
        checked ? 'scale-[0.98] opacity-60' : 'hover:-translate-y-1 hover:border-white/10',
      ].join(' ')}
    >
      <div
        className={[
          'relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-3xl shadow-[0_12px_32px_-8px_rgba(0,240,255,0.4)] transition-transform duration-500 ease-premium',
          accent,
          checked ? 'rotate-[-8deg] scale-90' : 'group-hover:rotate-3',
        ].join(' ')}
        aria-hidden
      >
        <span className="drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]">{emoji}</span>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h4
          className={[
            'font-display text-base font-semibold text-white transition-all duration-300',
            checked ? 'line-through decoration-accent-mint decoration-2' : '',
          ].join(' ')}
        >
          {title}
        </h4>
        <span className="font-sans text-[11px] uppercase tracking-widest text-white/45">
          {store}
        </span>
        <div className="mt-2 flex items-baseline gap-3">
          <span className="tabular font-display text-lg font-bold text-accent-cyan">{price}</span>
          <span className="font-sans text-[11px] text-white/55">{macro}</span>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setChecked((v) => !v)}
        aria-pressed={checked}
        aria-label={checked ? 'Mark as not purchased' : 'Mark as purchased'}
        className={[
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-all duration-300 ease-premium',
          checked
            ? 'border-accent-mint bg-accent-mint text-canvas-base shadow-glow-mint'
            : 'border-hairline bg-white/[0.04] text-white/70 hover:border-accent-cyan/60 hover:text-accent-cyan hover:shadow-glow-cyan',
        ].join(' ')}
      >
        {checked ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        )}
      </button>
    </GlassCard>
  );
}
