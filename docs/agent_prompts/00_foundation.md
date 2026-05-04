# Fase 0 — Foundation & Tooling

3 prompts. Bootstrap del proyecto: Next.js + TS + Tailwind + Supabase + Vercel.

---

## P0.A — Inicializar Next.js + TypeScript + Tailwind + estructura base

````prompt
🎯 TAREA: 0.1, 0.2, 0.7 — Bootstrap del proyecto Next.js con TypeScript y Tailwind

📚 CONTEXTO OBLIGATORIO A LEER:
- docs/project_definition/06_tech_stack.md
- docs/implementation_plan.md (Fase 0)
- docs/agent_prompts/README.md (sección "Reglas inviolables")

🛠️ SKILLS / MCPs A USAR:
- init (al final, para generar CLAUDE.md con el codebase recién armado)

📋 INSTRUCCIONES:
1. Verificar que el repo no tenga ya un `package.json`. Si existe, parar y preguntar al usuario.
2. Inicializar Next.js 15+ con App Router, TypeScript, Tailwind, ESLint, src/ directory NO (usar root), import alias `@/*`:
   `npx create-next-app@latest . --typescript --tailwind --eslint --app --import-alias "@/*"`
3. Crear la estructura de carpetas adicional:
   - `components/ui/` (componentes de design system)
   - `components/` (componentes feature-specific)
   - `lib/` (utils, clients, helpers)
   - `lib/supabase/` (clientes server + browser)
   - `db/migrations/` (SQL versionado)
   - `scrapers/` (módulos de scraping, vacío por ahora)
   - `tests/` (tests E2E con Playwright más adelante)
4. Agregar `.gitignore` entries para `.env.local`, `.vercel`, `.next`, `node_modules`.
5. Limpiar `app/page.tsx` y dejar un placeholder con texto "FitList" centrado, fondo `bg-[#121212]`, texto blanco — para verificar que Tailwind funciona.
6. Limpiar `app/globals.css`, dejar sólo los `@tailwind` directives + un `body { background: #121212; color: #fff; }` mínimo.
7. Ejecutar `npm run dev` y verificar que arranque sin warnings.
8. Al terminar, invocar la skill `init` para generar `CLAUDE.md` con el contexto del codebase.

🙋 ACCIÓN HUMANA REQUERIDA: Ninguna en este prompt. Todo se hace localmente.

✅ CRITERIOS DE ACEPTACIÓN:
- `npm run dev` levanta en http://localhost:3000 sin warnings ni errores.
- La página muestra "FitList" centrado sobre fondo charcoal.
- Existen las carpetas `components/ui/`, `lib/supabase/`, `db/migrations/`, `scrapers/`, `tests/`.
- `tsc --noEmit` no tira errores.
- `CLAUDE.md` existe en el root con descripción del codebase.

📁 ARCHIVOS A CREAR / MODIFICAR:
- package.json, tsconfig.json, next.config.mjs, tailwind.config.ts, postcss.config.mjs
- app/layout.tsx, app/page.tsx, app/globals.css
- .gitignore
- CLAUDE.md
- (carpetas vacías con .gitkeep): components/ui, lib/supabase, db/migrations, scrapers, tests
````

---

## P0.B — Linting, formatting y env vars

````prompt
🎯 TAREA: 0.3, 0.5 — ESLint + Prettier + .editorconfig + manejo de env vars

📚 CONTEXTO OBLIGATORIO A LEER:
- docs/implementation_plan.md (Fase 0, tareas 0.3 y 0.5)
- package.json del repo (ya existe post-P0.A)

🛠️ SKILLS / MCPs A USAR:
- (ninguna especial)

📋 INSTRUCCIONES:
1. Configurar Prettier con un `.prettierrc.json` razonable:
   - 2 espacios de indentación
   - single quotes para JS/TS
   - trailing commas all
   - print width 100
   - Plugin `prettier-plugin-tailwindcss` para auto-ordenar clases.
2. Agregar `.prettierignore` con `node_modules`, `.next`, `dist`, `db/migrations`.
3. Ajustar `.eslintrc.json` (o `eslint.config.mjs` según versión) para que no choque con Prettier (`eslint-config-prettier`).
4. Crear `.editorconfig` con LF, UTF-8, indent 2, trim trailing whitespace.
5. Agregar scripts a `package.json`:
   - `"lint": "next lint"`
   - `"format": "prettier --write ."`
   - `"format:check": "prettier --check ."`
   - `"typecheck": "tsc --noEmit"`
6. Crear `.env.example` con placeholders comentados (sin valores reales) para:
   ```
   NEXT_PUBLIC_SUPABASE_URL=
   NEXT_PUBLIC_SUPABASE_ANON_KEY=
   SUPABASE_SERVICE_ROLE_KEY=
   LLM_API_KEY=
   LLM_PROVIDER=anthropic|openai|gemini
   FIRECRAWL_API_KEY=
   ```
7. Documentar cada variable en un comentario arriba.
8. Verificar que `.env.local` esté en `.gitignore`.

🙋 ACCIÓN HUMANA REQUERIDA: Ninguna todavía. Las claves reales se cargan en P0.C.

✅ CRITERIOS DE ACEPTACIÓN:
- `npm run lint` y `npm run format:check` corren limpios.
- `.env.example` está comiteado, `.env.local` no.
- Al guardar un archivo, las clases Tailwind se reordenan automáticamente (con la extensión Prettier del IDE).

📁 ARCHIVOS A CREAR / MODIFICAR:
- .prettierrc.json, .prettierignore, .editorconfig
- eslint.config.mjs (o .eslintrc.json)
- package.json (scripts)
- .env.example
````

---

## P0.C — Supabase cloud + Vercel deploy

````prompt
🎯 TAREA: 0.4, 0.6 — Conectar Supabase cloud + deploy automático en Vercel

📚 CONTEXTO OBLIGATORIO A LEER:
- docs/project_definition/06_tech_stack.md (sección Supabase + Vercel)
- docs/implementation_plan.md (Fase 0)

🛠️ SKILLS / MCPs A USAR:
- supabase/agent-skills (si está instalado, úsalo para inicializar el cliente correctamente)

📋 INSTRUCCIONES:

PARTE 1 — Supabase
1. PAUSAR Y PEDIR AL USUARIO que haga lo siguiente, paso a paso:
   - Ir a https://supabase.com/dashboard, crear cuenta si no tiene.
   - Crear un proyecto nuevo llamado "fitlist-dev".
   - Elegir región más cercana (sudamérica si está disponible).
   - Anotar la database password en un lugar seguro.
   - Una vez creado, ir a Settings → API y copiar:
     - `Project URL`
     - `anon public key`
     - `service_role key` (¡secreta! sólo server-side)
   - Pegar las 3 cosas en el chat para continuar.
2. Cuando el usuario pegue las claves, escribirlas en `.env.local` (no comitear).
3. Instalar el SDK: `npm i @supabase/supabase-js @supabase/ssr`
4. Crear `lib/supabase/server.ts` y `lib/supabase/client.ts` siguiendo el patrón oficial de Supabase para Next.js App Router (server components vs client components).
5. Crear un endpoint de health check `app/api/health/route.ts` que haga una query trivial (ej: `select 1`) y devuelva JSON `{ ok: true }`.
6. Verificar localmente que `curl http://localhost:3000/api/health` devuelva `{ ok: true }`.

PARTE 2 — Vercel
7. PAUSAR Y PEDIR AL USUARIO que haga lo siguiente:
   - Ir a https://vercel.com, crear cuenta (puede usar GitHub OAuth).
   - Conectar el repo de FitList desde GitHub (si el repo aún no está en GitHub, pedirle al usuario que lo cree primero y haga `git remote add` + `git push`).
   - En Vercel, durante el import, agregar las env vars del paso anterior (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY) en la sección "Environment Variables".
   - Dejar que Vercel haga el primer deploy.
   - Pegar la URL del deploy en el chat.
8. Cuando el usuario pegue la URL, hacer `curl <url>/api/health` y verificar que devuelva `{ ok: true }`.

PARTE 3 — Migración cero
9. Crear `db/migrations/000_init.sql` con un comentario de placeholder explicando la convención (numerado secuencial, idempotente con `if not exists`, una migración por feature).

🙋 ACCIÓN HUMANA REQUERIDA: SÍ — el usuario debe crear cuentas y pegar las claves. Pausar el flow y comunicarse claramente.

✅ CRITERIOS DE ACEPTACIÓN:
- `.env.local` tiene las 3 claves de Supabase y `npm run dev` funciona.
- `/api/health` devuelve `{ ok: true }` localmente.
- El deploy en Vercel es accesible y `/api/health` también responde OK ahí.
- Push a la rama main dispara redeploy automático.

📁 ARCHIVOS A CREAR / MODIFICAR:
- .env.local (NO comitear)
- lib/supabase/server.ts, lib/supabase/client.ts
- app/api/health/route.ts
- db/migrations/000_init.sql
- package.json (deps)
````

---

## Cierre de fase

Al terminar P0.C, **antes de pasar a Fase 1**, ejecutar la skill `less-permission-prompts` para reducir interrupciones futuras de permisos. Luego pedir al usuario que confirme visualmente que el deploy en Vercel funciona.
