interface ColorSwatchProps {
  name: string;
  hex: string;
  role?: string;
  /** Tailwind classes applied to the swatch tile (e.g. "bg-accent-cyan"). */
  swatchClassName?: string;
}

export function ColorSwatch({ name, hex, role, swatchClassName }: ColorSwatchProps) {
  return (
    <div className="group flex flex-col gap-3">
      <div
        className={[
          'relative h-28 w-full overflow-hidden rounded-2xl border border-hairline shadow-inset-hairline transition-transform duration-300 ease-premium group-hover:-translate-y-1',
          swatchClassName ?? '',
        ].join(' ')}
        style={swatchClassName ? undefined : { backgroundColor: hex }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent" />
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <div className="flex flex-col">
          <span className="font-display text-sm font-semibold text-white">{name}</span>
          {role && (
            <span className="font-sans text-[10px] uppercase tracking-widest text-white/40">
              {role}
            </span>
          )}
        </div>
        <span className="tabular font-sans text-xs text-white/50">{hex}</span>
      </div>
    </div>
  );
}
