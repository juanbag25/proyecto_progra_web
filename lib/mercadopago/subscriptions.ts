/**
 * Thin wrappers around the Mercado Pago PreApproval (subscription) resource.
 *
 * SERVER-ONLY: every call carries the secret access token via `mercadopago`.
 *
 * Flow = "sin plan, pending": we create the preapproval with `status: 'pending'`
 * and redirect the user to the returned `init_point` so they authorize the
 * recurring charge on Mercado Pago's hosted checkout. The webhook (P10.C) is the
 * source of truth for the final status. See docs/agent_prompts/10_payments.md.
 */
import 'server-only';

import { PreApproval } from 'mercadopago';

import { mercadopago } from '@/lib/mercadopago/client';
import { TIERS, type TierId } from '@/lib/mercadopago/tiers';

export interface CreatedSubscription {
  /** Mercado Pago preapproval id — persisted as `subscriptions.mp_preapproval_id`. */
  id: string;
  /** Hosted-checkout URL to redirect the payer to. */
  initPoint: string;
}

export async function createSubscription({
  userId,
  email,
  tier,
}: {
  userId: string;
  email: string;
  tier: TierId;
}): Promise<CreatedSubscription> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) throw new Error('NEXT_PUBLIC_APP_URL is not set');

  const t = TIERS[tier];

  // `notification_url` is not part of the SDK's `PreApprovalRequest` type, but
  // the API accepts it (subscription notifications are configured at creation
  // time). Building `body` as a named variable — rather than an inline literal —
  // skips TS's excess-property check while the SDK still forwards the field.
  // The dashboard webhook config is the backup channel.
  const body = {
    reason: `FitList ${t.label}`,
    external_reference: userId,
    payer_email: email,
    back_url: `${appUrl}/app/billing/return`,
    notification_url: `${appUrl}/api/webhooks/mercadopago`,
    status: 'pending',
    auto_recurring: {
      frequency: t.frequency,
      frequency_type: t.frequency_type,
      transaction_amount: t.amount,
      currency_id: t.currency,
    },
  };

  const result = await new PreApproval(mercadopago).create({ body });
  if (!result.id || !result.init_point) {
    throw new Error('Mercado Pago no devolvió id / init_point al crear la suscripción');
  }
  return { id: result.id, initPoint: result.init_point };
}

/** Fetch the live state of a subscription from Mercado Pago. */
export function getSubscription(preapprovalId: string) {
  return new PreApproval(mercadopago).get({ id: preapprovalId });
}

/** Cancel a subscription (terminal — cannot be resumed afterwards). */
export function cancelSubscription(preapprovalId: string) {
  return new PreApproval(mercadopago).update({
    id: preapprovalId,
    body: { status: 'cancelled' },
  });
}

/** Pause a subscription (resumable). */
export function pauseSubscription(preapprovalId: string) {
  return new PreApproval(mercadopago).update({
    id: preapprovalId,
    body: { status: 'paused' },
  });
}

/** Resume a paused subscription. */
export function resumeSubscription(preapprovalId: string) {
  return new PreApproval(mercadopago).update({
    id: preapprovalId,
    body: { status: 'authorized' },
  });
}
