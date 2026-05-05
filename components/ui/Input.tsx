import type { InputHTMLAttributes, ReactNode } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  leadingIcon?: ReactNode;
  trailingAddon?: ReactNode;
}

export function Input({
  label,
  helperText,
  leadingIcon,
  trailingAddon,
  className = '',
  id,
  ...rest
}: InputProps) {
  const inputId = id ?? label?.replace(/\s+/g, '-').toLowerCase();
  return (
    <label htmlFor={inputId} className="flex flex-col gap-2">
      {label && (
        <span className="font-display text-xs font-medium uppercase tracking-widest text-white/60">
          {label}
        </span>
      )}
      <div className="group relative flex items-center">
        {leadingIcon && (
          <span className="pointer-events-none absolute left-4 text-white/50 transition-colors duration-300 group-focus-within:text-accent-cyan">
            {leadingIcon}
          </span>
        )}
        <input
          id={inputId}
          className={[
            'w-full rounded-xl border border-hairline bg-white/[0.03] px-4 py-3 font-sans text-sm text-white shadow-inset-hairline backdrop-blur-glass transition-all duration-300 ease-premium placeholder:text-white/35',
            'hover:border-white/10',
            'focus:border-accent-cyan/70 focus:bg-white/[0.05] focus:outline-none focus:ring-2 focus:ring-accent-cyan/25',
            leadingIcon ? 'pl-11' : '',
            trailingAddon ? 'pr-14' : '',
            className,
          ].join(' ')}
          {...rest}
        />
        {trailingAddon && (
          <span className="pointer-events-none absolute right-4 font-sans text-xs text-white/45">
            {trailingAddon}
          </span>
        )}
      </div>
      {helperText && <span className="font-sans text-xs text-white/40">{helperText}</span>}
    </label>
  );
}
