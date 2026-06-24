import { NextResponse } from 'next/server';

import {
  handleAuthorizedPaymentEvent,
  handlePreapprovalEvent,
  verifyWebhookSignature,
} from '@/lib/mercadopago/webhook';

export const dynamic = 'force-dynamic';

/**
 * Mercado Pago subscription webhook.
 *
 * 1. Verify the `x-signature` (HMAC-SHA256) — reject with 401 if invalid.
 * 2. Dispatch by `type` to an idempotent handler.
 * 3. Always 200 once the signature is valid, so MP doesn't retry over a
 *    transient DB hiccup (the reconciliation cron in P10.E backstops misses).
 */
export async function POST(request: Request) {
  const url = new URL(request.url);
  const dataId = url.searchParams.get('data.id');
  const xSignature = request.headers.get('x-signature');
  const xRequestId = request.headers.get('x-request-id');

  if (!verifyWebhookSignature({ xSignature, xRequestId, dataId })) {
    return new NextResponse(null, { status: 401 });
  }

  let body: { type?: string; action?: string; data?: { id?: string } };
  try {
    body = await request.json();
  } catch {
    // Signature was valid but body is unreadable — ack so MP stops retrying.
    return new NextResponse(null, { status: 200 });
  }

  const id = body.data?.id ?? dataId ?? undefined;

  try {
    if (id) {
      if (body.type === 'subscription_preapproval') {
        await handlePreapprovalEvent(id);
      } else if (body.type === 'subscription_authorized_payment') {
        await handleAuthorizedPaymentEvent(id);
      }
    }
  } catch (err) {
    console.error('[mp webhook] handler error:', err);
  }

  return new NextResponse(null, { status: 200 });
}
