# Fase 5 — Web Scraping Layer

| Sub-fase | Estado | Resumen |
|----------|--------|---------|
| P5.A | ✅ DONE | Investigación + decisiones registradas en [`docs/scraping/research.md`](../scraping/research.md) y [`docs/scraping/compliance.md`](../scraping/compliance.md). Coto out, 3 cadenas VTEX, no MCP. |
| P5.B | 🟡 IN PROGRESS | Migraciones 004+005 corridas. Resta: `scrapers/lib/*`, endpoint, primer scrape. |
| P5.C | ⏳ PENDING | Logs + cron + admin panel. |

3 prompts. La fase más compleja del proyecto.

---

## P5.A — Investigación + setup de MCPs de scraping [DONE]

```prompt
🎯 TAREA: 5.1, 5.9 — Investigación por cadena, decisión de stack de scraping, compliance

📚 CONTEXTO OBLIGATORIO A LEER:
- docs/project_definition/02_core_functionality.md (sección 3: Web Scraping)
- docs/project_definition/03_user_workflow.md (Phase 3)
- docs/implementation_plan.md (Fase 5)
- docs/agent_prompts/README.md (sección "MCPs externos a instalar")

🛠️ SKILLS / MCPs A USAR:
- Firecrawl MCP (https://github.com/firecrawl/firecrawl-mcp-server)
- Playwright MCP (fallback local)
- Web Scraper Skill (https://github.com/yfe404/web-scraper) para detección automática de estrategia

📋 INSTRUCCIONES:

PARTE 1 — Investigación por cadena
1. Para cada cadena (Carrefour AR, Coto, Jumbo, Dia AR), investigar y documentar en `docs/scraping/research.md`:
   - URL del catálogo online.
   - ¿Hay API JSON pública? (revisar Network tab del browser, buscar XHR a `/api/`).
   - ¿Es SPA con JS rendering necesario? ¿O HTML estático parseable con Cheerio?
   - ¿Tienen anti-bot? (Cloudflare, hCaptcha, etc.)
   - ¿Qué micros publican en la ficha del producto? (frecuentemente solo macros + sodio).
   - URL de robots.txt + ToS — copiar literal las cláusulas de uso automatizado.
   - **Veredicto:** API JSON > Cheerio > Firecrawl > Playwright > Browserbase (en orden de preferencia por costo/complejidad).
2. Cada cadena debe tener una sección con: nombre, estrategia recomendada, riesgos legales, riesgos técnicos.

PARTE 2 — Decisión y setup
3. PAUSAR Y RESUMIR AL USUARIO los hallazgos. Recomendar:
   - **Estrategia primaria:** Firecrawl MCP (managed, maneja JS, paginación, anti-bot básico).
   - **Fallback:** Playwright MCP local (gratis, más control).
   - **Sólo si los anteriores fallan:** Browserbase MCP (paga, anti-bot agresivo).
4. Pedirle al usuario que:
   - Cree cuenta en Firecrawl (https://firecrawl.dev) y obtenga API key (free tier disponible).
   - Pegue la API key en `.env.local` como `FIRECRAWL_API_KEY` y en Vercel env vars.
   - Instale el MCP siguiendo https://docs.firecrawl.dev/mcp-server (típicamente: agregar entry en `~/.claude/settings.json` o `~/.cursor/mcp.json`).
   - Confirme cuando esté listo.

PARTE 3 — Compliance check
5. Crear `docs/scraping/compliance.md` con:
   - Resumen de cláusulas de cada ToS.
   - Plan de mitigación: rate limiting agresivo (1 req/2s por cadena), User-Agent identificable, respect robots.txt.
   - **Fallback humano**: si una cadena prohíbe scraping, ofrecer al user en la app la opción de cargar productos manualmente o subir foto del ticket (out of scope para v1, pero documentar como roadmap).
6. Si alguna cadena prohíbe explícitamente scraping en su ToS, PAUSAR y discutir con el usuario qué hacer (puede que el caso de uso "uso personal con compras propias" caiga bajo fair use, pero hay que ser explícito sobre el riesgo).

🙋 ACCIÓN HUMANA REQUERIDA: SÍ — varias veces:
- Crear cuenta en Firecrawl y dar API key.
- Configurar MCPs locales (settings.json).
- Decidir cómo manejar cláusulas restrictivas de ToS.

✅ CRITERIOS DE ACEPTACIÓN:
- `docs/scraping/research.md` existe con info de las 4 cadenas.
- `docs/scraping/compliance.md` existe con plan de mitigación.
- Firecrawl API key cargada en env vars (local + Vercel).
- MCP de Firecrawl funciona (probar con `mcp__firecrawl__scrape` sobre un producto de Coto, por ejemplo).

📁 ARCHIVOS A CREAR:
- docs/scraping/research.md
- docs/scraping/compliance.md
- .env.local (FIRECRAWL_API_KEY)
```

---

## P5.B — Scrapers VTEX + tabla canónica `foods` + tabla `products` con FK

> **Refactor mayor vs spec original (decidido en P5.A):**
> - **Coto está descartado de v1** (es Oracle ATG legacy, sin API pública, ToS bloqueada al fetch). Las 3 cadenas restantes (Carrefour, Dia, Jumbo) son **VTEX** → un solo scraper compartido.
> - **Las cadenas no publican nutrición per producto**. Por eso la nutrición se separa en una tabla canónica `foods` (~50 staples seedeados manualmente) y los `products` scrapeados linkean a `foods` vía FK opcional + fuzzy match.
> - **Sin Firecrawl MCP**: arrancamos con `fetch()` nativo de Node + User-Agent realista. Firecrawl queda como fallback de código por si Jumbo bloquea (la API key vive en `.env.local`, sin instalar el MCP global de Claude).

````prompt
🎯 TAREA: 5.2, 5.3, 5.4, 5.6 — VTEX scraper compartido + foods canónicos + products

📚 CONTEXTO OBLIGATORIO A LEER:
- docs/scraping/research.md (de P5.A — VTEX endpoints, EAN flow, nutrition gap)
- docs/scraping/compliance.md (decisiones tomadas: 3 cadenas, manual seed, no MCP)
- docs/implementation_plan.md (Fase 5)
- lib/supabase/server.ts y lib/supabase/admin.ts (patrón de clientes)

🛠️ SKILLS / MCPs A USAR:
- Ninguna externa para arrancar. Si Jumbo bloquea, evaluar usar Firecrawl SDK directamente (no el MCP).

📋 INSTRUCCIONES:

PARTE 1 — Migraciones (foods primero, products después)
1. Crear migración `db/migrations/004_foods.sql`:
   - Tabla `foods` con: `slug`, `name_es`, `category` (enum CHECK), `search_terms text[]`, `kcal_per_100g`, `protein_per_100g`, `carbs_per_100g`, `fats_per_100g`, `fiber_per_100g`, `sodium_mg_per_100g`, `micros_json jsonb`, flags dietarios (`is_vegan`, `is_vegetarian`, `is_gluten_free`, `is_lactose_free`), `source` (`'manual_seed' | 'usda' | 'llm' | 'open_food_facts'`), `created_at`.
   - Indices en `category` y `slug`.
   - RLS habilitado, policy `authenticated read foods` (SELECT only — escritura siempre vía service role).
   - **Seed inline** (~50 staples) con `INSERT ... ON CONFLICT (slug) DO NOTHING`. Cubrir: 10 proteínas animales, 3 legumbres + 1 protein vegetal, 7 lácteos, 8 cereales/panes, 2 tubérculos, 2 aceites, 3 frutos secos, 9 vegetales, 8 frutas (incluyendo palta), condimentos. Valores per 100g de USDA SR-Legacy donde estén; AR-specific (yerba, pan lactal) estimados de packaging.

2. Crear migración `db/migrations/005_products.sql`:
   ```sql
   create table if not exists products (
     id uuid primary key default gen_random_uuid(),
     external_id text not null,                  -- VTEX productId
     chain text not null check (chain in ('carrefour', 'jumbo', 'dia')),
     region text not null default 'AR',
     ean text,                                   -- útil para cross-chain matching
     food_id uuid references foods(id) on delete set null,
     match_confidence numeric,                   -- 1.0 si search_term hit, null si no
     category text,
     name text not null,
     brand text,
     price numeric(10,2) not null,
     list_price numeric(10,2),                   -- pre-discount, para mostrar ahorro
     currency text not null default 'ARS',
     unit text,                                  -- 'un' | 'kg' | 'gr' | 'lt'
     unit_multiplier numeric,                    -- VTEX unitMultiplier
     weight_g numeric,
     image_url text,
     source_url text,
     last_seen_at timestamptz not null default now(),
     unique (chain, external_id, region)
   );
   create index products_chain_region_idx on products(chain, region);
   create index products_food_id_idx on products(food_id);
   create index products_ean_idx on products(ean);
   alter table products enable row level security;
   create policy "authenticated read products" on products
     for select using (auth.role() = 'authenticated');
   ```

3. PAUSAR Y PEDIR AL USUARIO ejecutar las dos migraciones en orden (004 primero, 005 después). Verificar `select count(*) from foods` ≈ 50 antes de seguir.

PARTE 2 — Cliente Supabase admin (server-only)
4. Crear `lib/supabase/admin.ts` que exporta `createAdminClient()` usando `SUPABASE_SERVICE_ROLE_KEY`. **Bypassea RLS** (necesario para que el scraper inserte sin sesión de usuario). Marcar con `import 'server-only'` para que Next falle el build si alguien lo importa de un client component.

PARTE 3 — Lib del scraper
5. Crear `scrapers/lib/policy.ts` con constantes de comportamiento:
   ```ts
   export const POLICY = {
     userAgent: 'Mozilla/5.0 (compatible; FitListBot/0.1; +https://github.com/...; academic-project)',
     rateLimitMs: 2000,                          // 1 req / 2s por cadena
     maxConcurrency: 1,
     retryBackoffsMs: [5_000, 15_000, 60_000],
     timeoutMs: 30_000,
     maxPagesPerQuery: 4,                        // 4 × 50 = 200 productos por query
   } as const;
   ```

6. Crear `scrapers/lib/types.ts` con types + zod schemas para la respuesta del API VTEX (subset que nos importa: productId, productName, brand, items[0].ean, items[0].measurementUnit, items[0].unitMultiplier, items[0].sellers[0].commertialOffer.{Price,ListPrice}, items[0].images[0].imageUrl, link).

7. Crear `scrapers/lib/queries.ts` con ~30 search queries que cubran los staples seedeados en `foods` (ej: 'leche', 'yogur', 'pollo', 'arroz', 'avena', 'fideos', 'aceite oliva', 'banana', 'palta', etc.).

8. Crear `scrapers/lib/vtex.ts` con la lógica VTEX compartida:
   - `searchVtex(domain, query, opts) → NormalizedProduct[]`: arma URL `https://${domain}/api/catalog_system/pub/products/search/${encodedQuery}?_from=N&_to=N+49`, pagina hasta `maxPagesPerQuery` o respuesta vacía/206, valida con zod, normaliza (precio en number, weight_g parseado del nombre o de unitMultiplier × 1000, source_url = link absoluto).
   - Aplica rate limit (sleep 2s entre páginas).
   - Usa `POLICY.userAgent`.
   - Retry exponencial en 5xx/429.

9. Crear `scrapers/lib/match.ts` con `matchToFood(productName, foodsCache) → { food_id, confidence } | null`:
   - Lowercase + remove diacritics + normalize whitespace.
   - Para cada food en cache, chequear si alguno de sus `search_terms[]` aparece como substring del nombre normalizado.
   - El primer match gana (los `search_terms` están ordenados de más específico a más genérico — "pechuga de pollo" antes que "pollo").
   - Confidence = 1.0 si hit; null si no.

10. Crear `scrapers/lib/persist.ts` con:
    - `loadFoodsCache(supabase) → Food[]` (read once por job).
    - `upsertProducts(supabase, products) → { upserted: number }` con UPSERT por `(chain, external_id, region)`, refresca `last_seen_at` siempre.

11. Crear `scrapers/lib/run.ts` con `runScraper(chainConfig) → ScrapeSummary`:
    - Cargar foods cache una sola vez.
    - Iterar sobre `QUERIES`, para cada una llamar `searchVtex(domain, query)`.
    - Para cada producto retornado, ejecutar `matchToFood(name, foodsCache)` y armar el row `Product` final.
    - Acumular en buffer; flush con `upsertProducts` cada 100 productos.
    - Devolver `{ chain, queriesRun, productsScraped, productsMatched, errors[] }`.

PARTE 4 — Configuración de cadenas
12. Crear `scrapers/chains.ts` con array `CHAINS`:
    ```ts
    export const CHAINS = [
      { id: 'carrefour', domain: 'www.carrefour.com.ar' },
      { id: 'dia',       domain: 'diaonline.supermercadosdia.com.ar' },
      { id: 'jumbo',     domain: 'www.jumbo.com.ar' },
    ] as const;
    ```
    > Coto NO está acá — fuera de scope v1 (ver `docs/scraping/compliance.md`).

PARTE 5 — Endpoint de control + secret
13. Generar un `SCRAPE_SECRET` random (≥32 chars). Agregarlo a `.env.local` y a `.env.example` (este último vacío con placeholder).

14. Crear `app/api/scrape/route.ts` (POST):
    - Validar header `Authorization: Bearer ${SCRAPE_SECRET}`. Sin match → 401.
    - Body opcional `{ chains?: ('carrefour'|'jumbo'|'dia')[] }`. Default: las 3.
    - Para cada chain, llamar `runScraper(config)` (serial, no paralelo — respeta rate limit por dominio independientemente).
    - Devolver JSON con summary por cadena.
    - `export const maxDuration = 300` (5 min — el scraper de las 3 cadenas con 30 queries puede llevar 3-4 min).

🙋 ACCIÓN HUMANA REQUERIDA: SÍ — ejecutar 004 y 005 en SQL Editor; copiar el `SCRAPE_SECRET` generado a Vercel env vars cuando deployemos.

✅ CRITERIOS DE ACEPTACIÓN:
- `npm run typecheck`, `npm run lint`, `npm test` (los 27 specs de tdee siguen pasando) limpios.
- Migraciones aplicadas, `select count(*) from foods` ≥ 50.
- `POST /api/scrape` con bearer válido devuelve summary; sin bearer → 401.
- Después de un run, `select count(*) from products where chain='carrefour'` > 100, idem para `dia`.
- Jumbo puede fallar — si el bearer-blocker aparece, documentar el síntoma y dejar para iteración con Firecrawl (no bloquea P5.B).
- `select count(*) from products where food_id is not null` > 30 (al menos un tercio de los productos matcheados a `foods`).

📁 ARCHIVOS A CREAR:
- db/migrations/004_foods.sql
- db/migrations/005_products.sql
- lib/supabase/admin.ts
- scrapers/lib/policy.ts
- scrapers/lib/types.ts
- scrapers/lib/queries.ts
- scrapers/lib/vtex.ts
- scrapers/lib/match.ts
- scrapers/lib/persist.ts
- scrapers/lib/run.ts
- scrapers/chains.ts
- app/api/scrape/route.ts
- .env.local + .env.example (SCRAPE_SECRET)
````

---

## P5.C — Logs de scraping + cron de Vercel + admin panel

> **Notas sobre P5.B vs spec original**: el endpoint de control vive en `/api/scrape` (no `/api/cron/scrape`), protegido por `SCRAPE_SECRET`. Esa misma ruta es la que llamará el cron. El número de migración acá es **006** porque 004=foods y 005=products.

````prompt
🎯 TAREA: 5.5, 5.7, 5.8 — Logs estructurados + Vercel Cron + admin /dev/products

📚 CONTEXTO OBLIGATORIO A LEER:
- docs/implementation_plan.md (Fase 5)
- scrapers/* (de P5.B)
- app/api/scrape/route.ts (endpoint que vamos a programar)

🛠️ SKILLS / MCPs A USAR:
- security-review (al final)

📋 INSTRUCCIONES:

PARTE 1 — Logs estructurados
1. Crear migración `db/migrations/006_scrape_logs.sql`:
   ```sql
   create table if not exists scrape_logs (
     id uuid primary key default gen_random_uuid(),
     chain text not null check (chain in ('carrefour', 'jumbo', 'dia')),
     started_at timestamptz not null default now(),
     finished_at timestamptz,
     queries_run int default 0,
     products_scraped int default 0,
     products_matched int default 0,
     errors_count int default 0,
     status text not null check (status in ('running','success','partial','failed')),
     error_summary text
   );
   alter table scrape_logs enable row level security;
   -- Sólo service role escribe; admins en /dev/products pueden leer.
   create policy "authenticated read scrape_logs" on scrape_logs
     for select using (auth.role() = 'authenticated');
   ```
2. PAUSAR Y PEDIR AL USUARIO ejecutar la migración.
3. Modificar `scrapers/lib/run.ts` para:
   - Insertar un row en `scrape_logs` con `status='running'` al arrancar.
   - Update con `status='success'/'partial'/'failed'` + counts + `finished_at` al terminar (incluso si falla).
   - Log estructurado JSON a stdout también (para Vercel logs).

PARTE 2 — Vercel Cron sobre `/api/scrape`
4. Crear `vercel.json`:
   ```json
   {
     "crons": [
       { "path": "/api/scrape", "schedule": "0 4 * * *" }
     ]
   }
   ```
   (4am UTC nightly = ~1am Argentina)
5. Vercel Cron envía un `Authorization: Bearer <CRON_SECRET>` automáticamente cuando hay `CRON_SECRET` en env vars del proyecto. Para que la misma ruta sirva al cron y al manual, aceptar **dos** secrets:
   - `SCRAPE_SECRET` (manual, dev) — el que ya existe de P5.B.
   - `CRON_SECRET` (Vercel cron) — leerlo desde env, comparar bearer contra cualquiera de los dos.
6. Generar un `CRON_SECRET` random y agregarlo a `.env.local` + Vercel env vars.
7. PAUSAR Y AVISAR al usuario que Vercel Cron en plan Hobby permite hasta 2 cron jobs/día con 1 hora de granularidad. Para granularidad menor, fallback: GitHub Actions con schedule + curl al endpoint con el SCRAPE_SECRET.

PARTE 3 — Admin panel
8. Crear `app/dev/products/page.tsx` (server component, gated por `process.env.NODE_ENV === 'development'`):
   - Filtros (query params): `chain`, `category` (de foods.category), `matched` (`true`/`false`/`all`).
   - Lista paginada de productos con JOIN a `foods` por `food_id`:
     - Imagen, nombre, marca, cadena, precio.
     - Si `food_id != null`: mostrar el `foods.name_es` matcheado + `foods.kcal_per_100g`.
     - Si `food_id is null`: mostrar "sin match" en coral.
   - Stats arriba: total productos por cadena, % con `food_id`, último `scrape_logs` por cadena (status + finished_at).
   - Botón "Re-scrape ahora" → POST a `/api/scrape` con el `SCRAPE_SECRET` desde un client component → toast con resultado.

9. Crear `app/dev/foods/page.tsx` (también dev-only) con un browser de la tabla `foods` para auditar los seeds y futuros enriquecimientos LLM:
   - Filtro por categoría.
   - Tabla con: name_es, slug, category, kcal_per_100g, protein, carbs, fats, source.

PARTE 4 — Verificación
10. Correr `security-review` con foco:
    - `/api/scrape` rechaza requests sin bearer válido.
    - El service role key NO está en `NEXT_PUBLIC_*`.
    - Los queries del scraper son hardcodeados (no user-provided), no hay risk de injection en el path del API VTEX.
    - `/dev/*` no está accesible en producción (NODE_ENV check).
11. Verificar visualmente `/dev/products` después de un re-scrape — al menos un tercio de los productos con `food_id` populado.

🙋 ACCIÓN HUMANA REQUERIDA: SÍ — ejecutar migración 006; generar y cargar `CRON_SECRET`; confirmar plan de Vercel cron.

✅ CRITERIOS DE ACEPTACIÓN:
- `vercel.json` con cron entry committed.
- `/api/scrape` con bearer válido (cualquiera de los dos secrets) devuelve summary; sin bearer → 401.
- Después de un run, hay rows en `scrape_logs` con status final.
- `/dev/products` lista productos con su match a `foods` cuando hubo match.
- `/dev/foods` muestra los ~50 staples seedeados.
- security-review limpio.

📁 ARCHIVOS A CREAR / MODIFICAR:
- scrapers/lib/run.ts (agregar logging a scrape_logs)
- app/api/scrape/route.ts (modificar para aceptar CRON_SECRET o SCRAPE_SECRET)
- app/dev/products/page.tsx
- app/dev/foods/page.tsx
- db/migrations/006_scrape_logs.sql
- vercel.json
- .env.local + Vercel env (CRON_SECRET)
````

---

## Cierre de fase

Validar end-to-end: el primer run del cron en Vercel debe poblar la DB. Si las cadenas más difíciles fallan, documentar y dejar para post-v1; con 2 de 4 cadenas funcionando podemos seguir.
