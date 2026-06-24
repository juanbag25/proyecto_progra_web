/**
 * Subscription reconciliation (P10.E).
 *
 * Re-syncs non-terminal subscriptions against Mercado Pago to backstop any
 * webhook that was missed (network blip, deploy gap, MP retry exhaustion).
 * Idempotent and safe to run repeatedly. SERVER-ONLY (uses the service-role
 * client + the secret access token).
 */
import 'server-only';

import { getSubscription } from '@/lib/mercadopago/subscriptions';
import { createAdminClient } from '@/lib/supabase/admin';

const KNOWN_STATUSES = new Set(['pending', 'authorized', 'paused', 'cancelled']);

interface ReconcilableRow {
  id: string;
  mp_preapproval_id: string | null;
  status: string;
  current_period_end: string | null;
}

export interface ReconcileResult {
  checked: number;
  updated: number;
  errors: number;
}

export async function reconcileSubscriptions(): Promise<ReconcileResult> {
  const admin = createAdminClient();
  const { data: subs } = await admin
    .from('subscriptions')
    .select('id, mp_preapproval_id, status, current_period_end')
    .in('status', ['pending', 'authorized', 'paused'])
    .not('mp_preapproval_id', 'is', null)
    .limit(200);

  let checked = 0;
  let updated = 0;
  let errors = 0;

  for (const sub of (subs ?? []) as ReconcilableRow[]) {
    if (!sub.mp_preapproval_id) continue;
    checked += 1;
    try {
      const pre = await getSubscription(sub.mp_preapproval_id);
      const status = pre.status && KNOWN_STATUSES.has(pre.status) ? pre.status : sub.status;
      const periodEnd = pre.next_payment_date ?? sub.current_period_end ?? null;

      if (status !== sub.status || periodEnd !== sub.current_period_end) {
        const { error } = await admin
          .from('subscriptions')
          .update({
            status,
            current_period_end: periodEnd,
            updated_at: new Date().toISOString(),
          })
          .eq('id', sub.id);
        if (error) errors += 1;
        else updated += 1;
      }
    } catch (err) {
      errors += 1;
      console.error('[reconcile] failed for', sub.mp_preapproval_id, err);
    }
  }

  return { checked, updated, errors };
}
