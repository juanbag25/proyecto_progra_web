/**
 * Search queries used to populate the `products` table per chain.
 *
 * Sized for the academic demo: 15 staples that cover the dominant nodes of
 * the seeded `foods` table. Each query → 1 page of 50 results in VTEX, so
 * total per chain ≈ 750 product candidates. A typical search returns a mix
 * of relevant (matched) and adjacent products; the matcher filters at the
 * food-link layer.
 *
 * To expand coverage for production: append more queries here and bump
 * `POLICY.maxPagesPerQuery` in `policy.ts`.
 */
export const QUERIES: readonly string[] = [
  // High-protein animal foods
  'pollo',
  'huevo',
  'atun',
  // Dairy
  'leche',
  'yogur',
  'queso',
  // Carbs
  'arroz',
  'avena',
  'fideos',
  'pan integral',
  // Fats
  'aceite oliva',
  'palta',
  // Produce
  'banana',
  'tomate',
  // Pantry
  'lentejas',
] as const;
