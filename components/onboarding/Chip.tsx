'use client';

import { type ReactNode } from 'react';

interface ChipProps {
  label: ReactNode;
  selected?: boolean;
  onClick: () => void;
  variant?: 'cyan' | 'mint' | 'coral';
}

const VARIANTS: Record<NonNullable<ChipProps['variant']>, { selected: string }> = {
  cyan: {
    selected: 'border-accent-cyan/60 bg-accent-cyan/15 text-accent-cyan shadow-glow-cyan',
  },
  mint: {
    selected: 'border-accent-mint/60 bg-accent-mint/15 text-accent-mint shadow-glow-mint',
  },
  coral: {
    selected: 'border-warn-coral/60 bg-warn-coral/15 text-warn-coral shadow-glow-coral',
  },
};

const idle = 'border-hairline bg-white/[0.04] text-white/70 hover:border-white/15 hover:text-white';

export function Chip({ label, selected = false, onClick, variant = 'cyan' }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 font-sans text-xs transition-all duration-300 ease-premium ${
        selected ? VARIANTS[variant].selected : idle
      }`}
    >
      {label}
    </button>
  );
}
