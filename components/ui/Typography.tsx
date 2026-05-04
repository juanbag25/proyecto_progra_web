import type { HTMLAttributes, ReactNode } from 'react';

type Common = { children: ReactNode; className?: string };

const cx = (...parts: (string | false | undefined)[]) => parts.filter(Boolean).join(' ');

export function H1({ children, className }: Common) {
  return (
    <h1
      className={cx(
        'font-display text-5xl font-extrabold leading-[1.05] tracking-tightest text-white md:text-6xl',
        className,
      )}
    >
      {children}
    </h1>
  );
}

export function H2({ children, className }: Common) {
  return (
    <h2
      className={cx(
        'font-display text-3xl font-bold leading-[1.1] tracking-tightest text-white md:text-4xl',
        className,
      )}
    >
      {children}
    </h2>
  );
}

export function H3({ children, className }: Common) {
  return (
    <h3
      className={cx(
        'font-display text-2xl font-semibold tracking-tighter2 text-white',
        className,
      )}
    >
      {children}
    </h3>
  );
}

export function H4({ children, className }: Common) {
  return (
    <h4 className={cx('font-display text-xl font-semibold text-white', className)}>{children}</h4>
  );
}

export function H5({ children, className }: Common) {
  return (
    <h5
      className={cx(
        'font-display text-xs font-semibold uppercase tracking-[0.2em] text-accent-cyan',
        className,
      )}
    >
      {children}
    </h5>
  );
}

export function Body({ children, className }: Common) {
  return (
    <p className={cx('font-sans text-base leading-relaxed text-white/75', className)}>{children}</p>
  );
}

export function Caption({ children, className }: Common) {
  return (
    <span className={cx('font-sans text-xs uppercase tracking-wider text-white/50', className)}>
      {children}
    </span>
  );
}

type DataNumberVariant = 'cyan' | 'mint' | 'coral' | 'white';

interface DataNumberProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: DataNumberVariant;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  children: ReactNode;
}

const dataNumberColor: Record<DataNumberVariant, string> = {
  cyan: 'text-accent-cyan',
  mint: 'text-accent-mint',
  coral: 'text-warn-coral',
  white: 'text-white',
};

const dataNumberSize: Record<NonNullable<DataNumberProps['size']>, string> = {
  sm: 'text-xl',
  md: 'text-3xl',
  lg: 'text-5xl',
  xl: 'text-6xl',
};

export function DataNumber({
  children,
  variant = 'white',
  size = 'md',
  className,
  ...rest
}: DataNumberProps) {
  return (
    <span
      className={cx(
        'tabular font-display font-bold tracking-tightest',
        dataNumberColor[variant],
        dataNumberSize[size],
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  );
}
