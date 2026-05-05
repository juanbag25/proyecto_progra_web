# Fase 0 — Foundation & Tooling

**Estado: ✅ DONE.** Las 3 sub-tareas (P0.A, P0.B, P0.C) ya fueron implementadas. Esta página queda como referencia histórica del trabajo hecho y como spec retro-aplicado por si hay que reproducir o auditar.

| Sub-fase | Commit                                                                 | Resumen                                                                       |
| -------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| P0.A     | `14986c1` — _P0.A: scaffold placeholder dirs and CLAUDE.md_            | Estructura de carpetas + `.gitkeep` + `CLAUDE.md` con la "ley de marca"       |
| P0.B     | `fc8977f` — _P0.B: Prettier + ESLint + .editorconfig + env scaffold_   | Toolchain de formato/lint + `.env.example` con todas las variables previstas  |
| P0.C     | `62c0a47` — _P0.C: Supabase SSR clients + /api/health + migration baseline_ | Clientes Supabase server/browser, health check, primer SQL                |

> **Importante:** El scaffold real difiere en algunos detalles del spec literal que escribí originalmente. Por ejemplo: `tailwind.config.js` (no `.ts`), naming semántico de tokens (`canvas.*`, `accent.*`, `warn.*` en vez de planos), separación `font-display` vs `font-sans`. Esa divergencia es **intencional y mejor que mi spec** — está cementada en `CLAUDE.md` como ley de marca. Si retomás esta fase, seguí lo que dice `CLAUDE.md`, no lo que dicen los prompts originales más abajo.

---

## P0.A — Inicialización + estructura base [DONE]

**Qué se hizo:**

- Scaffold Next.js 14 + TypeScript + Tailwind + ESLint con App Router e import alias `@/*`.
- Carpetas: `app/`, `components/ui/`, `lib/`, `lib/supabase/`, `db/migrations/`, `scrapers/`, `tests/` (cada placeholder con `.gitkeep`).
- `CLAUDE.md` generado con descripción del codebase + las 3 leyes inviolables de marca.
- `.gitignore` cubre `.env*.local`, `.next`, `.vercel`, `node_modules`, `.claude/`.

**Archivos clave creados:**

- `package.json`, `tsconfig.json`, `next.config.js`, `tailwind.config.js`, `postcss.config.js`
- `app/layout.tsx`, `app/page.tsx`, `app/globals.css`
- `CLAUDE.md`

**Diff vs spec original (notable):**

- Tailwind config es `.js` (CommonJS), no `.ts` — package es `"type": "commonjs"`.
- Next.js 14 (no 15+); decisión de stack-stability sobre la última disponible.

---

## P0.B — Linting, formatting, env vars [DONE]

**Qué se hizo:**

- Prettier configurado con `prettier-plugin-tailwindcss` (auto-orden de clases).
- ESLint con `eslint-config-prettier` para evitar conflictos.
- `.editorconfig` (LF, UTF-8, indent 2, trim trailing whitespace).
- Scripts en `package.json`: `lint`, `format`, `format:check`, `typecheck`.
- `.env.example` con placeholders comentados para Supabase, LLM, Firecrawl, etc.

**Archivos clave:**

- `.prettierrc.json`, `.prettierignore`, `.editorconfig`
- `.eslintrc.json`
- `.env.example`

---

## P0.C — Supabase cloud + clientes SSR + Vercel [DONE]

**Qué se hizo:**

- Proyecto Supabase creado: `fitlist-dev` (ref `rjvzmpiwenneasbnlmto`, región `sa-east-1`).
- Vercel conectado al repo, env vars cargadas (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`).
- SDK instalado: `@supabase/supabase-js`, `@supabase/ssr`.
- `lib/supabase/server.ts` y `lib/supabase/client.ts` siguiendo el patrón oficial de Supabase para Next.js App Router.
- `app/api/health/route.ts` que pega a la DB y devuelve `{ ok: true }` — funcionando en local y en deploy de Vercel.
- `db/migrations/000_init.sql` con la convención documentada (numerado secuencial, idempotente).

**Archivos clave:**

- `lib/supabase/server.ts`, `lib/supabase/client.ts`
- `app/api/health/route.ts`
- `db/migrations/000_init.sql`
- `.env.local` (no comiteado)

**TODO pendiente (de la memoria del usuario):** rotar `service_role` key cuando la app deje el modo "puramente local + dev preview".

---

## Cierre de Fase 0

`npm run dev` levanta limpio, `/api/health` responde `{ ok: true }` localmente y en Vercel preview, push a `main` dispara redeploy automático. **Todos los criterios cumplidos.** Pasar a Fase 1.
