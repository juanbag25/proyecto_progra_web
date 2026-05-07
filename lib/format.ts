/**
 * Display formatters shared across the FitList UI.
 *
 * All numeric output uses 'es-AR' locale so thousands separators are dots
 * (e.g. `$48.500`) and the decimal separator is a comma — matching what
 * Argentine users expect on price tags and supermarket receipts.
 *
 * Pair these helpers with the `.tabular` utility class (defined in
 * `app/globals.css`) on the rendering element so digits align in lists
 * and dashboards.
 */

const AR_LOCALE = 'es-AR';

interface FormatARSOptions {
  /** Show two decimal places (e.g. `$8.450,75`). Default false — list views
   *  prefer integer pesos because cents add visual noise. */
  decimals?: boolean;
}

export function formatARS(value: number | string, options: FormatARSOptions = {}): string {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return '$—';
  const decimals = options.decimals === true;
  const formatted = n.toLocaleString(AR_LOCALE, {
    minimumFractionDigits: decimals ? 2 : 0,
    maximumFractionDigits: decimals ? 2 : 0,
  });
  return `$${formatted}`;
}

/**
 * Render grams in the most natural unit:
 *   - <1000g → "500 g"
 *   - ≥1000g → "1,5 kg" (one decimal, never trailing zeros)
 *
 * Negative or non-finite inputs return "—" so a bad value doesn't crash
 * the row. The qty_g column on shopping_list_items is non-null in DB so
 * this only matters defensively.
 */
export function formatGrams(grams: number | string): string {
  const n = typeof grams === 'number' ? grams : Number(grams);
  if (!Number.isFinite(n) || n < 0) return '—';
  if (n >= 1000) {
    const kg = n / 1000;
    // toLocaleString trims the trailing ".0" via maximumFractionDigits
    return `${kg.toLocaleString(AR_LOCALE, { maximumFractionDigits: 1 })} kg`;
  }
  return `${Math.round(n).toLocaleString(AR_LOCALE)} g`;
}

/**
 * Long form date (`7 de mayo de 2026`) for headers / week stamps. Use
 * `formatDate` on dates the user reads in prose; in tabular contexts where
 * vertical alignment matters use the ISO short form directly.
 */
export function formatDate(input: string | Date, locale: string = AR_LOCALE): string {
  const d = typeof input === 'string' ? new Date(input) : input;
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}
