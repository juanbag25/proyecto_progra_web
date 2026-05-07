'use client';

import { memo, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { GlassCard } from '@/components/ui/GlassCard';
import { formatARS, formatGrams } from '@/lib/format';

type ChainId = 'carrefour' | 'jumbo' | 'dia';

const CHAIN_LABELS: Record<ChainId, string> = {
  carrefour: 'Carrefour',
  dia: 'Día',
  jumbo: 'Jumbo',
};

const CHAIN_LOGOS: Record<ChainId, string> = {
  carrefour: '/supermarket_logos/carrefour.svg',
  dia: '/supermarket_logos/dia.svg',
  jumbo: '/supermarket_logos/jumbo.svg',
};

export interface ItemCardProps {
  itemId: string;
  productName: string;
  brand: string | null;
  chain: ChainId;
  imageUrl: string | null;
  /** Cost the optimizer assigned to this row (qty_g / weight_g × price). */
  priceArs: number;
  qtyG: number;
  /** Grams in one package — drives the "16 × 100 g" pack-aware label. */
  weightG: number | null;
  /** Controlled state — parent (ListView) owns the source of truth so the
   *  dashboard rings can react to toggles in real time. */
  checked: boolean;
  /** Fires with the *desired next value*. Parent runs the API call and
   *  may roll back checked if it fails — ItemCard never knows about fetch.
   *  Ignored when `readOnly` is true. */
  onToggle?: (next: boolean) => void;
  /** Subtle ring while the parent's API call is in flight. */
  pending?: boolean;
  /** Hides the click affordance for past lists (history detail page).
   *  Items still render their checked state as a visual record of what
   *  was bought that week, but can't be flipped. */
  readOnly?: boolean;
}

function ItemCardImpl({
  itemId: _itemId,
  productName,
  brand,
  chain,
  imageUrl,
  priceArs,
  qtyG,
  weightG,
  checked,
  onToggle,
  pending = false,
  readOnly = false,
}: ItemCardProps) {
  // Bounce on every checked-state change. We watch the prop (not local
  // state) so external rollbacks (parent reverts after a failed PATCH)
  // also fire the visual feedback.
  const [bouncing, setBouncing] = useState(false);
  const prevChecked = useRef(checked);
  useEffect(() => {
    if (prevChecked.current === checked) return;
    prevChecked.current = checked;
    setBouncing(true);
    const t = window.setTimeout(() => setBouncing(false), 240);
    return () => window.clearTimeout(t);
  }, [checked]);

  // Quantity label format — see formatPackLabel().
  const qtyLabel =
    weightG && weightG > 0
      ? formatPackLabel(qtyG, weightG)
      : formatGrams(qtyG);

  function handleClick() {
    if (pending || readOnly) return;
    onToggle?.(!checked);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (readOnly) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleClick();
    }
  }

  // In readOnly mode the card is informational, not a button. Drop button
  // semantics, the hover ring, and the cursor — but keep the visual
  // checked state because that's the record of what was actually bought.
  const interactive = !readOnly;

  return (
    <GlassCard
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-pressed={interactive ? checked : undefined}
      aria-label={
        interactive
          ? `${productName}, ${formatARS(priceArs)}, ${qtyLabel}. ${
              checked ? 'Marcado como comprado.' : 'Sin marcar.'
            }`
          : undefined
      }
      onClick={interactive ? handleClick : undefined}
      onKeyDown={interactive ? onKeyDown : undefined}
      className={`group relative select-none p-4 transition-all duration-300 ease-premium motion-safe:will-change-transform ${
        interactive
          ? 'cursor-pointer hover:border-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan/60'
          : 'cursor-default'
      } ${checked ? 'opacity-40' : 'opacity-100'} ${
        bouncing ? 'motion-safe:animate-check-bounce' : ''
      }`}
    >
      <div className="flex items-center gap-4">
        {/* Thumbnail */}
        <div className="relative grid h-16 w-16 flex-shrink-0 place-items-center overflow-hidden rounded-2xl border border-hairline bg-canvas-elevated">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- supermarket CDNs aren't in next/image remotePatterns; using <img> with object-contain keeps zero config and zero hostname whitelisting.
            <img
              src={imageUrl}
              alt=""
              className="h-full w-full object-contain p-1"
              loading="lazy"
            />
          ) : (
            <span className="font-display text-xs text-white/30" aria-hidden>
              s/img
            </span>
          )}
        </div>

        {/* Center — name + brand. The strike is a sliding overlay span (not
            text-decoration) so we get a 400ms left→right reveal animation. */}
        <div className="min-w-0 flex-1">
          <p className="relative inline-block max-w-full truncate font-display text-base font-semibold tracking-tight text-white">
            <span>{productName}</span>
            <span
              aria-hidden
              className={`pointer-events-none absolute left-0 top-1/2 h-[2px] w-full origin-left -translate-y-1/2 rounded-full bg-accent-cyan/75 transition-transform duration-[400ms] ease-premium motion-reduce:transition-none ${
                checked ? 'scale-x-100' : 'scale-x-0'
              }`}
            />
          </p>
          <p className="mt-0.5 truncate font-sans text-xs text-white/45">
            {brand ?? 'Sin marca'}
          </p>
        </div>

        {/* Right — price + qty + chain */}
        <div className="flex flex-col items-end gap-1.5 text-right">
          <span className="tabular font-display text-base font-bold text-white">
            {formatARS(priceArs)}
          </span>
          <div className="flex items-center gap-2">
            <span className="tabular font-sans text-xs text-white/55">
              {qtyLabel}
            </span>
            {/* eslint-disable-next-line @next/next/no-img-element -- local SVG logo in /public, no hostname concerns. */}
            <img
              src={CHAIN_LOGOS[chain]}
              alt={CHAIN_LABELS[chain]}
              className="h-2.5 w-auto opacity-55"
            />
          </div>
        </div>
      </div>

      {/* Subtle pending shimmer — a 1px ring while the PATCH is in flight. */}
      {pending && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-accent-cyan/40 motion-safe:animate-pulse"
        />
      )}
    </GlassCard>
  );
}

/**
 * "16 × 100 g" — packs the shopper actually grabs.
 * Singletons collapse to bare pack size ("500 g") because "1 × 500 g" is noise.
 */
function formatPackLabel(qtyG: number, weightG: number): string {
  const units = Math.max(1, Math.round(qtyG / weightG));
  const packSize = formatGrams(weightG);
  return units === 1 ? packSize : `${units} × ${packSize}`;
}

/**
 * Memoized export — without this, every toggle in `ListView` re-renders
 * every card in the list (the parent's `checkedIds` Set update triggers
 * a render of the whole tree). On a 30-item list that's a lot of wasted
 * work for one click.
 *
 * The custom comparator skips `onToggle` deliberately: the parent
 * recreates the closure on every render, but it always does the same
 * thing for a given `itemId`, so re-rendering on identity-only changes
 * defeats the memo. Every other prop is a primitive, so reference
 * equality on those is correct.
 */
export const ItemCard = memo(ItemCardImpl, (prev, next) => {
  return (
    prev.itemId === next.itemId &&
    prev.productName === next.productName &&
    prev.brand === next.brand &&
    prev.chain === next.chain &&
    prev.imageUrl === next.imageUrl &&
    prev.priceArs === next.priceArs &&
    prev.qtyG === next.qtyG &&
    prev.weightG === next.weightG &&
    prev.checked === next.checked &&
    prev.pending === next.pending &&
    prev.readOnly === next.readOnly
  );
});
