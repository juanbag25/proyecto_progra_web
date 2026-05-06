'use client';

import { forwardRef, useId, type InputHTMLAttributes } from 'react';

type NativeNumberInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'min' | 'max' | 'step' | 'type'
>;

interface NumberInputProps extends NativeNumberInputProps {
  label?: string;
  helperText?: string;
  /** Suffix shown inline (e.g. "kg", "cm", "ARS"). */
  unit?: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}

const wrapperBase =
  'flex items-center rounded-xl bg-white/[0.03] shadow-inset-hairline backdrop-blur-glass transition-all duration-300 ease-premium';
const wrapperValid =
  'border border-hairline hover:border-white/10 focus-within:border-accent-cyan/70 focus-within:bg-white/[0.05] focus-within:ring-2 focus-within:ring-accent-cyan/25';
const wrapperInvalid = 'border border-warn-coral/70 ring-2 ring-warn-coral/25';

const inputClasses =
  'tabular min-w-0 flex-1 bg-transparent px-4 py-3 font-sans text-sm text-white placeholder:text-white/35 focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none';

const stepperBtn =
  'flex h-7 w-7 items-center justify-center rounded-lg border border-hairline bg-white/[0.04] text-accent-cyan transition-all duration-300 ease-premium hover:border-accent-cyan/40 hover:bg-accent-cyan/10 hover:shadow-glow-cyan disabled:pointer-events-none disabled:opacity-40';

export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(function NumberInput(
  {
    label,
    helperText,
    unit,
    value,
    onChange,
    min = -Infinity,
    max = Infinity,
    step = 1,
    className = '',
    id,
    ...rest
  },
  ref,
) {
  const reactId = useId();
  const inputId = id ?? reactId;
  const outOfRange = value < min || value > max;

  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  const adjust = (delta: number) => onChange(clamp(value + delta));

  return (
    <label htmlFor={inputId} className="flex flex-col gap-2">
      {label && (
        <span className="font-display text-xs font-medium uppercase tracking-widest text-white/60">
          {label}
        </span>
      )}
      <div className={[wrapperBase, outOfRange ? wrapperInvalid : wrapperValid].join(' ')}>
        <input
          ref={ref}
          id={inputId}
          type="number"
          inputMode="numeric"
          min={Number.isFinite(min) ? min : undefined}
          max={Number.isFinite(max) ? max : undefined}
          step={step}
          value={value}
          onChange={(e) => {
            const raw = e.target.value;
            // Empty / mid-edit non-numeric strings would emit NaN and silently
            // poison the parent's state — keep the prior value instead.
            if (raw === '') return;
            const parsed = Number(raw);
            if (Number.isFinite(parsed)) onChange(parsed);
          }}
          aria-invalid={outOfRange || undefined}
          className={[inputClasses, className].join(' ')}
          {...rest}
        />
        {unit && (
          <span className="pointer-events-none select-none pr-2 font-sans text-xs uppercase tracking-widest text-white/45">
            {unit}
          </span>
        )}
        <div className="flex items-center gap-1 px-2">
          <button
            type="button"
            onClick={() => adjust(-step)}
            disabled={value <= min}
            aria-label="Decrement"
            className={stepperBtn}
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
            >
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => adjust(step)}
            disabled={value >= max}
            aria-label="Increment"
            className={stepperBtn}
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>
      </div>
      {(helperText || outOfRange) && (
        <span className={`font-sans text-xs ${outOfRange ? 'text-warn-coral' : 'text-white/40'}`}>
          {outOfRange
            ? `Must be between ${Number.isFinite(min) ? min : '−∞'} and ${Number.isFinite(max) ? max : '∞'}`
            : helperText}
        </span>
      )}
    </label>
  );
});
