# Fase 5 — Web Scraping Layer

3 prompts. La fase más compleja del proyecto. Aprovecha skills/MCPs externos para no reinventar.

---

## P5.A — Investigación + setup de MCPs de scraping

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

## P5.B — Scrapers por cadena + schema de productos

````prompt
🎯 TAREA: 5.2, 5.3, 5.4, 5.6 — Scrapers + schema normalizado + DB de productos

📚 CONTEXTO OBLIGATORIO A LEER:
- docs/scraping/research.md (de P5.A)
- docs/scraping/compliance.md
- docs/implementation_plan.md (Fase 5)

🛠️ SKILLS / MCPs A USAR:
- Firecrawl MCP (estrategia primaria)
- Web Scraper Skill (yfe404/web-scraper) para detectar automáticamente Cheerio vs browser
- Playwright MCP (fallback)

📋 INSTRUCCIONES:

PARTE 1 — Schema y migración
1. Crear migración `db/migrations/004_products.sql`:
   ```sql
   create table if not exists products (
     id uuid primary key default gen_random_uuid(),
     external_id text not null,
     chain text not null check (chain in ('carrefour','coto','jumbo','dia')),
     region text not null,
     category text,
     name text not null,
     brand text,
     price numeric(10,2) not null,
     currency text not null default 'ARS',
     unit text,
     weight_g numeric,
     calories_per_100g numeric,
     protein_per_100g numeric,
     carbs_per_100g numeric,
     fats_per_100g numeric,
     fiber_per_100g numeric,
     micros_json jsonb default '{}'::jsonb,
     image_url text,
     source_url text,
     last_seen_at timestamptz default now(),
     unique(chain, external_id, region)
   );

   create index if not exists products_chain_region_idx on products(chain, region);
   create index if not exists products_category_idx on products(category);
   create index if not exists products_protein_per_100g_idx on products(protein_per_100g desc);

   -- products es read-only para users normales, sólo se escribe desde server con service role
   alter table products enable row level security;
   create policy "all authenticated users can read products" on products
     for select using (auth.role() = 'authenticated');
   ```
2. PAUSAR Y PEDIR AL USUARIO que ejecute la migración.

PARTE 2 — Lista de categorías base
3. Crear `scrapers/lib/categories.ts` con la cobertura inicial:
   ```ts
   export const CATEGORIES = [
     'protein_animal',  // pollo, carne, pescado, huevos
     'protein_vegetal', // legumbres, tofu, seitán
     'carbs_grain',     // arroz, avena, fideos, pan
     'carbs_tuber',     // papa, batata
     'fats_oil',        // aceite oliva, palta
     'fats_nuts',       // almendras, nueces
     'dairy',           // leche, yogur, queso
     'vegetable',       // verduras frescas y congeladas
     'fruit',
     'condiment',
   ] as const;
   ```
4. Crear `scrapers/lib/queries.ts` con queries iniciales por categoría que vamos a buscar (ej: "pollo", "arroz", "atún en lata", etc.).

PARTE 3 — Schema TS y validador
5. Crear `scrapers/lib/types.ts` con type `RawProduct` (lo que devuelve un scraper) y `NormalizedProduct` (lo que va a DB). Validador zod.
6. Crear `scrapers/lib/normalize.ts` con función `normalize(raw, chain, region) → NormalizedProduct` que:
   - Parsea precio (limpiar `$`, `.`, `,`).
   - Parsea peso/volumen del nombre o de un campo dedicado.
   - Calcula nutrición per 100g si viene per serving.
   - Llena con `null` lo que no haya.

PARTE 4 — Scrapers por cadena
7. Crear interface común en `scrapers/lib/scraper.ts`:
   ```ts
   export interface Scraper {
     chain: string;
     searchProducts(query: string, region: string): Promise<RawProduct[]>;
     getProductDetails(externalId: string): Promise<RawProduct | null>;
   }
   ```
8. Crear un scraper por cadena en `scrapers/<chain>.ts`. La implementación depende de la investigación de P5.A. Estrategias típicas:
   - Si hay API JSON: `fetch` directo + parseo. Ej: `scrapers/carrefour.ts` que pega a `https://www.carrefour.com.ar/api/...`.
   - Si requiere JS: usar el MCP de Firecrawl. Llamar `mcp__firecrawl__scrape` con la URL de búsqueda y un schema de extracción.
   - Si Firecrawl no alcanza: Playwright MCP local con `mcp__playwright__navigate` + selector de items.
9. Cada scraper debe respetar:
   - Rate limit: max 1 req/2s.
   - User-Agent identificable: `FitList Bot - Personal Use - <user-email>`.
   - Timeout 30s con retry exponencial.

PARTE 5 — Persistencia
10. Crear `scrapers/lib/persist.ts` con función `upsertProducts(products[])` que hace UPSERT a `products` por `(chain, external_id, region)`. Usa Supabase service role client.
11. Crear `scrapers/lib/run.ts` con `runScraper(chain, region)` que:
    - Itera sobre todas las queries de `queries.ts`.
    - Llama al scraper correspondiente.
    - Normaliza y upserta.
    - Loguea progreso.

🙋 ACCIÓN HUMANA REQUERIDA: SÍ — ejecutar migración SQL.

✅ CRITERIOS DE ACEPTACIÓN:
- `npx tsx scrapers/lib/run.ts carrefour buenos_aires` puebla >100 productos en DB sin errores.
- Lo mismo para coto, jumbo, dia (al menos los que la investigación marcó como factibles).
- Cada producto tiene al menos: name, price, source_url. Los nutricionales pueden ser null.
- No se pisan datos entre regiones.

📁 ARCHIVOS A CREAR:
- scrapers/lib/categories.ts, queries.ts, types.ts, normalize.ts, scraper.ts, persist.ts, run.ts
- scrapers/carrefour.ts, scrapers/coto.ts, scrapers/jumbo.ts, scrapers/dia.ts
- db/migrations/004_products.sql
````

---

## P5.C — Orquestación + cron + admin panel

````prompt
🎯 TAREA: 5.5, 5.7, 5.8 — Orquestador robusto + Vercel Cron + admin /dev/products

📚 CONTEXTO OBLIGATORIO A LEER:
- docs/implementation_plan.md (Fase 5)
- scrapers/* (de P5.B)

🛠️ SKILLS / MCPs A USAR:
- security-review (al final)
- update-config (para Vercel cron config si fuera necesario)

📋 INSTRUCCIONES:

PARTE 1 — Orquestador robusto
1. Mejorar `scrapers/lib/run.ts` con:
   - Rate limit centralizado por cadena (usar `bottleneck` o impl manual).
   - Retries con exponential backoff (max 3 intentos).
   - Logger estructurado (JSON) que escriba a `db/migrations/scrape_logs` y a stdout.
   - Modo "single product" (refresh sólo de 1 producto cuando se necesite).
2. Crear migración `db/migrations/005_scrape_logs.sql`:
   ```sql
   create table if not exists scrape_logs (
     id uuid primary key default gen_random_uuid(),
     chain text not null,
     region text not null,
     started_at timestamptz default now(),
     finished_at timestamptz,
     products_scraped int default 0,
     errors_count int default 0,
     status text check (status in ('running','success','partial','failed')),
     error_summary text
   );
   ```
3. PAUSAR Y PEDIR AL USUARIO ejecutar la migración.

PARTE 2 — API route protegida + Vercel Cron
4. Crear `app/api/cron/scrape/route.ts` (GET):
   - Protegido con header `Authorization: Bearer ${CRON_SECRET}`.
   - Itera por chains × regions activas.
   - Llama a `runScraper`.
   - Respuesta JSON con summary.
5. Generar un `CRON_SECRET` random y pedirle al usuario que lo agregue a Vercel env vars.
6. Crear `vercel.json` con:
   ```json
   {
     "crons": [
       { "path": "/api/cron/scrape", "schedule": "0 4 * * *" }
     ]
   }
   ```
   (4am UTC nightly = ~1am Argentina)
7. PAUSAR Y AVISAR al usuario que Vercel Cron requiere plan Pro o que confirme que su plan lo soporta. Si no, fallback: GitHub Actions + cron schedule + curl al endpoint con el secret.

PARTE 3 — Admin panel
8. Crear `app/dev/products/page.tsx`:
   - Server component con paginación y filtros (chain, region, category).
   - Lista de productos con: imagen, nombre, marca, cadena, región, precio, calorías/100g, last_seen_at.
   - Botón "Re-scrape ahora" (llama a `/api/cron/scrape` con el secret) → toast con resultado.
   - Stats: total productos, breakdown por cadena, % con datos nutricionales completos.
9. Esta ruta debe ser accesible sólo en dev O para usuarios con flag `is_admin = true` en `users_profile`. Por simplicidad para v1, dejar atrás de un check `process.env.NODE_ENV === 'development'`.

PARTE 4 — Verificación
10. Correr `security-review` con foco en:
    - El cron endpoint requiere bearer.
    - El service role key sólo está server-side.
    - Los inputs del scraper no son inyectables (queries hardcodeadas, no user-provided).
11. Verificar que `/dev/products` muestre productos reales.

🙋 ACCIÓN HUMANA REQUERIDA: SÍ — generar CRON_SECRET, cargarlo en Vercel; ejecutar migración SQL; confirmar plan de Vercel para crons.

✅ CRITERIOS DE ACEPTACIÓN:
- `vercel.json` con cron entry committed.
- `/api/cron/scrape` con bearer válido devuelve summary, sin bearer devuelve 401.
- Después de un run, hay logs en `scrape_logs` y productos actualizados.
- `/dev/products` muestra >500 productos cuando todas las queries corrieron.
- security-review limpio.

📁 ARCHIVOS A CREAR / MODIFICAR:
- scrapers/lib/run.ts (enhanced)
- app/api/cron/scrape/route.ts
- app/dev/products/page.tsx
- db/migrations/005_scrape_logs.sql
- vercel.json
- .env.local + Vercel env (CRON_SECRET)
````

---

## Cierre de fase

Validar end-to-end: el primer run del cron en Vercel debe poblar la DB. Si las cadenas más difíciles fallan, documentar y dejar para post-v1; con 2 de 4 cadenas funcionando podemos seguir.
