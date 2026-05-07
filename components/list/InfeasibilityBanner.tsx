interface InfeasibilityBannerProps {
  message: string;
}

/**
 * Orange-tinted notice shown above the items when the optimizer flagged
 * the list as `feasible: false`. The message comes from the optimizer's
 * `buildFeasibilityMessage()` (multi-line plain text with concrete options
 * — "Subir el presupuesto a $X", "Cambiar tu goal a 'maintenance'", etc).
 *
 * Pure presentational. The parent decides whether to render it; this
 * component just paints.
 */
export function InfeasibilityBanner({ message }: InfeasibilityBannerProps) {
  return (
    <div
      role="alert"
      className="rounded-3xl border border-warn-orange/30 bg-warn-orange/[0.06] px-5 py-4 shadow-inset-hairline"
    >
      <div className="flex items-start gap-3">
        <span
          className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-warn-orange"
          aria-hidden
        />
        <p className="whitespace-pre-line font-sans text-sm leading-relaxed text-white/85">
          {message}
        </p>
      </div>
    </div>
  );
}
