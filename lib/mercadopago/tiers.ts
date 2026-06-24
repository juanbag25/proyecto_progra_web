/**
 * Subscription tier catalog — the single source of truth for FitList pricing.
 *
 * Safe to import from client components (no secrets here). Each "alta" (P10.B)
 * turns one of these tiers into a Mercado Pago `preapproval` with the matching
 * `auto_recurring` block. We model tiers in our own code instead of as MP
 * `preapproval_plan` objects on purpose, so checkout can stay on the redirect
 * (sin-plan, `pending`) flow — see docs/agent_prompts/10_payments.md.
 */

export type TierId = 'monthly' | 'annual';

export interface Tier {
  id: TierId;
  label: string;
  /** ARS charged per cycle. PLACEHOLDER — confirm real amounts before go-live (P10.D/E). */
  amount: number;
  currency: 'ARS';
  /** 1 = monthly, 12 = annual (charged every 12 months). */
  frequency: number;
  frequency_type: 'months';
  /** Short marketing line, "personal trainer amigo" tone. */
  blurb: string;
}

export const TIERS: Record<TierId, Tier> = {
  monthly: {
    id: 'monthly',
    label: 'Mensual',
    amount: 4999,
    currency: 'ARS',
    frequency: 1,
    frequency_type: 'months',
    blurb: 'Flexible, cancelás cuando quieras.',
  },
  annual: {
    id: 'annual',
    label: 'Anual',
    amount: 49990,
    currency: 'ARS',
    frequency: 12,
    frequency_type: 'months',
    blurb: 'Dos meses gratis vs. el plan mensual.',
  },
};

/** App-side trial length, counted from `users_profile.created_at`. */
export const TRIAL_DAYS = 7;

export function isTierId(value: unknown): value is TierId {
  return value === 'monthly' || value === 'annual';
}
