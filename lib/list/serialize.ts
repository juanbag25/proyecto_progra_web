import { categoryLabel, categoryOrder } from './category-labels';
import { formatARS, formatDate, formatGrams } from '@/lib/format';

/**
 * Serialize a shopping list to plain text suitable for clipboard / share /
 * email body. Format prioritizes scan-ability over density:
 *
 *   FitList — Tu lista de la semana
 *   Generada: 7 de mayo de 2026
 *
 *   PROTEÍNAS
 *   • Pechuga de pollo Granja Tres Arroyos — 1 kg — $5.500 (Carrefour)
 *   • Atún en lata La Campagnola — 5 × 100 g — $4.250 (Día)
 *
 *   CARBOHIDRATOS
 *   • ...
 *
 *   ─────
 *   Total: $48.500 / Presupuesto: $60.000
 *   Macros: 920g proteína, 1.800g carbos, 510g grasas
 *
 * Pure: no DOM, no clipboard. The caller decides what to do with the string
 * (Web Share API, navigator.clipboard.writeText, mailto body, etc).
 */

const CHAIN_DISPLAY: Record<'carrefour' | 'jumbo' | 'dia', string> = {
  carrefour: 'Carrefour',
  jumbo: 'Jumbo',
  dia: 'Día',
};

export interface SerializeItem {
  product_name: string;
  brand: string | null;
  chain: 'carrefour' | 'jumbo' | 'dia';
  category: string | null;
  qty_g: number;
  cost: number;
  weight_g: number | null;
}

export interface SerializeSummary {
  total_cost: number;
  total_protein_g: number;
  total_carbs_g: number;
  total_fats_g: number;
}

export interface SerializeOptions {
  /** "Generada el…" header line. Falls back to today's date if omitted. */
  createdAt?: string | Date;
  /** User's weekly budget — for the "Total / Presupuesto" footer line. */
  budgetArs?: number;
}

export function serializeListAsPlainText(
  items: SerializeItem[],
  summary: SerializeSummary,
  options: SerializeOptions = {},
): string {
  const lines: string[] = [];

  lines.push('FitList — Tu lista de la semana');
  const date = options.createdAt ?? new Date();
  lines.push(`Generada: ${formatDate(date)}`);
  lines.push('');

  for (const group of groupByCategory(items)) {
    // ALL CAPS as a section header, no markdown — plain text travels
    // through SMS / WhatsApp / mail bodies cleanly.
    lines.push(group.label.toUpperCase());
    for (const it of group.items) {
      lines.push(`  • ${formatItemLine(it)}`);
    }
    lines.push('');
  }

  lines.push('─────────────');
  if (options.budgetArs != null) {
    lines.push(
      `Total: ${formatARS(summary.total_cost)} / Presupuesto: ${formatARS(options.budgetArs)}`,
    );
  } else {
    lines.push(`Total: ${formatARS(summary.total_cost)}`);
  }
  lines.push(
    `Macros: ${Math.round(summary.total_protein_g)}g proteína, ${Math.round(summary.total_carbs_g)}g carbos, ${Math.round(summary.total_fats_g)}g grasas`,
  );

  return lines.join('\n');
}

function formatItemLine(it: SerializeItem): string {
  const qtyLabel =
    it.weight_g && it.weight_g > 0
      ? formatPackLabelText(it.qty_g, it.weight_g)
      : formatGrams(it.qty_g);
  const head = it.brand
    ? `${it.product_name} ${it.brand}`
    : it.product_name;
  return `${head} — ${qtyLabel} — ${formatARS(it.cost)} (${CHAIN_DISPLAY[it.chain]})`;
}

function formatPackLabelText(qtyG: number, weightG: number): string {
  const units = Math.max(1, Math.round(qtyG / weightG));
  const packSize = formatGrams(weightG);
  return units === 1 ? packSize : `${units} × ${packSize}`;
}

interface Group {
  label: string;
  order: number;
  items: SerializeItem[];
}

function groupByCategory(items: SerializeItem[]): Group[] {
  const map = new Map<string, Group>();
  for (const it of items) {
    const label = categoryLabel(it.category);
    const order = categoryOrder(it.category);
    const bucket = map.get(label) ?? { label, order, items: [] };
    bucket.items.push(it);
    map.set(label, bucket);
  }
  return [...map.values()].sort((a, b) => a.order - b.order);
}
