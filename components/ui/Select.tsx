import type { SelectHTMLAttributes } from 'react';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: SelectOption[];
  helperText?: string;
}

export function Select({ label, options, helperText, className = '', id, ...rest }: SelectProps) {
  const selectId = id ?? label?.replace(/\s+/g, '-').toLowerCase();
  return (
    <label htmlFor={selectId} className="flex flex-col gap-2">
      {label && (
        <span className="font-display text-xs font-medium uppercase tracking-widest text-white/60">
          {label}
        </span>
      )}
      <div className="group relative">
        <select
          id={selectId}
          className={[
            'fitlist-select w-full rounded-xl border border-hairline bg-white/[0.03] px-4 py-3 pr-12 font-sans text-sm text-white shadow-inset-hairline backdrop-blur-glass transition-all duration-300 ease-premium',
            'hover:border-white/10',
            'focus:border-accent-cyan/70 focus:bg-white/[0.05] focus:outline-none focus:ring-2 focus:ring-accent-cyan/25',
            className,
          ].join(' ')}
          {...rest}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-canvas-elevated text-white">
              {opt.label}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-accent-cyan transition-transform duration-300 ease-premium group-focus-within:translate-y-[-30%]">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </div>
      {helperText && <span className="font-sans text-xs text-white/40">{helperText}</span>}
    </label>
  );
}
