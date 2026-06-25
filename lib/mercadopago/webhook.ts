/**
 * Mercado Pago webhook: signature verification + event handlers.
 *
 * SERVER-ONLY. The HTTP route (app/api/webhooks/mercadopago/route.ts) stays thin
 * and delegates here. All DB writes use the service-role client (the webhook has
 * no user session) and are idempotent (upsert on the MP unique ids), so MP's
 * retries never duplicate rows. See docs/agent_prompts/10_payments.md.
 */
import 'server-only';

import { InvalidWebhookSignatureError, WebhookSignatureValidator } from 'mercadopago';

import { getSubscription } from '@/lib/mercadopago/subscriptions';
import { TIERS, type TierId } from '@/lib/mercadopago/tiers';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Validate the `x-signature` of an incoming notification.
 *
 * We intentionally do NOT pass `toleranceSeconds`: Mercado Pago may resend the
 * original (same-`ts`) notification minutes later, and our handlers are
 * idempotent, so a replay is harmless — rejecting delayed retries would only
 * cause MP to hammer the endpoint.
 */
export function verifyWebhookSignature(input: {
  xSignature: string | null;
  xRequestId: string | null;
  dataId: string | null;
}): boolean {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) throw new Error('MP_WEBHOOK_SECRET is not set');

  try {
    WebhookSignatureValidator.validate({
      xSignature: input.xSignature,
      xRequestId: input.xRequestId,
      dataId: input.dataId,
      secret,
    });
    return true;
  } catch (err) {
    if (err instanceof InvalidWebhookSignatureError) {
      console.warn('[mp webhook] invalid signature:', err.reason);
      return false;
    }
    throw err;
  }
}

const KNOWN_STATUSES = new Set(['pending', 'authorized', 'paused', 'cancelled']);

/**
 * `subscription_preapproval` — the subscription changed state. Fetch the live
 * preapproval and upsert our mirror row (idempotent on `mp_preapproval_id`).
 */
export async function handlePreapprovalEvent(preapprovalId: string): Promise<void> {
  const pre = await getSubscription(preapprovalId);
  if (!pre.id) return;

  // `external_reference` is the Supabase user id we set at create time.
  const userId = pre.external_reference;
  if (!userId) {
    console.warn('[mp webhook] preapproval without external_reference:', pre.id);
    return;
  }

  // Our two tiers are distinguishable by frequency (annual = 12 months).
  const tier: TierId = pre.auto_recurring?.frequency === 12 ? 'annual' : 'monthly';
  const t = TIERS[tier];
  const status = pre.status && KNOWN_STATUSES.has(pre.status) ? pre.status : 'pending';

  const admin = createAdminClient();
  const { error } = await admin.from('subscriptions').upsert(
    {
      user_id: userId,
      mp_preapproval_id: pre.id,
      tier,
      status,
      amount: pre.auto_recurring?.transaction_amount ?? t.amount,
      currency: pre.auto_recurring?.currency_id ?? t.currency,
      frequency: pre.auto_recurring?.frequency ?? t.frequency,
      frequency_type: pre.auto_recurring?.frequency_type ?? t.frequency_type,
      current_period_end: pre.next_payment_date ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'mp_preapproval_id' },
  );
  if (error) console.error('[mp webhook] preapproval upsert failed:', error);
}

interface AuthorizedPaymentResponse {
  id?: number | string;
  preapproval_id?: string;
  transaction_amount?: number;
  status?: string;
  date_created?: string;
  payment?: { id?: number | string; status?: string };
}

/**
 * `subscription_authorized_payment` — a recurring charge occurred. There is no
 * dedicated SDK client for authorized payments, so we fetch the resource
 * directly and log it (idempotent on `mp_payment_id`).
 */
export async function handleAuthorizedPaymentEvent(authorizedPaymentId: string): Promise<void> {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) throw new Error('MP_ACCESS_TOKEN is not set');

  const res = await fetch(
    `https://api.mercadopago.com/authorized_payments/${encodeURIComponent(authorizedPaymentId)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) {
    console.error('[mp webhook] authorized_payment fetch failed:', res.status);
    return;
  }
  const ap = (await res.json()) as AuthorizedPaymentResponse;

  const admin = createAdminClient();
  const { data: sub } = await admin
    .from('subscriptions')
    .select('id, user_id')
    .eq('mp_preapproval_id', ap.preapproval_id ?? '')
    .maybeSingle<{ id: string; user_id: string }>();
  if (!sub) {
    console.warn('[mp webhook] authorized_payment for unknown preapproval:', ap.preapproval_id);
    return;
  }

  const mpPaymentId = String(ap.payment?.id ?? ap.id ?? authorizedPaymentId);
  const { error } = await admin.from('subscription_payments').upsert(
    {
      subscription_id: sub.id,
      user_id: sub.user_id,
      mp_payment_id: mpPaymentId,
      amount: ap.transaction_amount ?? null,
      status: ap.payment?.status ?? ap.status ?? null,
      paid_at: ap.date_created ?? null,
      raw: ap,
    },
    { onConflict: 'mp_payment_id', ignoreDuplicates: true },
  );
  if (error) console.error('[mp webhook] payment upsert failed:', error);
}
