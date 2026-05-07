'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { SummaryHeader } from '@/components/dashboard/SummaryHeader';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { CategoryGroup } from './CategoryGroup';
import { InfeasibilityBanner } from './InfeasibilityBanner';
import { ItemCard } from './ItemCard';
import { RegenerateListButton } from './RegenerateListButton';
import { ShareMenu } from './ShareMenu';
import { categoryLabel, categoryOrder } from '@/lib/list/category-labels';
import {
  computeProgress,
  type ProgressItem,
  type ProgressTargets,
} from '@/lib/list/derive-progress';
import { formatDate } from '@/lib/format';

type ChainId = 'carrefour' | 'jumbo' | 'dia';

/**
 * Flat per-item shape consumed by the client. Built server-side in page.tsx
 * by normalizing the nested `shopping_lists → items → product → food` join.
 */
export interface ListViewItem {
  id: string;
  product_id: string;
  product_name: string;
  brand: string | null;
  chain: ChainId;
  /** foods.category (or null when the product has no canonical match). */
  category: string | null;
  image_url: string | null;
  qty_g: number;
  cost: number;
  weight_g: number | null;
  protein_per_100g: number | null;
  carbs_per_100g: number | null;
  fats_per_100g: number | null;
  position: number;
  initial_checked: boolean;
}

export interface ListViewMetadata {
  week_start: string;
  created_at: string;
  feasible: boolean;
  feasibility_message: string | null;
}

interface ListViewProps {
  items: ListViewItem[];
  targets: ProgressTargets;
  budget: number;
  metadata: ListViewMetadata;
  /** Past-list mode: no toggles, no regenerate button — just a viewer.
   *  Share + print stay enabled (the user might want to refer back to
   *  what they bought). */
  readOnly?: boolean;
}

/**
 * Client-side controller for the shopping list view.
 *
 * Owns the source of truth for which items are checked so:
 *   - The dashboard rings (SummaryHeader) react to every toggle in one
 *     render pass — no realtime subscription needed for the same-tab case.
 *   - Optimistic updates land instantly; rollbacks happen here, in one
 *     place, instead of being scattered across N ItemCards.
 *
 * Persistence is per-toggle PATCH to /api/shopping-list/items/[id]/check.
 * No batching: the latency is invisible behind the optimistic UI, and one
 * request per click keeps server-side conflict handling trivial.
 */
export function ListView({
  items,
  targets,
  budget,
  metadata,
  readOnly = false,
}: ListViewProps) {
  // Initial checked state from the server. Once mounted, the client owns it.
  const [checkedIds, setCheckedIds] = useState<Set<string>>(() => {
    const s = new Set<string>();
    for (const it of items) if (it.initial_checked) s.add(it.id);
    return s;
  });
  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set());
  const [shareOpen, setShareOpen] = useState(false);
  const { show } = useToast();

  // Progress recomputes on every checked-state change. computeProgress
  // is pure and runs on a few hundred items at most — well under the
  // ~16ms budget for 60 fps even on mid-tier mobile.
  const progress = useMemo(() => {
    const progressItems: ProgressItem[] = items.map((it) => ({
      id: it.id,
      qty_g: it.qty_g,
      cost: it.cost,
      protein_per_100g: it.protein_per_100g,
      carbs_per_100g: it.carbs_per_100g,
      fats_per_100g: it.fats_per_100g,
    }));
    return computeProgress(progressItems, checkedIds, targets, budget);
  }, [items, checkedIds, targets, budget]);

  // Bucketing is stable for a given items array — memoize to skip the
  // sort + group on every render triggered by checked-state changes.
  const orderedGroups = useMemo(() => groupByCategory(items), [items]);

  // Plain-text serialization payload for the share menu. Memoized so the
  // sheet doesn't re-derive on every parent render (cheap, but tidy).
  const shareItems = useMemo(
    () =>
      items.map((it) => ({
        product_name: it.product_name,
        brand: it.brand,
        chain: it.chain,
        category: it.category,
        qty_g: it.qty_g,
        cost: it.cost,
        weight_g: it.weight_g,
      })),
    [items],
  );
  const shareSummary = useMemo(
    () => ({
      total_cost: progress.budget.planned,
      total_protein_g: progress.macros.protein.planned,
      total_carbs_g: progress.macros.carbs.planned,
      total_fats_g: progress.macros.fats.planned,
    }),
    [progress],
  );

  async function toggleItem(id: string, next: boolean) {
    if (readOnly) return;
    // 1. Optimistic flip — UI feels instant.
    setCheckedIds((prev) => withItem(prev, id, next));
    setPendingIds((prev) => withItem(prev, id, true));

    let ok = false;
    try {
      const res = await fetch(`/api/shopping-list/items/${id}/check`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checked: next }),
      });
      ok = res.ok;
    } catch {
      ok = false;
    }

    setPendingIds((prev) => withItem(prev, id, false));
    if (!ok) {
      // 2. Rollback. The bounce animation in ItemCard fires again on the
      // reverted value — the user sees the failure instead of silent drift.
      setCheckedIds((prev) => withItem(prev, id, !next));
      show({
        message: 'No pudimos guardar el cambio. Probá de nuevo.',
        variant: 'error',
      });
    }
  }

  return (
    <>
      <ListHero
        weekStart={metadata.week_start}
        createdAt={metadata.created_at}
        feasible={metadata.feasible}
        readOnly={readOnly}
        onShare={() => setShareOpen(true)}
      />

      {!metadata.feasible && metadata.feasibility_message ? (
        <InfeasibilityBanner message={metadata.feasibility_message} />
      ) : null}

      <SummaryHeader progress={progress} />

      {/* Print-only headline — replaces the dashboard rings on paper, where
          the user only needs the shopping list itself. */}
      <h1 className="print-only mb-4 font-display text-2xl font-bold tracking-tight text-black">
        Lista de compras — semana del {formatDate(metadata.week_start)}
      </h1>

      <div className="flex flex-col gap-10">
        {orderedGroups.map(({ label, items: groupItems }) => (
          <CategoryGroup key={label} title={label} count={groupItems.length}>
            {groupItems.map((it) => (
              <ItemCard
                key={it.id}
                itemId={it.id}
                productName={it.product_name}
                brand={it.brand}
                chain={it.chain}
                imageUrl={it.image_url}
                priceArs={it.cost}
                qtyG={it.qty_g}
                weightG={it.weight_g}
                checked={checkedIds.has(it.id)}
                pending={pendingIds.has(it.id)}
                onToggle={(next) => void toggleItem(it.id, next)}
                readOnly={readOnly}
              />
            ))}
          </CategoryGroup>
        ))}
      </div>

      <ShareMenu
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        items={shareItems}
        summary={shareSummary}
        options={{
          createdAt: metadata.created_at,
          budgetArs: budget,
        }}
      />
    </>
  );
}

interface ListHeroProps {
  weekStart: string;
  createdAt: string;
  feasible: boolean;
  readOnly: boolean;
  onShare: () => void;
}

function ListHero({
  weekStart,
  createdAt,
  feasible,
  readOnly,
  onShare,
}: ListHeroProps) {
  // "Tu semana" reads odd for a list from 4 weeks ago. Fall back to the
  // bare date when this is a past list opened from the history page.
  const heading = readOnly ? 'Esa semana' : 'Tu semana';
  const subtitle = readOnly
    ? 'Vista del historial — no se puede modificar.'
    : feasible
      ? 'Comprá esto y tu semana queda lista.'
      : 'Lista parcial — revisá las opciones de abajo.';

  return (
    <header className="flex flex-col gap-3 print-hide sm:flex-row sm:items-end sm:justify-between">
      <div className="flex flex-col gap-1">
        <span className="font-display text-[10px] font-semibold uppercase tracking-widest text-accent-cyan">
          Semana del {formatDate(weekStart)}
        </span>
        <h1 className="font-display text-4xl font-bold tracking-tight text-white sm:text-5xl">
          {heading}
        </h1>
        <p className="font-sans text-sm text-white/65">
          {subtitle}{' '}
          <span className="text-white/35">· generada el {formatDate(createdAt)}</span>
        </p>
      </div>
      <div className="flex flex-shrink-0 flex-wrap items-center gap-3">
        <Button type="button" variant="ghost" size="md" onClick={onShare}>
          Compartir
        </Button>
        {!readOnly && (
          <Link href="/app/feedback">
            <Button type="button" variant="ghost" size="md">
              Cerrar semana
            </Button>
          </Link>
        )}
        {!readOnly && <RegenerateListButton variant="outline" />}
      </div>
    </header>
  );
}

/** Immutable Set update — required for React reference equality so
 *  setState triggers a re-render. */
function withItem<T>(set: Set<T>, value: T, present: boolean): Set<T> {
  const next = new Set(set);
  if (present) next.add(value);
  else next.delete(value);
  return next;
}

function groupByCategory(items: ListViewItem[]) {
  const groups = new Map<string, { order: number; items: ListViewItem[] }>();
  for (const it of items) {
    const label = categoryLabel(it.category);
    const order = categoryOrder(it.category);
    const bucket = groups.get(label) ?? { order, items: [] };
    bucket.items.push(it);
    groups.set(label, bucket);
  }
  return [...groups.entries()]
    .sort((a, b) => a[1].order - b[1].order)
    .map(([label, b]) => ({
      label,
      items: b.items.sort((x, y) => x.position - y.position),
    }));
}
