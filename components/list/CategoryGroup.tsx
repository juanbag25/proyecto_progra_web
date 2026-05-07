import { type ReactNode } from 'react';

interface CategoryGroupProps {
  title: string;
  count: number;
  children: ReactNode;
}

/**
 * Section wrapper for one category of the shopping list (e.g. "Proteínas").
 * Pure presentational — the page decides what items go in which group, this
 * component only paints the band heading + the stack underneath.
 */
export function CategoryGroup({ title, count, children }: CategoryGroupProps) {
  return (
    <section className="flex flex-col gap-3">
      <header className="flex items-baseline justify-between border-b border-hairline pb-2">
        <h2 className="font-display text-xs font-semibold uppercase tracking-widest text-white/55">
          {title}
        </h2>
        <span className="tabular font-sans text-xs text-white/35">
          {count} {count === 1 ? 'item' : 'items'}
        </span>
      </header>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}
