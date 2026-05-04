import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  /** Use a heavier blur + brighter surface for primary cards. */
  variant?: 'default' | 'strong';
  children: ReactNode;
}

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(function GlassCard(
  { variant = 'default', className = '', children, ...rest },
  ref,
) {
  const surface = variant === 'strong' ? 'glass-strong' : 'glass';
  return (
    <div ref={ref} className={`${surface} p-6 ${className}`} {...rest}>
      {children}
    </div>
  );
});
