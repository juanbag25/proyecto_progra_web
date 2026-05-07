import Link from 'next/link';
import { GlassCard } from '@/components/ui/GlassCard';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const FOOD_CATEGORIES = [
  'protein_animal',
  'protein_vegetal',
  'carbs_grain',
  'carbs_tuber',
  'fats_oil',
  'fats_nuts',
  'dairy',
  'vegetable',
  'fruit',
  'legume',
  'condiment',
  'beverage',
] as const;
type FoodCategory = (typeof FOOD_CATEGORIES)[number];

interface FoodRow {
  id: string;
  slug: string;
  name_es: string;
  category: FoodCategory;
  kcal_per_100g: number | string;
  protein_per_100g: number | string;
  carbs_per_100g: number | string;
  fats_per_100g: number | string;
  fiber_per_100g: number | string;
  is_vegan: boolean;
  is_vegetarian: boolean;
  is_gluten_free: boolean;
  is_lactose_free: boolean;
  source: 'manual_seed' | 'usda' | 'llm' | 'open_food_facts';
}

interface SearchParams {
  category?: string;
}

export default async function DevFoodsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const category = isCategory(searchParams.category) ? searchParams.category : null;
  const supabase = createAdminClient();

  let query = supabase
    .from('foods')
    .select(
      'id, slug, name_es, category, kcal_per_100g, protein_per_100g, carbs_per_100g, fats_per_100g, fiber_per_100g, is_vegan, is_vegetarian, is_gluten_free, is_lactose_free, source',
    )
    .order('category', { ascending: true })
    .order('name_es', { ascending: true });

  if (category) query = query.eq('category', category);

  const { data, error } = await query;
  const foods = (error ? [] : (data ?? [])) as unknown as FoodRow[];

  const countsByCategory = countByCategory(foods);

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="font-display text-3xl font-bold tracking-tight text-white">
          Foods canónicos
        </h1>
        <p className="mt-1 font-sans text-sm text-white/55">
          Tabla <code className="text-accent-cyan">foods</code> — la fuente de nutrición que linkea
          con productos scrapeados vía <code className="text-accent-cyan">food_id</code>.
        </p>
      </header>

      <CategoryFilter active={category} totals={countsByCategory} totalAll={foods.length} />

      {error ? (
        <GlassCard className="text-sm text-warn-coral">
          Error leyendo foods: {error.message}
        </GlassCard>
      ) : foods.length === 0 ? (
        <GlassCard className="text-center text-sm text-white/55">
          No hay foods para este filtro.
        </GlassCard>
      ) : (
        <FoodsTable foods={foods} />
      )}
    </div>
  );
}

function isCategory(v: unknown): v is FoodCategory {
  return typeof v === 'string' && (FOOD_CATEGORIES as readonly string[]).includes(v);
}

function countByCategory(foods: FoodRow[]): Map<FoodCategory, number> {
  const out = new Map<FoodCategory, number>();
  for (const f of foods) out.set(f.category, (out.get(f.category) ?? 0) + 1);
  return out;
}

function CategoryFilter({
  active,
  totals,
  totalAll,
}: {
  active: FoodCategory | null;
  totals: Map<FoodCategory, number>;
  totalAll: number;
}) {
  return (
    <GlassCard className="flex flex-wrap items-center gap-2">
      <span className="font-sans text-[11px] uppercase tracking-widest text-white/40">
        Categoría:
      </span>
      <Chip href="/dev/foods" active={active === null}>
        Todas <span className="tabular text-white/40">({totalAll})</span>
      </Chip>
      {FOOD_CATEGORIES.map((cat) => {
        const count = totals.get(cat) ?? 0;
        return (
          <Chip
            key={cat}
            href={`/dev/foods?category=${cat}`}
            active={active === cat}
            disabled={count === 0 && active !== cat}
          >
            {cat} <span className="tabular text-white/40">({count})</span>
          </Chip>
        );
      })}
    </GlassCard>
  );
}

function Chip({
  href,
  active,
  disabled,
  children,
}: {
  href: string;
  active: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const base =
    'rounded-full px-3 py-1 font-sans text-xs transition-colors duration-300 ease-premium border';
  const cls = active
    ? `${base} bg-accent-cyan/15 text-accent-cyan border-accent-cyan/40`
    : disabled
      ? `${base} bg-white/[0.02] text-white/25 border-hairline pointer-events-none`
      : `${base} bg-white/[0.04] text-white/60 border-hairline hover:border-white/20 hover:text-white`;
  return (
    <Link href={href} className={cls}>
      {children}
    </Link>
  );
}

function FoodsTable({ foods }: { foods: FoodRow[] }) {
  return (
    <GlassCard className="overflow-x-auto p-0">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-hairline bg-white/[0.02] font-sans text-[11px] uppercase tracking-widest text-white/45">
          <tr>
            <Th>name_es</Th>
            <Th>slug</Th>
            <Th>category</Th>
            <Th align="right">kcal</Th>
            <Th align="right">P</Th>
            <Th align="right">C</Th>
            <Th align="right">F</Th>
            <Th align="right">fiber</Th>
            <Th>flags</Th>
            <Th>source</Th>
          </tr>
        </thead>
        <tbody className="font-sans text-xs text-white/80">
          {foods.map((f) => (
            <tr
              key={f.id}
              className="border-b border-hairline/50 transition-colors duration-300 ease-premium hover:bg-white/[0.03]"
            >
              <Td>
                <span className="font-display text-sm font-semibold text-white">{f.name_es}</span>
              </Td>
              <Td>
                <code className="text-accent-cyan/80">{f.slug}</code>
              </Td>
              <Td>
                <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] text-white/55">
                  {f.category}
                </span>
              </Td>
              <Td align="right">
                <span className="tabular">{Number(f.kcal_per_100g).toFixed(0)}</span>
              </Td>
              <Td align="right">
                <span className="tabular text-accent-mint">
                  {Number(f.protein_per_100g).toFixed(1)}
                </span>
              </Td>
              <Td align="right">
                <span className="tabular text-accent-cyan">
                  {Number(f.carbs_per_100g).toFixed(1)}
                </span>
              </Td>
              <Td align="right">
                <span className="tabular text-warn-orange">
                  {Number(f.fats_per_100g).toFixed(1)}
                </span>
              </Td>
              <Td align="right">
                <span className="tabular text-white/50">
                  {Number(f.fiber_per_100g).toFixed(1)}
                </span>
              </Td>
              <Td>
                <DietaryFlags food={f} />
              </Td>
              <Td>
                <span className="rounded-full border border-hairline bg-white/[0.04] px-2 py-0.5 text-[10px] uppercase tracking-widest text-white/45">
                  {f.source}
                </span>
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </GlassCard>
  );
}

function DietaryFlags({ food }: { food: FoodRow }) {
  const flags: { label: string; on: boolean }[] = [
    { label: 'V', on: food.is_vegan },
    { label: 'Vt', on: food.is_vegetarian },
    { label: 'GF', on: food.is_gluten_free },
    { label: 'LF', on: food.is_lactose_free },
  ];
  return (
    <div className="flex gap-1">
      {flags.map((f) => (
        <span
          key={f.label}
          title={`${f.label}: ${f.on ? 'sí' : 'no'}`}
          className={`tabular inline-flex h-5 w-7 items-center justify-center rounded-full text-[10px] font-bold ${
            f.on
              ? 'bg-accent-mint/15 text-accent-mint'
              : 'bg-white/[0.04] text-white/25'
          }`}
        >
          {f.label}
        </span>
      ))}
    </div>
  );
}

function Th({ children, align }: { children: React.ReactNode; align?: 'right' }) {
  return (
    <th className={`px-4 py-3 ${align === 'right' ? 'text-right' : 'text-left'}`}>{children}</th>
  );
}

function Td({ children, align }: { children: React.ReactNode; align?: 'right' }) {
  return <td className={`px-4 py-3 ${align === 'right' ? 'text-right' : ''}`}>{children}</td>;
}
