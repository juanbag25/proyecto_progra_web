import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
}

const base =
  'inline-flex items-center justify-center gap-2 rounded-full font-display font-semibold tracking-tight transition-all duration-300 ease-premium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan/60 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-base disabled:pointer-events-none disabled:opacity-40';

const variants: Record<ButtonVariant, string> = {
  primary:
    'bg-accent-gradient text-canvas-base shadow-[0_8px_32px_-8px_rgba(0,240,255,0.45)] hover:scale-[1.03] hover:shadow-glow-cyan active:scale-[0.97]',
  secondary:
    'bg-canvas-elevated text-white border border-hairline shadow-inset-hairline hover:border-white/20 hover:bg-white/[0.06] hover:scale-[1.02] active:scale-[0.98]',
  outline:
    'bg-transparent text-accent-cyan border border-accent-cyan/60 hover:bg-accent-cyan/10 hover:border-accent-cyan hover:shadow-glow-cyan hover:scale-[1.02] active:scale-[0.98]',
  ghost: 'bg-transparent text-white/80 hover:bg-white/[0.06] hover:text-white active:scale-[0.98]',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'px-4 py-2 text-xs',
  md: 'px-6 py-3 text-sm',
  lg: 'px-8 py-4 text-base',
};

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...rest}>
      {children}
    </button>
  );
}
