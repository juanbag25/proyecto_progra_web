# FitList — Implementation Roadmap

## Objetivo de este documento

Descomponer la construcción de FitList en fases secuenciales con tareas granulares, lo suficientemente acotadas como para que cada una pueda ser ejecutada por un único agente implementador en una sesión enfocada. Este documento es la fuente para promptear esos agentes.

## Cómo leer este roadmap

- **Las fases son secuenciales por defecto** (cada una construye sobre la anterior). Las tareas dentro de una fase a veces pueden paralelizarse.
- Cada tarea incluye: descripción, archivos afectados (orientativo), criterios de aceptación.
- Antes de implementar cualquier UI, el agente debe leer `docs/project_definition/05_aesthetics.md` y `04_brand_identity.md`.
- Antes de tocar el stack, el agente debe leer `docs/project_definition/06_tech_stack.md`.
- Stack inamovible: **Next.js + Tailwind + Supabase + Vercel + LLM API**. Agregar dependencias requiere justificación.

## Fases

| #   | Fase                         | Estado              | Resumen                                                                  |
| --- | ---------------------------- | ------------------- | ------------------------------------------------------------------------ |
| 0   | Foundation & Tooling         | ✅ DONE              | Bootstrap Next.js + Tailwind + Supabase + Vercel                         |
| 1   | Design System & Brand Layer  | ✅ DONE              | Theme, fuentes, 14 componentes UI, glassmorphism                         |
| 2   | Authentication               | ✅ DONE              | Sign up / login / logout / RLS / middleware                              |
| 3   | Onboarding (The Interview)   | ✅ DONE              | Flow swipeable de 7 steps + review + edit                                |
| 4   | AI Nutrition Engine          | ✅ DONE              | TDEE + Gemini 2.5 Flash + zod validation + fallback determinístico       |
| 5   | Web Scraping Layer           | 🟡 P5.A done · P5.B WIP | 3 cadenas VTEX (Coto descartado) + tabla `foods` canónica + match fuzzy |
| 6   | Optimization Algorithm       | ⏳ Pending           | Greedy con JOIN products+foods, infeasibility messaging                  |
| 7   | Shopping List UI & Dashboard | ⏳ Pending           | UX premium con check-off animado y rings en tiempo real                  |
| 8   | Weekly Feedback Loop         | ⏳ Pending           | Recalibración semanal por peso/adherencia                                |
| 9   | Polish, Testing & Launch     | ⏳ Pending           | E2E, a11y, performance, SEO, deploy producción                           |

---

## Fase 0 — Foundation & Tooling ✅ DONE

**Meta:** Repo arrancando con Next.js + Tailwind + Supabase + deploy automático en Vercel.

### Tareas

- **0.1** ✅ Inicializar proyecto Next.js 14 + TypeScript + App Router + import alias `@/*`. _(commit 14986c1)_
- **0.2** ✅ Tailwind CSS + PostCSS configurados. _(commit 14986c1)_
- **0.3** ✅ ESLint + Prettier + `.editorconfig` + `prettier-plugin-tailwindcss`. _(commit fc8977f)_
- **0.4** ✅ Proyecto Supabase `fitlist-dev` creado (ref `rjvzmpiwenneasbnlmto`, `sa-east-1`). Carpeta `db/migrations/` con `000_init.sql`. _(commit 62c0a47)_
- **0.5** ✅ `.env.example` documentado con placeholders comentados. _(commit fc8977f)_
- **0.6** ✅ Repo conectado a Vercel; preview deploys automáticos por push.
- **0.7** ✅ Estructura: `app/`, `components/`, `components/ui/`, `lib/`, `lib/supabase/`, `db/migrations/`, `scrapers/`, `tests/` (placeholders con `.gitkeep`). _(commit 14986c1)_

**Aceptación:** ✅ `npm run dev` levanta limpio; Tailwind funciona; `/api/health` devuelve `{ ok: true }` en local y en Vercel; push a `main` redeploya.

**Archivos creados:** `package.json`, `next.config.js` (NO `.mjs`), `tailwind.config.js` (NO `.ts` — package es CommonJS), `postcss.config.js`, `tsconfig.json`, `.env.example`, `.eslintrc.json`, `.prettierrc.json`, `.editorconfig`, `lib/supabase/server.ts`, `lib/supabase/client.ts`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`, `app/api/health/route.ts`, `db/migrations/000_init.sql`, `CLAUDE.md`.

**Pendiente menor:** rotar `service_role` key cuando la app deje el modo dev preview.

---

## Fase 1 — Design System & Brand Layer 🟡 MOSTLY DONE

**Meta:** Codificar la identidad (dark mode, glass, acentos) como theme Tailwind + componentes reutilizables.

> **Nota:** el spec original asumía naming plano (charcoal/midnight/cyan.DEFAULT). El scaffold real usa **naming semántico** (`canvas.*`, `accent.*`, `warn.*`, `font-display` vs `font-sans`, `shadow-glow-{color}`, etc.) — está documentado como ley de marca en `CLAUDE.md` y es la fuente de verdad. Ver "Convenciones del codebase" en `agent_prompts/README.md` §4.1.

### Tareas

- **1.1** ✅ `tailwind.config.js` con paleta semántica (`canvas.{base,raised,elevated}`, `accent.{cyan,mint}`, `warn.{coral,orange}`, `hairline`, `glass`), gradients (`mesh-hero`, `accent-gradient`, `warn-gradient`), glow shadows por acento, `ease-premium`, animación `fade-up`, fuentes Outfit (`font-display`) e Inter (`font-sans`).
- **1.2** 🟡 `globals.css` con dark mode forzado, `.glass`/`.glass-strong`/`.tabular`, selección de texto en cyan @ 25%, scrollbar custom, slider/select custom. **Falta:** `scroll-behavior: smooth` envuelto en `prefers-reduced-motion: no-preference`. → **P1.A.1**.
- **1.3** 🟡 Componentes UI base (`components/ui/`):
  - ✅ `GlassCard` (con variantes `glass` / `glass-strong`)
  - ✅ `Button` (variants `primary`, `secondary`, `ghost`, sizes sm/md/lg)
  - ✅ `Input`, `Select`, `Slider`, `RadialProgress`, `Typography`, `ColorSwatch`, `GroceryCard`
  - ⏳ `NumberInput`, `Modal`, `Sheet`, `Toast`, `SwipeableCard` → **P1.B**
- **1.4** ✅ Mesh gradient como token Tailwind: `bg-mesh-hero` (radial layers cyan + mint + coral).
- **1.5** ✅ Showcase en `/design-system` (NO `/dev/components`). Hay que extenderlo cuando lleguen los 5 componentes nuevos.

**Aceptación:** Showcase muestra cada componente; dark mode impecable; glassmorphism renderiza bien en Chrome/Safari/Firefox; fuentes cargan sin FOUT.

**Archivos:** `tailwind.config.js`, `app/globals.css`, `components/ui/*`, `app/design-system/page.tsx`.

---

## Fase 2 — Authentication

**Meta:** Usuarios pueden registrarse, ingresar, salir, de forma segura. Datos protegidos con RLS.

### Tareas

- **2.1** Configurar Supabase Auth (email/password como mínimo).
- **2.2** Página `/sign-up` y `/login` con estilo de marca.
- **2.3** Flow de logout.
- **2.4** Middleware Next.js para proteger rutas `/app/*`.
- **2.5** Tabla `users_profile` (RLS habilitado; sólo el dueño lee/escribe).
- **2.6** Shell `/app` post-login (vacío con empty state por ahora).
- **2.7** Email verification + reset de password.

**Aceptación:** Usuario nuevo se registra → verifica email → ingresa → ve `/app` → cierra sesión. `/app` sin sesión → redirect a `/login`. RLS impide cross-user reads (verificado con dos cuentas).

**Archivos:** `app/(auth)/sign-up/page.tsx`, `app/(auth)/login/page.tsx`, `middleware.ts`, `lib/auth.ts`, `db/migrations/001_users.sql`.

---

## Fase 3 — Onboarding (The Interview)

**Meta:** Flow swipeable de cards que captura el perfil completo.

### Tareas

- **3.1** State machine del onboarding (steps + persistencia draft por step).
- **3.2** Step 1 — Biometría (edad, peso, altura, género).
- **3.3** Step 2 — Actividad (frecuencia de ejercicio, tipo, lifestyle sedentario/activo/atleta).
- **3.4** Step 3 — Objetivo fitness (hipertrofia, pérdida de grasa, recomp, fuerza, mantenimiento).
- **3.5** Step 4 — Preferencias (loves, hates, comidas favoritas).
- **3.6** Step 5 — Restricciones (alergias, intolerancias, vegano/vegetariano/celíaco).
- **3.7** Step 6 — Ubicación (país + región para mapeo de supermercados).
- **3.8** Step 7 — Presupuesto semanal de comida.
- **3.9** Pantalla de review + confirmación.
- **3.10** UI para reeditar perfil (rehacer la entrevista).

**Aceptación:** Usuario completa onboarding end-to-end con transiciones suaves; data persiste en Supabase por step; puede retomar a mitad de camino; puede editar después.

**Archivos:** `app/onboarding/*`, `components/onboarding/*`, `db/migrations/002_user_profiles.sql`, `lib/onboarding-machine.ts`.

---

## Fase 4 — AI Nutrition Engine

**Meta:** Calcular macro + micro targets semanales a partir del perfil, usando LLM + fórmulas.

### Tareas

- **4.1** Elegir proveedor LLM (OpenAI, Anthropic o Gemini); manejar API key server-side.
- **4.2** Diseñar system prompt para el "AI Nutritionist" (rol, evidencia, formato JSON estricto).
- **4.3** Implementar TDEE (Mifflin-St Jeor recomendado).
- **4.4** Lógica de ajuste por objetivo (déficit/superávit por porcentaje según goal).
- **4.5** API route `POST /api/nutrition/targets`: perfil → JSON con macros + micros semanales.
- **4.6** Validación de schema (zod) sobre la respuesta del LLM; rechazo si no cumple.
- **4.7** Tabla `nutrition_targets` (versionada por usuario y semana).
- **4.8** Panel "How we calculated this" en UI explicando el cálculo (transparencia = valor "Science-driven").

**Aceptación:** Perfil completo → targets dentro de rangos científicamente razonables; persisten; reproducibles; explicación visible.

**Archivos:** `app/api/nutrition/targets/route.ts`, `lib/nutrition/tdee.ts`, `lib/nutrition/llm-prompt.ts`, `db/migrations/003_nutrition_targets.sql`.

---

## Fase 5 — Web Scraping Layer

> **Realidad post P5.A** (decisiones registradas en `docs/scraping/research.md` + `compliance.md`):
> - **Coto descartado de v1** (Oracle ATG legacy, sin API pública, ToS bloqueada). Solo Carrefour + Dia + Jumbo (los 3 son **VTEX** → un único módulo compartido).
> - **Las cadenas no publican nutrición** en sus catálogos online. Por eso la nutrición se separó en una tabla canónica `foods` (~50 staples seedeados manualmente) y los `products` scrapeados linkean por FK opcional vía fuzzy match.
> - **Sin Firecrawl MCP**: arrancamos con `fetch()` nativo + UA realista. La API key de Firecrawl está en `.env.local` como fallback de código si Jumbo bloquea.

**Meta:** DB de productos + tabla canónica de alimentos viva por supermercado.

### Tareas

- **5.1** Investigar cada cadena (Carrefour, Coto, Jumbo, Dia): ¿hay catálogo público / API? ¿Anti-bot? ¿ToS? Documentar. ✅ DONE en P5.A.
- **5.2** Scraper module compartido (los 3 son VTEX). Función `searchVtex(domain, query)` paginada.
- **5.3** Schema split en dos tablas:
  - **`foods`** (canónico): `slug, name_es, category, search_terms[], kcal/protein/carbs/fats/fiber per 100g, micros_json, dietary flags, source`.
  - **`products`** (scrapeado): `external_id, chain, region, ean, food_id (FK), match_confidence, name, brand, price, list_price, unit, unit_multiplier, weight_g, image_url, source_url, last_seen_at`.
- **5.4** Categorías + queries (~30) cubriendo los staples seedeados.
- **5.5** Orquestador con rate limiting (1 req/2s por cadena) + retries + backoff.
- **5.6** Tabla `products` con índices por `chain + region`, `food_id`, `ean`.
- **5.7** Vercel Cron nightly para refresh de precios.
- **5.8** Páginas admin `/dev/products` y `/dev/foods` para inspeccionar la DB.
- **5.9** Compliance: documentado en `docs/scraping/compliance.md`. ✅ DONE.

**Aceptación:** Después de un run de `/api/scrape`, `select count(*) from products where chain in ('carrefour','dia')` >100; al menos un tercio con `food_id` populado.

**Archivos reales:** `scrapers/lib/{policy,types,queries,vtex,match,persist,run}.ts`, `scrapers/chains.ts`, `app/api/scrape/route.ts`, `app/dev/{products,foods}/page.tsx`, `db/migrations/004_foods.sql`, `db/migrations/005_products.sql`, `db/migrations/006_scrape_logs.sql`, `lib/supabase/admin.ts`, `vercel.json`.

---

## Fase 6 — Optimization Algorithm

**Meta:** Generar shopping list que cumpla macros/micros bajo presupuesto, respetando preferencias.

### Tareas

- **6.1** Formalizar el problema: variables de decisión (cantidad por producto), función objetivo, constraints (presupuesto, macros, restricciones, preferencias).
- **6.2** Decidir enfoque: LP solver (`javascript-lp-solver` o similar) vs heurístico greedy + scoring vs híbrido.
- **6.3** Filtrado de candidatos (excluir alergenos / restricciones / hated).
- **6.4** Optimizer core (resolver / scoring).
- **6.5** Soft constraints: variedad, preferencias del usuario.
- **6.6** Computar stats de salida: costo total, macros totales, % cobertura de cada micro.
- **6.7** API route `POST /api/shopping-list/generate`.
- **6.8** Tabla `shopping_lists` (versionada con timestamp).
- **6.9** Manejo de infeasibilidad: si presupuesto < mínimo viable, devolver mensaje claro con sugerencia.

**Aceptación:** Dado perfil + targets + DB de productos, optimizer devuelve lista dentro de ±5% de targets, ≤presupuesto, en <5s. Casos infactibles dan error claro.

**Archivos:** `lib/optimizer/*` (tipos, loadCandidates con JOIN products+foods, filter, score, build), `app/api/shopping-list/generate/route.ts`, `db/migrations/007_shopping_lists.sql` (renumerada porque 005 ahora es products y 006 es scrape_logs).

---

## Fase 7 — Shopping List UI & Dashboard

**Meta:** UX premium con check-off animado y dashboard de progreso en tiempo real.

### Tareas

- **7.1** Layout `/app/list`: dashboard sticky arriba + lista debajo.
- **7.2** Item card: imagen del producto (PNG transparente), nombre, marca, cantidad, precio, logo SVG del super.
- **7.3** Animación de check-off: tachado con swoop + dim del item.
- **7.4** Radial chart de macros "secured" (actualiza en tiempo real al chequear).
- **7.5** Radial chart de presupuesto (verde → naranja → rojo según consumo).
- **7.6** Header sticky: "Tu costo semanal: $X / Presupuesto $Y".
- **7.7** Estados: empty, loading, error.
- **7.8** Acciones: imprimir, share, exportar como texto plano.
- **7.9** Vista de historial (semanas pasadas).

**Aceptación:** Match visual con el vibe de marca (Nike Run Club + Apple Health). Check-off a 60fps. Charts en tiempo real. Mobile-responsive.

**Archivos:** `app/app/list/page.tsx`, `components/list/*`, `components/dashboard/*`.

---

## Fase 8 — Weekly Feedback Loop

**Meta:** Recalibración semanal según peso + adherencia.

### Tareas

- **8.1** Trigger de fin de semana (date-based o manual desde UI).
- **8.2** Form de feedback: "¿Terminaste la comida?", peso actual, ajuste de presupuesto, tweaks de preferencias.
- **8.3** Lógica de recalibración: ajustar TDEE/targets según delta de peso vs esperado.
- **8.4** Auto-trigger: scrape fresco + nueva generación de lista.
- **8.5** Comparativa "Semana pasada vs ésta" (macros + costo).
- **8.6** Gráfico de progreso a largo plazo (peso + adherence rate).

**Aceptación:** Usuario completa feedback → nueva lista generada con baseline actualizado y precios frescos. Historial muestra comparación.

**Archivos:** `app/app/feedback/page.tsx`, `lib/nutrition/recalibration.ts`, `app/api/feedback/submit/route.ts`, `db/migrations/008_feedback.sql`.

---

## Fase 9 — Polish, Testing & Launch

**Meta:** Production-ready v1.

### Tareas

- **9.1** E2E tests (Playwright) para flujos críticos: signup → onboarding → generar lista → check-off.
- **9.2** Auditoría a11y (WCAG AA): keyboard nav, screen reader labels, contraste sobre dark mode.
- **9.3** Performance: Lighthouse >90, image optimization, font preload.
- **9.4** SEO: meta tags, OG images, sitemap, robots.txt.
- **9.5** Error monitoring (Sentry o similar).
- **9.6** Analytics privacy-friendly (PostHog / Plausible).
- **9.7** Legal: privacy policy, ToS, cookie banner.
- **9.8** Deploy a producción + dominio custom.
- **9.9** Smoke test en producción + checklist de launch.

**Aceptación:** Deploy productivo pasa smoke test; dashboards de métricas vivos; sin issues críticos de a11y.

**Archivos:** `tests/*`, configs de Sentry / analytics, `app/(legal)/*`.

---

## Cross-cutting (aplica a TODAS las fases)

- **Branding:** todo cambio de UI debe revisar `docs/project_definition/05_aesthetics.md` antes de implementar.
- **Stack discipline:** mantenerse en Next.js + Tailwind + Supabase + Vercel + LLM API. Nuevas deps requieren justificación explícita.
- **RLS-first:** toda tabla Supabase nace con RLS habilitado.
- **Server-side secrets:** API keys de LLM y headers de scrapers nunca llegan al cliente.
- **Tono:** copys deben sonar "personal trainer experto pero amigo" (ver `04_brand_identity.md`).

## Riesgos y preguntas abiertas

- **Scraping legal:** ToS de cada cadena puede forzar fallback a input manual o partner APIs.
- **Costo LLM:** posiblemente caché agresivo o fallback determinístico para perfiles repetidos.
- **Performance del optimizer:** índices y tamaño de DB importan; si LP es muy lento, heurístico greedy.
- **Volatilidad de precios en Argentina:** quizás refresh más frecuente que nightly.
- **Cobertura nutricional de scraping:** los supers no siempre publican micros; puede requerir DB enriquecida con tabla USDA o equivalente local.

## Cómo se usa este roadmap para promptear agentes

1. Identificar la tarea (ej: 1.3 — `RadialProgress` component).
2. Promptear con: contexto de marca + tarea específica + archivos a tocar + criterios de aceptación.
3. Verificar contra criterios de aceptación antes de pasar a la siguiente.
4. Las fases se completan en orden; las tareas dentro de una fase a veces paralelizables si tocan archivos distintos.

Para los prompts concretos listos para copy-paste, ver [`agent_prompts/README.md`](./agent_prompts/README.md).
