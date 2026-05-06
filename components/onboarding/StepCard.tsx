'use client';

import { type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';
import { SwipeableCard } from '@/components/ui/SwipeableCard';

interface StepCardProps {
  title: string;
  subtitle?: string;
  canContinue: boolean;
  submitting?: boolean;
  onContinue: () => void;
  onBack?: () => void;
  continueLabel?: string;
  children: ReactNode;
}

export function StepCard({
  title,
  subtitle,
  canContinue,
  submitting = false,
  onContinue,
  onBack,
  continueLabel = 'Continuar',
  children,
}: StepCardProps) {
  return (
    <SwipeableCard
      threshold={120}
      onSwipeRight={canContinue && !submitting ? onContinue : undefined}
      onSwipeLeft={onBack}
    >
      <GlassCard variant="strong" className="flex w-[min(92vw,32rem)] flex-col gap-6 p-8 sm:p-10">
        <header className="flex flex-col gap-2">
          <h1 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
            {title}
          </h1>
          {subtitle && <p className="font-sans text-sm text-white/65">{subtitle}</p>}
        </header>

        <div className="flex flex-col gap-5">{children}</div>

        <div className="flex items-center gap-3 pt-2">
          {onBack && (
            <Button type="button" variant="ghost" size="md" onClick={onBack}>
              ← Atrás
            </Button>
          )}
          <Button
            type="button"
            variant="primary"
            size="lg"
            disabled={!canContinue || submitting}
            onClick={onContinue}
            className="ml-auto"
          >
            {submitting ? 'Guardando…' : continueLabel}
          </Button>
        </div>
      </GlassCard>
    </SwipeableCard>
  );
}
