# Fase 10 — Monetización / Suscripciones (Mercado Pago)

Pagos **recurrentes** con la API de Suscripciones de Mercado Pago. 5 sub-prompts secuenciales (P10.A → P10.E). El core mínimo viable es **P10.A → P10.D**; P10.E es hardening + go-live.

> **Dependencias:** sólo necesita la **Fase 2 (Auth + RLS + middleware)**, que ya está hecha. Por eso, aunque esté numerada última, se puede construir antes que las Fases 4–8. El paywall "protege" features que todavía no existen; el gating se conecta a medida que esas features aparecen.

---

## Decisiones de diseño congeladas (2026-06-20)

Estas decisiones las tomó el usuario y son la base del pipeline. Si un sub-prompt parece contradecirlas, mandan estas.

1. **Flujo de checkout → redirect (sin plan asociado, `pending`).** Creamos un `preapproval` con `status: "pending"`, sin `preapproval_plan` y sin tokenizar tarjetas. MP devuelve un `init_point` (URL) y redirigimos al usuario a su checkout hosteado. **FitList nunca toca datos de tarjeta → cero superficie PCI.**
2. **Multi-tier (Mensual + Anual) como catálogo propio, NO como `preapproval_plan` de MP.** Razón: el flujo "con plan asociado" de MP obliga a `card_token_id` + `status: "authorized"` (tarjeta embebida), lo que choca con la decisión 1. Solución: los tiers viven en nuestro código (`lib/mercadopago/tiers.ts`) y cada alta genera un `preapproval` sin plan con el `auto_recurring` del tier elegido (mensual = `frequency:1, frequency_type:"months"`; anual = `frequency:12, frequency_type:"months"`).
   - _Alternativa documentada:_ si más adelante se quiere que los planes sean objetos nativos en el dashboard de MP (mejor reporting), migrar a `preapproval_plan` por tier + usar el `init_point` del plan (botón de suscripción). No es necesario para v1.
3. **Paywall duro (toda la app es premium), suavizado con trial app-side.** Toda ruta bajo `/app/*` (y el onboarding) requiere **suscripción activa** O **trial vigente**. El trial es **app-side** (`users_profile.created_at + TRIAL_DAYS`, sin pedir tarjeta) → menos fricción y mejor conversión que el `free_trial` nativo de MP (que exige autorizar medio de pago up-front).
   - _Alternativa documentada:_ usar `free_trial` de MP (objeto `{ frequency, frequency_type }` en `auto_recurring`) si se prefiere capturar el medio de pago desde el día 0.

---

## Hechos técnicos de referencia (válidos al 2026-06)

- **Recurso central:** `preapproval` (la "preaprobación" del cobro recurrente). Endpoints: `POST/GET/PUT /preapproval`, búsqueda `GET /preapproval/search`.
- **SDK:** paquete `mercadopago` para Node, **línea v2.x** (v1 deprecada desde 2.0.0; requiere Node ≥16). Antes de instalar correr `npm view mercadopago version` y fijar la última 2.x. Clases relevantes: `MercadoPagoConfig`, `PreApproval`, `Payment`, y `WebhookSignatureValidator` (verificar que esté exportado en la versión instalada; si no, validar firma a mano con `crypto`).
- **Init del SDK:** `const mp = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN! })`.
- **Crear suscripción:** `await new PreApproval(mp).create({ body })` → devuelve `{ id, init_point, status, ... }`.
- **Estados del `preapproval`:** `pending` → `authorized` → `paused` / `cancelled` (cambios vía `PUT`/`update`).
- **Cobros:** el **primer cobro ocurre ~1h** después de que el usuario autoriza. Cuota rechazada → estado `recycling` (hasta 4 reintentos en 10 días). **Tras 3 cuotas rechazadas, MP cancela la suscripción automáticamente.**
- **Webhooks (topics):** `subscription_preapproval` (cambió la suscripción), `subscription_authorized_payment` (ocurrió un cobro), `payment` (registro del pago). El cuerpo es `{ id, type, action, data: { id }, live_mode, ... }`. Hay que responder **HTTP 200/201 rápido** e idempotente.
- **Firma `x-signature`:** header `x-signature: ts=<unix>,v1=<hmac_hex>` + header `x-request-id` + query `data.id`. Manifest: **`id:{data.id};request-id:{x-request-id};ts:{ts};`** → `HMAC-SHA256(MP_WEBHOOK_SECRET, manifest)` en hex → comparar (timing-safe) contra `v1`. El `secret` se genera en el panel de MP.
- **⚠️ Quirk de suscripciones:** la config de notificaciones por dashboard "no está disponible para integraciones de Suscripciones" → setear `notification_url` **en el body del `preapproval`** (P10.B). El `secret` de la firma igual se obtiene del dashboard (P10.A).
- **Sandbox:** credenciales **TEST** + **usuarios de prueba** (comprador/vendedor) + tarjetas de test → **sin plata real**. Gotcha: el `payer_email` debe ser el del usuario de prueba **comprador**, si no da errores opacos. El webhook necesita URL pública HTTPS → probar en **Vercel preview/prod** (o túnel ngrok en local).

---

## P10.A — Setup, credenciales, SDK & data model

````prompt
🎯 TAREA: 10.A — Cuenta MP + credenciales TEST + SDK + cliente server-only + catálogo de tiers + migración de suscripciones con RLS

📚 CONTEXTO OBLIGATORIO A LEER:
- docs/agent_prompts/10_payments.md (esta fase completa, en especial "Decisiones congeladas" y "Hechos técnicos")
- docs/agent_prompts/README.md (§4 reglas inviolables, §4.1 convenciones, §6 cuándo pausar)
- docs/project_definition/06_tech_stack.md
- .env.example (convención de env vars; secrets sin NEXT_PUBLIC_)
- db/migrations/001_users_profile.sql y 002_user_profile_data.sql (estilo SQL + RLS + tabla users_profile)
- lib/supabase/server.ts (patrón de cliente)

🛠️ SKILLS / MCPs A USAR:
- supabase/agent-skills (migración + RLS)
- security-review (al final)

📋 INSTRUCCIONES:

PARTE 1 — Acción humana: cuenta y credenciales Mercado Pago
1. PAUSAR Y PEDIR AL USUARIO (bloque 🙋 abajo): crear la aplicación en MP, obtener credenciales TEST,
   crear usuarios de prueba y generar el secret de webhook. NO continuar hasta tener los valores.

PARTE 2 — Dependencia (requiere aprobación explícita)
2. PAUSAR Y PEDIR APROBACIÓN para instalar la dependencia nueva `mercadopago` (es la única dep nueva
   de toda la fase). Recién con el OK: `npm view mercadopago version` y `npm i mercadopago@<última 2.x>`.

PARTE 3 — Variables de entorno
3. Agregar a `.env.example` (con comentarios, secrets SIN prefijo NEXT_PUBLIC_):
   - `MP_ACCESS_TOKEN=`            # Access Token (server-only). TEST-... en dev, APP_USR-... en prod.
   - `MP_WEBHOOK_SECRET=`         # Secret de firma del webhook (panel MP). Server-only.
   - `NEXT_PUBLIC_APP_URL=`       # URL pública de la app (back_url + notification_url). Ej: https://<preview>.vercel.app
   - `# MP_PUBLIC_KEY=`           # (Futuro) sólo si algún día se hace tarjeta embebida. No se usa en el flujo redirect.

PARTE 4 — Cliente del SDK (server-only)
4. Crear `lib/mercadopago/client.ts`:
   - `import 'server-only';`
   - exportar un singleton `export const mercadopago = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN! });`
   - comentario aclarando que NUNCA debe importarse desde un client component.

PARTE 5 — Catálogo de tiers (source of truth de precios)
5. Crear `lib/mercadopago/tiers.ts` (sin secrets, importable en cliente para mostrar precios):
   ```ts
   export type TierId = 'monthly' | 'annual';
   export interface Tier {
     id: TierId;
     label: string;            // "Mensual" / "Anual"
     amount: number;           // ARS por ciclo
     currency: 'ARS';
     frequency: number;        // 1 (mensual) | 12 (anual)
     frequency_type: 'months';
     blurb: string;            // copy corto, tono trainer-amigo
   }
   export const TIERS: Record<TierId, Tier> = {
     monthly: { id: 'monthly', label: 'Mensual', amount: 4999,  currency: 'ARS', frequency: 1,  frequency_type: 'months', blurb: 'Flexible, cancelás cuando quieras.' },
     annual:  { id: 'annual',  label: 'Anual',   amount: 49990, currency: 'ARS', frequency: 12, frequency_type: 'months', blurb: 'Dos meses gratis vs. mensual.' },
   };
   export const TRIAL_DAYS = 7; // trial app-side desde users_profile.created_at
   export function isTierId(v: unknown): v is TierId { return v === 'monthly' || v === 'annual'; }
   ```
   (Los montos son placeholders; confirmar con el usuario al implementar P10.D.)

PARTE 6 — Migración SQL + RLS
6. Crear `db/migrations/009_subscriptions.sql` (idempotente, RLS habilitado):
   ```sql
   -- =========================================================================
   -- 009_subscriptions.sql — Suscripciones Mercado Pago + log de pagos + RLS
   -- =========================================================================
   -- `subscriptions`: una fila por suscripción del usuario (mp_preapproval_id es
   -- la clave natural contra MP). Estado espejo del preapproval de MP.
   -- `subscription_payments`: log de cada cobro recurrente (authorized_payment).
   -- RLS: el usuario SÓLO lee lo propio. TODA escritura pasa por el service-role
   -- (webhook P10.C + route de alta P10.B), que bypassa RLS → por eso NO hay
   -- policies de insert/update/delete para el usuario final.
   -- =========================================================================

   create table if not exists subscriptions (
     id uuid primary key default gen_random_uuid(),
     user_id uuid not null references auth.users(id) on delete cascade,
     mp_preapproval_id text unique,
     tier text not null check (tier in ('monthly','annual')),
     status text not null default 'pending'
       check (status in ('pending','authorized','paused','cancelled')),
     amount numeric(10,2) not null,
     currency text not null default 'ARS',
     frequency int not null,
     frequency_type text not null check (frequency_type in ('days','months')),
     current_period_end timestamptz,
     cancel_at_period_end boolean not null default false,
     created_at timestamptz not null default now(),
     updated_at timestamptz not null default now()
   );
   create index if not exists subscriptions_user_id_idx on subscriptions(user_id);

   alter table subscriptions enable row level security;
   drop policy if exists "users read own subscription" on subscriptions;
   create policy "users read own subscription" on subscriptions
     for select using (auth.uid() = user_id);

   create table if not exists subscription_payments (
     id uuid primary key default gen_random_uuid(),
     subscription_id uuid references subscriptions(id) on delete cascade,
     user_id uuid not null references auth.users(id) on delete cascade,
     mp_payment_id text unique,
     amount numeric(10,2),
     status text,
     paid_at timestamptz,
     raw jsonb,
     created_at timestamptz not null default now()
   );
   create index if not exists subscription_payments_user_id_idx on subscription_payments(user_id);

   alter table subscription_payments enable row level security;
   drop policy if exists "users read own payments" on subscription_payments;
   create policy "users read own payments" on subscription_payments
     for select using (auth.uid() = user_id);
   ```
7. PAUSAR Y PEDIR AL USUARIO que corra la migración en el SQL Editor de Supabase. Confirmar antes de seguir.

PARTE 7 — Verificación
8. `npx tsc --noEmit` limpio. Cliente del SDK no importable desde cliente (server-only marca el error si se intenta).
9. Invocar `security-review`: que ningún secret de MP llegue al bundle del cliente; RLS habilitado en ambas tablas.

🙋 ACCIÓN HUMANA REQUERIDA: SÍ — tres veces.
  (a) Crear app en MP + credenciales TEST + usuarios de prueba + secret de webhook (pasos abajo).
  (b) Aprobar instalar la dependencia `mercadopago`.
  (c) Correr la migración 009 en Supabase.

  Pasos para (a) — pegale esto al usuario:
   1. Entrá a https://www.mercadopago.com.ar/developers/panel/app y creá una aplicación (tipo
      "Pagos recurrentes / Suscripciones"). Nombre: "FitList".
   2. En "Credenciales de prueba" copiá el **Access Token (TEST-...)** → me lo pegás como MP_ACCESS_TOKEN.
   3. En el panel → "Cuentas de prueba" creá DOS: un **vendedor** (cuyo access token usás) y un
      **comprador** (con ese email vas a pagar en sandbox).
   4. En tu app → "Webhooks / Notificaciones": configurá una URL (la completamos en P10.C: 
      `<NEXT_PUBLIC_APP_URL>/api/webhooks/mercadopago`), guardá, y copiá la **Clave secreta** → MP_WEBHOOK_SECRET.
   5. Decime tu `NEXT_PUBLIC_APP_URL` (en dev podés usar la URL de Vercel preview para que el webhook
      tenga URL pública; en local hace falta ngrok).

✅ CRITERIOS DE ACEPTACIÓN:
- `lib/mercadopago/client.ts` exporta el singleton; falla el build si se importa desde cliente.
- `lib/mercadopago/tiers.ts` tipado, con monthly + annual.
- Migración 009 corre sin error; `subscriptions` y `subscription_payments` existen con RLS ON y policy de read-own.
- En SQL Editor, un usuario sólo ve sus propias filas (verificado con dos cuentas).
- `.env.example` documenta MP_ACCESS_TOKEN, MP_WEBHOOK_SECRET, NEXT_PUBLIC_APP_URL (y MP_PUBLIC_KEY comentada).
- `npx tsc --noEmit` y `npm run lint` limpios. security-review sin críticos.

📁 ARCHIVOS A CREAR / MODIFICAR:
- package.json (+ mercadopago)
- .env.example
- lib/mercadopago/client.ts
- lib/mercadopago/tiers.ts
- db/migrations/009_subscriptions.sql
````

---

## P10.B — Alta de suscripción (checkout redirect)

````prompt
🎯 TAREA: 10.B — Helpers de PreApproval + route de alta que crea el preapproval (pending) y redirige al init_point + página de retorno

📚 CONTEXTO OBLIGATORIO A LEER:
- docs/agent_prompts/10_payments.md (Decisiones congeladas 1 y 2; Hechos técnicos)
- lib/mercadopago/client.ts y lib/mercadopago/tiers.ts (de P10.A)
- lib/auth.ts (requireUser) y lib/supabase/server.ts
- app/api/health/route.ts (estilo de Route Handler)
- components/ui/* (Button, GlassCard, Toast) y docs/project_definition/04_brand_identity.md (tono)

🛠️ SKILLS / MCPs A USAR:
- (ninguno externo nuevo)

📋 INSTRUCCIONES:

1. Crear `lib/mercadopago/subscriptions.ts` (server-only) con:
   - `createSubscription({ userId, email, tier }: { userId: string; email: string; tier: TierId }): Promise<{ id: string; init_point: string }>`
     - Arma el body del preapproval SIN plan, `status: "pending"`:
       ```ts
       {
         reason: `FitList ${TIERS[tier].label}`,
         external_reference: userId,              // clave para mapear el webhook al user
         payer_email: email,
         back_url: `${process.env.NEXT_PUBLIC_APP_URL}/app/billing/return`,
         notification_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/mercadopago`,
         status: 'pending',
         auto_recurring: {
           frequency: TIERS[tier].frequency,
           frequency_type: TIERS[tier].frequency_type,
           transaction_amount: TIERS[tier].amount,
           currency_id: 'ARS',
         },
       }
       ```
     - Llama `new PreApproval(mercadopago).create({ body })`, devuelve `{ id, init_point }`.
   - `getSubscription(preapprovalId)` → `new PreApproval(mercadopago).get({ id })`.
   - `cancelSubscription(preapprovalId)` → `update({ id, body: { status: 'cancelled' } })`.
   - `pauseSubscription(preapprovalId)` / `resumeSubscription(preapprovalId)` → `update` con `paused`/`authorized`.

2. Crear `lib/supabase/admin.ts` (service-role, sin cookies) — lo necesita el insert de la fila pending
   y el webhook (P10.C). `import 'server-only'`; usa `SUPABASE_SERVICE_ROLE_KEY`; NUNCA exponer al cliente.
   (Si ya existe de otra fase, reusar; no duplicar.)

3. Crear route `app/api/subscriptions/create/route.ts` (POST):
   - `requireUser()`; leer `{ tier }` del body y validar con `isTierId` (o zod) → 400 si inválido.
   - Insertar fila pending en `subscriptions` con el **cliente service-role** (tier, amount, frequency,
     frequency_type, status 'pending', user_id). Mantiene la regla "el usuario nunca escribe subscriptions directo".
   - Llamar `createSubscription({ userId, email: user.email!, tier })`.
   - Guardar `mp_preapproval_id` en la fila recién creada.
   - Responder `{ init_point }` (el cliente hace `window.location.href = init_point`).
   - Errores → JSON claro + status correcto; nunca filtrar el access token en el mensaje.

4. Crear `app/app/billing/return/page.tsx` (la `back_url`):
   - Server component. Copy tono trainer-amigo: "Estamos confirmando tu suscripción…".
   - Aclarar que la confirmación final llega por webhook (puede tardar segundos). Mostrar estado actual
     de la suscripción del user (lectura de `subscriptions`) y un botón "Ir a mi panel" → `/app`.
   - NO marcar premium acá; la fuente de verdad es el webhook (P10.C).

⚠️ NOTA: en sandbox, pagá con el **usuario de prueba comprador**; si el payer_email no coincide, MP tira errores opacos.

🙋 ACCIÓN HUMANA REQUERIDA: SÍ (para probar end-to-end) — el usuario debe loguearse con la cuenta comprador
   de prueba en el checkout de MP y completar el pago con tarjeta de test.

✅ CRITERIOS DE ACEPTACIÓN:
- Usuario logueado elige un tier → POST /api/subscriptions/create → recibe init_point → redirige al checkout de MP (sandbox).
- Se crea una fila `subscriptions` en estado `pending` con su `mp_preapproval_id`.
- Tras pagar en sandbox, MP redirige a `/app/billing/return`.
- El access token nunca aparece en respuestas ni en el bundle cliente.
- `npx tsc --noEmit` y `npm run lint` limpios.

📁 ARCHIVOS A CREAR / MODIFICAR:
- lib/mercadopago/subscriptions.ts
- lib/supabase/admin.ts
- app/api/subscriptions/create/route.ts
- app/app/billing/return/page.tsx
````

---

## P10.C — Webhook + validación de firma (núcleo de seguridad)

````prompt
🎯 TAREA: 10.C — Endpoint de webhook idempotente con validación de firma x-signature, que sincroniza el estado de la suscripción y loguea los cobros

📚 CONTEXTO OBLIGATORIO A LEER:
- docs/agent_prompts/10_payments.md (Hechos técnicos: webhooks, firma x-signature, quirk de suscripciones)
- lib/mercadopago/subscriptions.ts (getSubscription) y lib/supabase/admin.ts (de P10.B)
- middleware.ts (allowlist de rutas públicas)

🛠️ SKILLS / MCPs A USAR:
- security-review (al final — este endpoint es la pieza más sensible)

📋 INSTRUCCIONES:

1. Crear `lib/mercadopago/webhook.ts`:
   - `verifySignature({ xSignature, xRequestId, dataId }): boolean`
     - Preferir el helper del SDK: `WebhookSignatureValidator.validate({ xSignature, xRequestId, dataId, secret: process.env.MP_WEBHOOK_SECRET! })`.
     - Si el helper NO está exportado en la versión instalada, validar a mano:
       ```ts
       import crypto from 'crypto';
       // x-signature: "ts=...,v1=..."
       const parts = Object.fromEntries(xSignature.split(',').map(p => p.trim().split('=')));
       const manifest = `id:${dataId};request-id:${xRequestId};ts:${parts.ts};`;
       const hmac = crypto.createHmac('sha256', process.env.MP_WEBHOOK_SECRET!).update(manifest).digest('hex');
       const ok = crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(parts.v1));
       ```
   - Handlers (todos con cliente **service-role**, idempotentes):
     - `handlePreapproval(id)`: `getSubscription(id)` → upsert `subscriptions` por `mp_preapproval_id`
       (status, current_period_end, tier/amount desde external_reference). Mapear estados MP → nuestros.
     - `handleAuthorizedPayment(id)`: fetch del authorized_payment/payment → upsert en `subscription_payments`
       por `mp_payment_id` (idempotente), y extender `current_period_end` de la suscripción.

2. Crear `app/api/webhooks/mercadopago/route.ts` (POST):
   - Leer headers `x-signature`, `x-request-id` y query `data.id`. Validar firma → si falla, responder **401**.
   - Parsear body `{ type, data: { id } }`. Switch por `type`:
     - `subscription_preapproval` → `handlePreapproval(data.id)`
     - `subscription_authorized_payment` → `handleAuthorizedPayment(data.id)`
     - default → ignorar.
   - Responder **200** rápido. Hacer el mínimo de trabajo síncrono; si algo falla internamente, loguear
     pero igual devolver 200 sólo si la firma fue válida (MP reintenta ante no-2xx; evitar loops de error
     no relacionados a la firma — definir criterio: 401 sólo por firma, 200 por evento procesado/ignorado,
     500 sólo ante error transitorio que querés que MP reintente).
   - Idempotencia: upserts por claves únicas (`mp_preapproval_id`, `mp_payment_id`); reprocesar el mismo
     evento no debe duplicar filas ni doble-contar.

3. Actualizar `middleware.ts`: asegurar que `/api/webhooks/mercadopago` NO sea tratada como ruta protegida
   ni redirigida (no está bajo `/app` ni `/onboarding`, así que ya pasa; agregar comentario explícito y, si
   hace falta, un early-return para no correr `getUser()` en webhooks). El webhook no tiene sesión de usuario.

⚠️ NOTA (quirk): como la config de notificaciones por dashboard no aplica a Suscripciones, el `notification_url`
   ya se setea en el body del preapproval (P10.B). El `secret` de la firma sí sale del dashboard (P10.A).

🙋 ACCIÓN HUMANA REQUERIDA: SÍ — probar con el Simulador de Webhooks del panel de MP (o un pago real de
   sandbox) apuntando a la URL pública (Vercel preview o ngrok). El usuario debe confirmar que llegan eventos.

✅ CRITERIOS DE ACEPTACIÓN:
- Evento con firma válida → 200 y la DB se actualiza (status de la suscripción / fila de pago).
- Evento con firma manipulada o secret incorrecto → 401, sin tocar la DB.
- Reenviar el mismo evento (simulador) NO duplica filas (idempotente).
- El endpoint responde dentro del timeout de MP.
- `subscription_preapproval` con status `authorized` deja al usuario habilitado (verificable en P10.D).
- security-review sin críticos (firma validada, service-role no expuesto, sin logs de secrets).

📁 ARCHIVOS A CREAR / MODIFICAR:
- lib/mercadopago/webhook.ts
- app/api/webhooks/mercadopago/route.ts
- middleware.ts (comentario / early-return para la ruta del webhook)
````

---

## P10.D — Gating (paywall duro), entitlements & UI de billing

````prompt
🎯 TAREA: 10.D — Entitlements server-side + gate de toda la app (paywall duro con trial) + página /app/billing con pricing, estado y cancelar/pausar

📚 CONTEXTO OBLIGATORIO A LEER:
- docs/agent_prompts/10_payments.md (Decisión congelada 3: paywall duro + trial app-side)
- docs/project_definition/05_aesthetics.md y 04_brand_identity.md (estética + tono)
- lib/auth.ts, app/app/layout.tsx (dónde va el guard), lib/mercadopago/tiers.ts (TIERS, TRIAL_DAYS)
- components/ui/* (GlassCard, Button, Modal/Toast)

🛠️ SKILLS / MCPs A USAR:
- anthropic-skills:theme-factory (apoyo de theming si hace falta)

📋 INSTRUCCIONES:

1. Crear `lib/entitlements.ts` (server-only):
   - `getEntitlement(userId): Promise<{ active: boolean; reason: 'subscription'|'trial'|'none'; tier?: TierId; currentPeriodEnd?: string; trialEndsAt?: string }>`
     - Lee `subscriptions` (status `authorized` o `paused` dentro de período como activo según política) y
       `users_profile.created_at`. Trial vigente si `created_at + TRIAL_DAYS > now()`.
     - active = (suscripción activa) OR (trial vigente).
   - `requireActiveAccess()`: si `!active` → `redirect('/app/billing')`.

2. Gate del paywall duro en `app/app/layout.tsx` (server component):
   - `const user = await requireUser();`
   - Calcular entitlement. Si NO activo Y la ruta no es `/app/billing` → redirect a `/app/billing`.
   - Excepción: `/app/billing` (para poder suscribirse) y signout siempre accesibles.
   - Decisión sobre onboarding: permitir `/onboarding` durante el trial (para configurar el perfil) pero
     la app principal sigue gateada por suscripción/trial. (Si el usuario prefiere gatear también el
     onboarding, es un cambio de una línea — dejar comentado.)
   - Preferir el guard en el layout (1 query por navegación, con acceso a DB) sobre meterlo en middleware
     (que correría en cada request y no tiene acceso cómodo a la DB).

3. Página `app/app/billing/page.tsx` (server component, estilo marca, `.tabular` en precios):
   - Si NO activo (o trial por vencer): mostrar las `PricingCard` de monthly + annual con precio, blurb y CTA
     "Suscribirme" → POST a /api/subscriptions/create → redirige al init_point. Si está en trial, mostrar
     contador "Te quedan N días de prueba".
   - Si activo por suscripción: `SubscriptionStatusCard` con tier, estado, **próximo cobro** (current_period_end),
     botón Cancelar y Pausar, e historial de pagos (lectura de `subscription_payments`).

4. Componentes en `components/billing/`:
   - `PricingCard.tsx` (GlassCard + accent gradient + Button), `SubscriptionStatusCard.tsx`,
     `Paywall.tsx` (estado vacío/bloqueado reutilizable con CTA a /app/billing).
   - Seguir el patrón de `components/ui/Button.tsx` (base + variants + template literals).

5. Routes de gestión:
   - `app/api/subscriptions/cancel/route.ts` y `.../pause/route.ts` (POST, authed, **chequear ownership**:
     la suscripción debe ser del user) → llaman a cancel/pause de `lib/mercadopago/subscriptions.ts`.
     El webhook sincroniza el estado final; la UI puede ser optimista pero la verdad la fija el webhook.

6. Copys: tono "personal trainer experto pero amigo". Nada preachy. El paywall motiva, no culpa.

🙋 ACCIÓN HUMANA REQUERIDA: confirmar los **montos finales** de monthly/annual (placeholders en tiers.ts) y
   los **TRIAL_DAYS**. Decisión de producto → pausar y preguntar.

✅ CRITERIOS DE ACEPTACIÓN:
- Usuario sin suscripción y con trial vencido → cualquier `/app/*` redirige a `/app/billing`.
- Usuario en trial vigente o con suscripción activa → acceso normal a la app.
- /app/billing muestra pricing (no activo) o estado + próximo cobro + historial (activo).
- Cancelar/pausar funciona y se refleja tras el webhook; ownership verificado (no podés cancelar la de otro).
- Precios con `.tabular`; estética de marca (dark, glass, acentos, fuentes), tono correcto.
- `npx tsc --noEmit` y `npm run lint` limpios.

📁 ARCHIVOS A CREAR / MODIFICAR:
- lib/entitlements.ts
- app/app/layout.tsx (guard del paywall)
- app/app/billing/page.tsx
- components/billing/PricingCard.tsx
- components/billing/SubscriptionStatusCard.tsx
- components/billing/Paywall.tsx
- app/api/subscriptions/cancel/route.ts
- app/api/subscriptions/pause/route.ts
````

---

## P10.E — Lifecycle, dunning, reconciliación & go-live

````prompt
🎯 TAREA: 10.E — Manejo de pagos fallidos/grace period + cron de reconciliación (webhooks perdidos) + checklist de paso a producción (plata real)

📚 CONTEXTO OBLIGATORIO A LEER:
- docs/agent_prompts/10_payments.md (Hechos técnicos: recycling, 3 cuotas rechazadas → cancela)
- lib/mercadopago/subscriptions.ts, lib/mercadopago/webhook.ts, lib/entitlements.ts (fases previas)
- docs/agent_prompts/05_scraping.md (patrón de Vercel Cron si ya existe) y vercel.json

🛠️ SKILLS / MCPs A USAR:
- security-review (al final, antes de go-live)

📋 INSTRUCCIONES:

1. Dunning / pagos fallidos:
   - En `handleAuthorizedPayment`, reflejar estados `recycling`/rechazado en la UI ("Reintentando tu pago…").
   - Política de grace: el acceso se mantiene hasta `current_period_end`; si MP cancela tras 3 cuotas
     rechazadas (llega `subscription_preapproval` con `cancelled`), el entitlement cae al vencer el período.
   - Ajustar `getEntitlement` para contemplar `paused` y grace explícitamente.

2. Reconciliación (por si se pierde un webhook):
   - `lib/mercadopago/reconcile.ts`: para suscripciones no-terminales, `PreApproval.get`/`search` y resync
     de status + current_period_end.
   - `app/api/cron/reconcile-subscriptions/route.ts`: protegido por `CRON_SECRET` (header Authorization),
     corre la reconciliación. Agregar entrada en `vercel.json` (ej. diaria). Documentar `CRON_SECRET` en .env.example.

3. (Opcional) Notificaciones: toast/email en pago exitoso o fallido.

4. Go-live (PAUSA — plata real):
   - PAUSAR Y PEDIR AL USUARIO: cambiar credenciales TEST → PROD (Access Token APP_USR-..., regenerar
     webhook secret de prod), actualizar `NEXT_PUBLIC_APP_URL` y la URL del webhook al dominio productivo,
     y confirmar montos/moneda reales.
   - Checklist: HTTPS ok, firma validada en prod, idempotencia probada, RLS ok, ToS/precio visibles,
     política de cancelación clara.

5. Correr `security-review` final sobre toda la Fase 10.

🙋 ACCIÓN HUMANA REQUERIDA: SÍ — swap a credenciales de producción y confirmación de montos (gasto real).

✅ CRITERIOS DE ACEPTACIÓN:
- Simular webhook perdido (no entregarlo) + correr el cron → el estado se reconcilia contra MP.
- Pago fallido → la UI lo refleja y el acceso respeta el grace hasta current_period_end.
- Cron protegido por CRON_SECRET (401 sin el secret).
- Checklist de producción completo; security-review sin críticos.

📁 ARCHIVOS A CREAR / MODIFICAR:
- lib/mercadopago/reconcile.ts
- app/api/cron/reconcile-subscriptions/route.ts
- vercel.json (entrada de cron)
- .env.example (CRON_SECRET)
````

---

## Cierre de fase

Probar el flujo completo en **Vercel preview** (no en local, por el webhook): signup → trial → elegir tier →
checkout sandbox con usuario comprador de prueba → webhook confirma → acceso premium → cancelar. Recién con
todo verde y `security-review` sin críticos, considerar el swap a producción (P10.E, con aprobación del usuario).

## Changelog

- 2026-06-20 — Creado el pipeline (P10.A–E) a partir de research de la API de Suscripciones de MP. Decisiones
  congeladas: redirect sin plan (pending) + multi-tier como catálogo propio + paywall duro con trial app-side.
- 2026-06-24 — Reconciliado sobre la base real (post-sync con `origin/main`, que ya tenía Fases 4–9): migración renumerada `003` → `009_subscriptions.sql`; `lib/supabase/admin.ts` ya existe en el repo (reusar, no recrear). Data model (009) + `tiers.ts` + sección de `.env.example` commiteados.
