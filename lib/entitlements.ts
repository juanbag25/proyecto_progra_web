/**
 * Access resolution for the hard paywall (P10.D).
 *
 * A user may use the app when they have an active Mercado Pago subscription OR a
 * still-running app-side trial. The trial is derived from the auth signup time
 * (`user.created_at + TRIAL_DAYS`) so it needs no DB read.
 *
 * No secrets here, and it takes the Supabase client as an argument, so it's safe
 * to call from both server components (server.ts client) and middleware (the
 * @supabase/ssr client). Reads run under the caller's RLS (read-own is enough).
 */
import type { SupabaseClient, User } from '@supabase/supabase-js';

import { TRIAL_DAYS, type TierId } from '@/lib/mercadopago/tiers';

const DAY_MS = 86_400_000;

export type EntitlementReason = 'subscription' | 'trial' | 'none';

export interface Entitlement {
  active: boolean;
  reason: EntitlementReason;
  tier: TierId | null;
  status: string | null;
  currentPeriodEnd: string | null;
  trialEndsAt: string;
}

/** End of the app-side trial window for a user (signup time + TRIAL_DAYS). */
export function trialEndsAt(user: User): Date {
  return new Date(new Date(user.created_at).getTime() + TRIAL_DAYS * DAY_MS);
}

export async function getEntitlement(
  supabase: SupabaseClient,
  user: User,
): Promise<Entitlement> {
  const trialEnd = trialEndsAt(user);
  const trialActive = trialEnd.getTime() > Date.now();

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('tier, status, current_period_end')
    .eq('user_id', user.id)
    .in('status', ['authorized', 'paused'])
    .order('current_period_end', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle<{ tier: TierId; status: string; current_period_end: string | null }>();

  // `paused` still counts as active until the paid period actually lapses.
  const subActive =
    !!sub &&
    (sub.status === 'authorized' ||
      (sub.status === 'paused' &&
        !!sub.current_period_end &&
        new Date(sub.current_period_end).getTime() > Date.now()));

  if (subActive && sub) {
    return {
      active: true,
      reason: 'subscription',
      tier: sub.tier,
      status: sub.status,
      currentPeriodEnd: sub.current_period_end,
      trialEndsAt: trialEnd.toISOString(),
    };
  }

  if (trialActive) {
    return {
      active: true,
      reason: 'trial',
      tier: null,
      status: null,
      currentPeriodEnd: null,
      trialEndsAt: trialEnd.toISOString(),
    };
  }

  return {
    active: false,
    reason: 'none',
    tier: null,
    status: null,
    currentPeriodEnd: null,
    trialEndsAt: trialEnd.toISOString(),
  };
}
