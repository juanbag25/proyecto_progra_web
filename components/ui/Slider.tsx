'use client';

import { useId, useState, type CSSProperties } from 'react';

interface SliderProps {
  label?: string;
  min?: number;
  max?: number;
  step?: number;
  /** Controlled value. If provided, `onChange` should be too. */
  value?: number;
  onChange?: (value: number) => void;
  /** Initial value when used uncontrolled. Ignored if `value` is provided. */
  defaultValue?: number;
  unit?: string;
  formatValue?: (n: number) => string;
}

export function Slider({
  label,
  min = 0,
  max = 100,
  step = 1,
  value,
  onChange,
  defaultValue,
  unit,
  formatValue,
}: SliderProps) {
  const id = useId();
  // Uncontrolled fallback: keeps the design-system showcase usage working
  // without an external state container.
  const [internal, setInternal] = useState<number>(defaultValue ?? Math.round((min + max) / 2));
  const isControlled = value !== undefined;
  const current = isControlled ? value : internal;

  const handleChange = (next: number) => {
    if (!isControlled) setInternal(next);
    onChange?.(next);
  };

  const pct = ((current - min) / (max - min)) * 100;
  const display = formatValue
    ? formatValue(current)
    : `${current.toLocaleString('en-US')}${unit ? ` ${unit}` : ''}`;

  const trackStyle: CSSProperties & Record<'--track-bg', string> = {
    '--track-bg': `linear-gradient(to right, #00F0FF 0%, #00E676 ${pct}%, rgba(255,255,255,0.08) ${pct}%, rgba(255,255,255,0.08) 100%)`,
  };

  return (
    <div className="flex flex-col gap-3">
      {label && (
        <div className="flex items-center justify-between">
          <label
            htmlFor={id}
            className="font-display text-xs font-medium uppercase tracking-widest text-white/60"
          >
            {label}
          </label>
          <span className="tabular rounded-full border border-hairline bg-white/[0.04] px-3 py-1 font-display text-sm font-semibold text-accent-cyan shadow-inset-hairline">
            {display}
          </span>
        </div>
      )}
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={current}
        onChange={(e) => handleChange(Number(e.target.value))}
        className="fitlist-slider"
        style={trackStyle}
        aria-label={label}
      />
      <div className="flex justify-between font-sans text-[10px] uppercase tracking-widest text-white/35">
        <span className="tabular">{min.toLocaleString('en-US')}</span>
        <span className="tabular">{max.toLocaleString('en-US')}</span>
      </div>
    </div>
  );
}
