'use client';

import { useEffect, useState } from 'react';
import { GlassCard } from '@/components/ui/GlassCard';

/**
 * Full-screen "we're cooking" state shown while POST /api/shopping-list/generate
 * runs (typically 2–3s in v1). Three pieces:
 *   - Pulsing radial circle as visual anchor.
 *   - Rotating motivational copy (one line every 3s) so the wait feels
 *     intentional rather than empty.
 *   - Skeleton item rows underneath that hint at what's coming.
 *
 * Only used during the FIRST generation (Empty → Loading transition). When
 * regenerating an already-existing list we keep the current data on screen
 * and let the button report "Regenerando…" — swapping to a skeleton would
 * feel like a regression for the user.
 */

const ROTATING_COPY = [
  'Buscando los mejores precios para vos…',
  'Comparando 3 supermercados…',
  'Ajustando tu lista para tu objetivo…',
  'Casi listo. Una decisión menos en tu semana.',
];

const ROTATION_MS = 3000;

export function LoadingState() {
  const [copyIndex, setCopyIndex] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setCopyIndex((i) => (i + 1) % ROTATING_COPY.length);
    }, ROTATION_MS);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="flex flex-col gap-8 py-6">
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-6 px-4 text-center">
        <PulsingRing />
        {/* `key` forces a remount on every rotation so the fade-up animation
            re-triggers — the line *appears* rather than swapping mid-frame. */}
        <p
          key={copyIndex}
          className="font-display text-lg font-semibold tracking-tight text-white animate-fade-up motion-reduce:animate-none"
          aria-live="polite"
        >
          {ROTATING_COPY[copyIndex]}
        </p>
        <p className="font-sans text-xs text-white/40">
          Esto suele tomar 2 a 5 segundos.
        </p>
      </div>

      {/* Skeleton rows — match the real ItemCard's footprint so the page
          doesn't shift when the real items render. */}
      <div className="flex flex-col gap-3" aria-hidden>
        <SkeletonItem />
        <SkeletonItem />
        <SkeletonItem />
        <SkeletonItem />
      </div>
    </div>
  );
}

function PulsingRing() {
  // Two concentric rings: an outer ping for the slow reach-out, an inner
  // pulse for the heartbeat. Tailwind's animate-ping/-pulse handle both.
  return (
    <div
      className="relative h-32 w-32"
      role="status"
      aria-label="Generando tu lista"
    >
      <span className="absolute inset-0 rounded-full bg-accent-cyan/15 motion-safe:animate-ping" />
      <span className="absolute inset-3 rounded-full border border-accent-cyan/40 bg-accent-cyan/10 motion-safe:animate-pulse" />
      <span className="absolute inset-0 grid place-items-center font-display text-3xl font-extrabold text-accent-cyan">
        ●
      </span>
    </div>
  );
}

function SkeletonItem() {
  return (
    <GlassCard className="p-4">
      <div className="flex items-center gap-4">
        <div className="h-16 w-16 flex-shrink-0 rounded-2xl bg-white/[0.04] motion-safe:animate-pulse" />
        <div className="flex flex-1 flex-col gap-2">
          <div className="h-4 w-2/3 rounded-full bg-white/[0.06] motion-safe:animate-pulse" />
          <div className="h-3 w-1/3 rounded-full bg-white/[0.04] motion-safe:animate-pulse" />
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="h-4 w-16 rounded-full bg-white/[0.06] motion-safe:animate-pulse" />
          <div className="h-3 w-12 rounded-full bg-white/[0.04] motion-safe:animate-pulse" />
        </div>
      </div>
    </GlassCard>
  );
}
