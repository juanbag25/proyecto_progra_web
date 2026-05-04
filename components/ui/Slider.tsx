'use client';

import { useState, useId, type CSSProperties } from 'react';

interface SliderProps {
  label?: string;
  min?: number;
  max?: number;
  step?: number;
  defaultValue?: number;
  unit?: string;
  formatValue?: (n: number) => string;
}

export function Slider({
  label,
  min = 0,
  max = 100,
  step = 1,
  defaultValue,
  unit,
  formatValue,
}: SliderProps) {
  const initial = defaultValue ?? Math.round((min + max) / 2);
  const [value, setValue] = useState<number>(initial);
  const id = useId();

  const pct = ((value - min) / (max - min)) * 100;
  const display = formatValue
    ? formatValue(value)
    : `${value.toLocaleString('en-US')}${unit ? ` ${unit}` : ''}`;

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
        value={value}
        onChange={(e) => setValue(Number(e.target.value))}
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
