import { NextResponse } from 'next/server';

import { reconcileSubscriptions } from '@/lib/mercadopago/reconcile';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Daily cron: re-sync subscription statuses with Mercado Pago (backstops missed
 * webhooks). Triggered by Vercel Cron via GET with `Authorization: Bearer
 * ${CRON_SECRET}`, which Vercel auto-injects when CRON_SECRET is set on the
 * project. Same secret already used by the nightly scrape cron.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 500 });
  }
  if (request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await reconcileSubscriptions();
  return NextResponse.json({ ok: true, ...result });
}
