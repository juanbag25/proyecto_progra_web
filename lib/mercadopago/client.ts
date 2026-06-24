/**
 * Mercado Pago SDK client (SERVER-ONLY).
 *
 * A single shared config instance carrying the server-side Access Token. Every
 * resource client is constructed from it, e.g. `new PreApproval(mercadopago)`
 * or `new Payment(mercadopago)`.
 *
 * NEVER import this from a client component — `MP_ACCESS_TOKEN` must never reach
 * the browser bundle. For pricing/tier data needed on the client, import
 * `@/lib/mercadopago/tiers` instead (no secrets there).
 *
 * SDK: `mercadopago` v3.x (3.1.0). API in use: `MercadoPagoConfig`, `PreApproval`,
 * `WebhookSignatureValidator`.
 */
import 'server-only';

import { MercadoPagoConfig } from 'mercadopago';

export const mercadopago = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN!,
});
