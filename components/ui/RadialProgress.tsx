'use client';

import { useEffect, useId, useState } from 'react';

type Variant = 'cyan' | 'mint' | 'coral';

interface RadialProgressProps {
  /** 0 – 100 */
  value: number;
  size?: number;
  strokeWidth?: number;
  label: string;
  unit?: string;
  variant?: Variant;
  /** Optional helper line under the central number. */
  sublabel?: string;
}

const gradients: Record<Variant, [string, string]> = {
  cyan: ['#00F0FF', '#00E676'],
  mint: ['#00E676', '#00F0FF'],
  coral: ['#FF8E53', '#FF6B6B'],
};

const numberColor: Record<Variant, string> = {
  cyan: 'text-accent-cyan',
  mint: 'text-accent-mint',
  coral: 'text-warn-coral',
};

export function RadialProgress({
  value,
  size = 180,
  strokeWidth = 12,
  label,
  unit = '%',
  variant = 'cyan',
  sublabel,
}: RadialProgressProps) {
  const gradId = useId().replace(/:/g, '');
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, value));

  // Animate from 0 → value on mount.
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setProgress(clamped));
    return () => cancelAnimationFrame(id);
  }, [clamped]);

  const offset = circumference * (1 - progress / 100);
  const [from, to] = gradients[variant];

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="-rotate-90"
        >
          <defs>
            <linearGradient id={`grad-${gradId}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={from} />
              <stop offset="100%" stopColor={to} />
            </linearGradient>
          </defs>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={`url(#grad-${gradId})`}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{
              transition: 'stroke-dashoffset 1200ms cubic-bezier(0.16, 1, 0.3, 1)',
              filter: `drop-shadow(0 0 12px ${from}55)`,
            }}
          />
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={`tabular font-display text-4xl font-extrabold tracking-tightest ${numberColor[variant]}`}
          >
            {Math.round(progress)}
            <span className="ml-0.5 text-lg font-semibold opacity-80">{unit}</span>
          </span>
          {sublabel && (
            <span className="mt-1 font-sans text-[10px] uppercase tracking-widest text-white/45">
              {sublabel}
            </span>
          )}
        </div>
      </div>
      <span className="font-display text-sm font-medium tracking-tight text-white/70">{label}</span>
    </div>
  );
}
