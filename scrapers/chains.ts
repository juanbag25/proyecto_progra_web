/**
 * Chain catalog. Coto is intentionally absent — descoped in P5.A
 * (Oracle ATG, no public JSON API, hostile UA filter). Keep entries in
 * sync with `db/migrations/005_products.sql` chain CHECK constraint.
 */

export interface ChainConfig {
  id: 'carrefour' | 'jumbo' | 'dia';
  domain: string;
  /** Human label used in UI / logs only. */
  display_name: string;
}

export const CHAINS: readonly ChainConfig[] = [
  { id: 'carrefour', domain: 'www.carrefour.com.ar', display_name: 'Carrefour' },
  { id: 'dia', domain: 'diaonline.supermercadosdia.com.ar', display_name: 'Dia' },
  { id: 'jumbo', domain: 'www.jumbo.com.ar', display_name: 'Jumbo' },
] as const;

export type ChainId = ChainConfig['id'];

export function findChain(id: string): ChainConfig | null {
  return CHAINS.find((c) => c.id === id) ?? null;
}
