import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  ListViewItem,
  ListViewMetadata,
} from '@/components/list/ListView';

/**
 * Server-side loader for a single shopping_list + its items, joined to
 * products + foods.
 *
 * Used by both /app/list (current = newest by week_start) and
 * /app/list/[id] (specific past list). Same shape, same query body —
 * the only thing that changes is the WHERE clause.
 *
 * Returns a flat ListViewItem[] ready to pass to <ListView>, plus the
 * metadata band the hero / banner read. Returns null if no row matched
 * (caller decides whether that's "show empty state" or "404").
 *
 * RLS gates ownership — `shopping_lists.user_id = auth.uid()` ensures
 * /list/[id] for someone else's id returns no rows. We pass user_id
 * explicitly anyway so the query plan can use the user_id index instead
 * of relying on RLS row-by-row checks.
 */

type ChainId = 'carrefour' | 'jumbo' | 'dia';

interface FoodNode {
  category: string | null;
  protein_per_100g: number | string | null;
  carbs_per_100g: number | string | null;
  fats_per_100g: number | string | null;
}
interface ProductNode {
  id: string;
  name: string;
  brand: string | null;
  chain: ChainId;
  image_url: string | null;
  weight_g: number | string | null;
  food: FoodNode | FoodNode[] | null;
}
interface ItemRow {
  id: string;
  qty_g: number | string;
  cost: number | string;
  checked: boolean;
  position: number | null;
  product: ProductNode | ProductNode[] | null;
}
interface ListRow {
  id: string;
  week_start: string;
  feasible: boolean;
  feasibility_message: string | null;
  created_at: string;
  items: ItemRow[];
}

const SELECT = `id, week_start, feasible, feasibility_message, created_at,
  items:shopping_list_items(
    id, qty_g, cost, checked, position,
    product:products(
      id, name, brand, chain, image_url, weight_g,
      food:foods(category, protein_per_100g, carbs_per_100g, fats_per_100g)
    )
  )`;

export interface LoadedList {
  list_id: string;
  metadata: ListViewMetadata;
  items: ListViewItem[];
}

export async function loadCurrentList(
  supabase: SupabaseClient,
  userId: string,
): Promise<LoadedList | null> {
  const { data, error } = await supabase
    .from('shopping_lists')
    .select(SELECT)
    .eq('user_id', userId)
    .order('week_start', { ascending: false })
    .limit(1);

  if (error) throw new Error(`loadCurrentList: ${error.message}`);
  const row = (data as ListRow[] | null)?.[0];
  return row ? toLoadedList(row) : null;
}

export async function loadListById(
  supabase: SupabaseClient,
  userId: string,
  listId: string,
): Promise<LoadedList | null> {
  const { data, error } = await supabase
    .from('shopping_lists')
    .select(SELECT)
    .eq('user_id', userId)
    .eq('id', listId)
    .limit(1);

  if (error) throw new Error(`loadListById: ${error.message}`);
  const row = (data as ListRow[] | null)?.[0];
  return row ? toLoadedList(row) : null;
}

function toLoadedList(row: ListRow): LoadedList {
  const items = (row.items ?? [])
    .map(normalizeItem)
    .filter((it): it is ListViewItem => it !== null);

  return {
    list_id: row.id,
    metadata: {
      week_start: row.week_start,
      created_at: row.created_at,
      feasible: row.feasible,
      feasibility_message: row.feasibility_message,
    },
    items,
  };
}

function normalizeItem(row: ItemRow): ListViewItem | null {
  const product = Array.isArray(row.product) ? row.product[0] : row.product;
  if (!product) return null;
  const food = Array.isArray(product.food) ? product.food[0] : product.food;
  return {
    id: row.id,
    product_id: product.id,
    product_name: product.name,
    brand: product.brand,
    chain: product.chain,
    category: food?.category ?? null,
    image_url: product.image_url,
    qty_g: toNumber(row.qty_g) ?? 0,
    cost: toNumber(row.cost) ?? 0,
    weight_g: product.weight_g != null ? toNumber(product.weight_g) : null,
    protein_per_100g:
      food?.protein_per_100g != null ? toNumber(food.protein_per_100g) : null,
    carbs_per_100g:
      food?.carbs_per_100g != null ? toNumber(food.carbs_per_100g) : null,
    fats_per_100g:
      food?.fats_per_100g != null ? toNumber(food.fats_per_100g) : null,
    position: row.position ?? 0,
    initial_checked: row.checked,
  };
}

function toNumber(v: number | string | null | undefined): number | null {
  if (v == null) return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}
