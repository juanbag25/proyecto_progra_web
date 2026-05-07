import { z } from 'zod';

/**
 * VTEX `/api/catalog_system/pub/products/search/` response shape.
 *
 * Two-pass validation: zod schemas are LOOSE on purpose (`.passthrough()`)
 * because VTEX storefronts decorate products with arbitrary fields per
 * tenant. We only assert the keys we actually consume — everything else is
 * allowed through, missing keys are caught by the picker that turns a raw
 * product into a `NormalizedProduct`.
 */

const sellerSchema = z
  .object({
    sellerId: z.string().optional(),
    commertialOffer: z
      .object({
        Price: z.number(),
        ListPrice: z.number().optional(),
      })
      .passthrough(),
  })
  .passthrough();

const imageSchema = z
  .object({
    imageUrl: z.string().optional(),
  })
  .passthrough();

const itemSchema = z
  .object({
    itemId: z.string(),
    name: z.string().optional(),
    ean: z.string().optional(),
    measurementUnit: z.string().optional(),
    unitMultiplier: z.number().optional(),
    images: z.array(imageSchema).optional(),
    sellers: z.array(sellerSchema).optional(),
  })
  .passthrough();

export const vtexProductSchema = z
  .object({
    productId: z.string(),
    productName: z.string(),
    brand: z.string().optional(),
    link: z.string().optional(),
    categories: z.array(z.string()).optional(),
    items: z.array(itemSchema).optional(),
  })
  .passthrough();

export const vtexResponseSchema = z.array(vtexProductSchema);

export type VtexProduct = z.infer<typeof vtexProductSchema>;

/**
 * What a chain scraper hands back to the orchestrator. Maps 1:1 to the
 * `products` table columns the upsert touches (the orchestrator adds
 * `chain`, `region`, `food_id`, `match_confidence`, `last_seen_at`).
 */
export interface NormalizedProduct {
  external_id: string;
  ean: string | null;
  name: string;
  brand: string | null;
  category: string | null;
  price: number;
  list_price: number | null;
  unit: string | null;
  unit_multiplier: number | null;
  weight_g: number | null;
  image_url: string | null;
  source_url: string;
}

/** Subset of the `foods` row we cache in memory for fuzzy matching. */
export interface FoodLite {
  id: string;
  slug: string;
  name_es: string;
  category: string;
  search_terms: string[];
}

/** Final row shape ready for upsert into the `products` table. */
export interface ProductRow extends NormalizedProduct {
  chain: 'carrefour' | 'jumbo' | 'dia';
  region: string;
  food_id: string | null;
  match_confidence: number | null;
}

export interface ScrapeError {
  query: string;
  message: string;
}

export interface ScrapeSummary {
  chain: 'carrefour' | 'jumbo' | 'dia';
  queries_run: number;
  products_scraped: number;
  products_matched: number;
  upserted: number;
  errors: ScrapeError[];
  duration_ms: number;
}
