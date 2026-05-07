/**
 * Mapping from `foods.category` enum (DB) to the user-facing Spanish labels
 * used to group items on the shopping list page.
 *
 * Multiple raw categories can collapse into one display group (both
 * `protein_animal` and `protein_vegetal` show under "Proteínas") — the
 * shopper only cares "this row is a protein", not which subtype.
 *
 * `order` is a stable sort key so groups always appear in the same sequence,
 * top to bottom: proteins → legumes → dairy → grains → tubers → vegetables
 * → fruits → fats → nuts → condiments → drinks → other. Anything not in the
 * map (or `null`) falls into "Otros" at the bottom.
 */

interface CategoryMeta {
  label: string;
  order: number;
}

const CATEGORY_META: Record<string, CategoryMeta> = {
  protein_animal: { label: 'Proteínas', order: 0 },
  protein_vegetal: { label: 'Proteínas', order: 0 },
  legume: { label: 'Legumbres', order: 1 },
  dairy: { label: 'Lácteos', order: 2 },
  carbs_grain: { label: 'Cereales y panes', order: 3 },
  carbs_tuber: { label: 'Tubérculos', order: 4 },
  vegetable: { label: 'Vegetales', order: 5 },
  fruit: { label: 'Frutas', order: 6 },
  fats_oil: { label: 'Aceites', order: 7 },
  fats_nuts: { label: 'Frutos secos', order: 8 },
  condiment: { label: 'Condimentos', order: 9 },
  beverage: { label: 'Bebidas', order: 10 },
};

const OTHER: CategoryMeta = { label: 'Otros', order: 99 };

export function categoryLabel(category: string | null | undefined): string {
  if (!category) return OTHER.label;
  return CATEGORY_META[category]?.label ?? OTHER.label;
}

export function categoryOrder(category: string | null | undefined): number {
  if (!category) return OTHER.order;
  return CATEGORY_META[category]?.order ?? OTHER.order;
}
