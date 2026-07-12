# 🥗 FitList

**Listas de compras semanales inteligentes que cumplen tus objetivos de macros y micronutrientes dentro de tu presupuesto** — generadas con IA a partir de precios reales de supermercados argentinos.

`Next.js 14` · `TypeScript` · `Tailwind CSS` · `Supabase` · `Google Gemini` · `Mercado Pago` · `Vercel`

> **🔗 Demo en vivo:** `https://TU-DEPLOY.vercel.app` — _reemplazá `TU-DEPLOY` por tu dominio de Vercel._
> Proyecto académico — ITBA, materia **Programación Web**.

---

## ¿Qué es FitList?

FitList arma tu lista de compras de la semana optimizada para que:

- **alcance tus objetivos nutricionales** (calorías, proteínas, grasas, carbohidratos) calculados a partir de tu perfil,
- **respete un presupuesto** que vos definís,
- **use productos y precios reales** scrapeados de supermercados argentinos (Carrefour, Día, Jumbo).

El motor combina un cálculo de requerimientos (TDEE + ajuste por objetivo, enriquecido con un LLM) y un optimizador propio que arma la canasta más barata que cumple tus targets.

## Features

- 🔐 **Auth completa** — registro, login y recuperación de contraseña (Supabase Auth).
- 🧭 **Onboarding guiado** — perfil biométrico, objetivo, nivel de actividad, restricciones alimentarias y presupuesto (máquina de pasos).
- 🎯 **Targets nutricionales** — TDEE (Mifflin-St Jeor) + ajuste por objetivo, refinado con Google Gemini y validado con Zod; con fallback determinístico si el LLM falla.
- 🛒 **Generación de lista** — optimizador goloso con topes por alimento/SKU, presupuesto duro, variedad y rotación entre semanas.
- ✅ **Lista interactiva** — check-off con UI optimista, anillos de progreso de macros y presupuesto, y versión imprimible.
- 📈 **Historial y feedback semanal** — registrás adherencia y peso; el sistema recalibra los targets de la semana siguiente.
- 💳 **Suscripciones** — paywall premium con Mercado Pago (sandbox), webhooks firmados y reconciliación automática.
- 🎨 **Design system propio** — componentes reutilizables, glassmorphism, dark-first (showcase en `/design-system`).

## Stack

| Capa | Tecnología |
|------|-----------|
| Framework | Next.js 14 (App Router) + React 18 |
| Lenguaje | TypeScript (`strict`) |
| Estilos | Tailwind CSS |
| Base de datos / Auth | Supabase (PostgreSQL + Row Level Security) |
| IA | Google Gemini (`@google/genai`) |
| Pagos | Mercado Pago (`mercadopago`) — **solo sandbox** |
| Scraping | API pública VTEX (Carrefour, Día, Jumbo) |
| Validación | Zod |
| Testing | Vitest |
| Hosting | Vercel (deploy continuo + cron jobs) |

## Estructura

```
app/            # App Router: páginas, layouts y rutas API (app/api/*)
components/     # UI reutilizable (components/ui/) + componentes por feature
lib/            # Lógica de negocio: optimizer, nutrition, llm, mercadopago, supabase…
db/migrations/  # Migraciones SQL (000–009), con RLS en todas las tablas
scrapers/       # Scraper VTEX de supermercados
docs/           # Definición de producto, plan de implementación y prompts por fase
tests/          # Tests unitarios (Vitest)
```

Alias de imports: `@/*` → raíz del repo.

## Puesta en marcha

### Requisitos

- Node.js ≥ 18.17 y npm
- Un proyecto de [Supabase](https://supabase.com)
- Una API key de [Google Gemini](https://ai.google.dev)
- _(Opcional, para pagos)_ credenciales **TEST** de Mercado Pago

### 1. Clonar e instalar

```bash
git clone https://github.com/juanbag25/proyecto_progra_web.git
cd proyecto_progra_web
npm install
```

### 2. Variables de entorno

Copiá el ejemplo y completá los valores:

```bash
cp .env.example .env.local
```

`.env.example` documenta **cada** variable con notas de seguridad. Las esenciales:

| Variable | Para qué |
|----------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` · `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Cliente Supabase (público, protegido por RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | Rutas privilegiadas / cron (server-only, **bypassa RLS**) |
| `LLM_API_KEY` + `LLM_PROVIDER=gemini` | Motor nutricional (Gemini es el proveedor implementado) |
| `SCRAPE_SECRET` · `CRON_SECRET` | Bearer token para `POST /api/scrape` y el cron nocturno |
| `MP_ACCESS_TOKEN` · `MP_WEBHOOK_SECRET` · `NEXT_PUBLIC_APP_URL` · `MP_TEST_PAYER_EMAIL` | Suscripciones Mercado Pago (sandbox) |

> ⚠️ Todo lo que **no** lleva el prefijo `NEXT_PUBLIC_` es server-only. Nunca commitees `.env.local`.

### 3. Base de datos

Aplicá las migraciones de `db/migrations/` **en orden** (`000` → `009`) desde el SQL Editor de Supabase o con la CLI. Cada tabla se crea con Row Level Security habilitada. La migración `004_foods.sql` ya siembra el catálogo canónico de alimentos.

### 4. Cargar el catálogo de productos

La tabla `products` se llena scrapeando los supermercados:

```bash
curl -X POST http://localhost:3000/api/scrape \
  -H "Authorization: Bearer $SCRAPE_SECRET"
```

_(En producción lo dispara automáticamente el cron de Vercel todas las noches.)_

### 5. Levantar el dev server

```bash
npm run dev        # http://localhost:3000
```

## Scripts

| Comando | Qué hace |
|---------|----------|
| `npm run dev` | Dev server (Next.js) en `:3000` |
| `npm run build` | Build de producción |
| `npm run start` | Sirve el build de producción |
| `npm run lint` | ESLint (`next/core-web-vitals`) |
| `npm run typecheck` | Chequeo de tipos (`tsc --noEmit`) |
| `npm test` | Tests unitarios (Vitest) |
| `npm run format` | Formatea con Prettier |

## Deploy

Desplegado en **Vercel** con deploy continuo desde `main`. `vercel.json` define dos cron jobs:

- `POST /api/scrape` — refresco nocturno del catálogo (04:00).
- `GET /api/cron/reconcile-subscriptions` — reconciliación de suscripciones (06:00).

Cargá las mismas variables de entorno en el dashboard de Vercel (Production + Preview). El endpoint público `GET /api/health` sirve como smoke-test.

## Pagos (Mercado Pago)

La integración usa el flujo de **PreApproval (suscripciones)** con redirect a `init_point`, un webhook con validación de firma `x-signature` e idempotencia, y un cron de reconciliación de respaldo. **Siempre en sandbox / credenciales TEST — este proyecto nunca usa dinero real.**

## Documentación

- [`docs/project_definition/`](docs/project_definition/) — pitch, identidad de marca, estética y stack.
- [`docs/implementation_plan.md`](docs/implementation_plan.md) — roadmap por fases.
- [`docs/agent_prompts/`](docs/agent_prompts/) — especificación detallada de cada fase.
- [`CLAUDE.md`](CLAUDE.md) — guía de arquitectura y convenciones del repo.

## Contexto académico

Proyecto de la materia **Programación Web** (ITBA). Stack cerrado por consigna: Next.js + Tailwind + Supabase + Vercel + LLM.

---

_Licencia: ISC._
