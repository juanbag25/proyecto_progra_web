# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project: FitList

AI-powered weekly grocery shopping lists that auto-meet macro/micro nutrition targets within a user-defined budget, by scraping local Argentine supermarkets (Carrefour, Coto, Jumbo, Dia). The product pitch is in [docs/project_definition/01_app_overview.md](docs/project_definition/01_app_overview.md). Course context: ITBA "Programación Web" — this is a graded project, premium quality is expected.

## Build & dev

```
npm run dev        # Next.js dev server on :3000
npm run build      # production build
npm run start      # serve the build
npm run lint       # next lint (eslint + next/core-web-vitals)
npx tsc --noEmit   # type-check without emitting
```

No test runner is wired yet — Playwright lands in Phase 9 (`tests/`).

## How development is sequenced

This codebase is built **phase-by-phase from prompts**, not free-form. The roadmap is in [docs/implementation_plan.md](docs/implementation_plan.md) (Phases 0–9). Each phase has self-contained agent prompts in [docs/agent_prompts/](docs/agent_prompts/) (file `0X_*.md` per phase) — read the matching prompt before implementing. Phases are sequential; don't jump ahead unless the user explicitly asks.

When the user invokes something like `P0.A` or `P3.B`, look in `docs/agent_prompts/0X_*.md` for the spec, acceptance criteria, and the exact list of files to touch. Always re-read the prompt's "✅ CRITERIOS DE ACEPTACIÓN" before declaring a task done.

## Architecture (current state)

- **App Router** under `app/`. Root layout at [app/layout.tsx](app/layout.tsx) loads Outfit + Inter via `next/font/google`, hard-forces the `dark` class on `<html>`, and sets `bg-canvas-base`. Don't undo any of those — they're load-bearing for the brand.
- **Design system** lives in `components/ui/`. The showcase page is `/design-system` ([app/design-system/page.tsx](app/design-system/page.tsx)) — render it visually to QA components. New UI primitives go in `components/ui/`; feature-specific components go in `components/<feature>/`.
- **Path alias:** `@/*` resolves to the repo root (configured in [tsconfig.json](tsconfig.json)).
- **Empty-by-design placeholders** (one `.gitkeep` each, populated in later phases): `lib/`, `lib/supabase/`, `db/migrations/`, `scrapers/`, `tests/`.

## Brand & visual system — non-negotiable

This is a premium fitness tool (Nike Run Club × Apple Health vibe), not a generic health app. Three things are law:

1. **Palette** — defined as Tailwind tokens in [tailwind.config.js](tailwind.config.js). Always reference the tokens, never raw hex:
   - Backgrounds: `bg-canvas-base` (#0A0F1A midnight), `bg-canvas-raised` (#121212 charcoal), `bg-canvas-elevated` (#1E1E24)
   - Accents: `accent-cyan` (#00F0FF), `accent-mint` (#00E676)
   - Warnings / energy CTAs: `warn-coral` (#FF6B6B), `warn-orange` (#FF8E53)
   - Subtle surfaces: `bg-glass` (white @ 4%), `border-hairline` (white @ 5%)
   - Gradients: `bg-accent-gradient` (cyan → mint), `bg-warn-gradient`, `bg-mesh-hero` (radial backdrop for hero sections)
   - Glow shadows: `shadow-glow-cyan`, `shadow-glow-mint`, `shadow-glow-coral`, `shadow-inset-hairline`
   - Easing: `ease-premium` = `cubic-bezier(0.16, 1, 0.3, 1)` — use this on every transition
   - Animation: `animate-fade-up` for entrance reveals
2. **Typography** — Outfit (display, headings) and Inter (body) via CSS vars `--font-outfit` / `--font-inter`, exposed as `font-display` and `font-sans`. Loaded once in `app/layout.tsx`; don't reimport `next/font` elsewhere.
3. **Glassmorphism** — use the global `.glass` / `.glass-strong` classes from [app/globals.css](app/globals.css), or the [`GlassCard`](components/ui/GlassCard.tsx) component. Both produce the brand's signature semi-transparent + backdrop-blur surface. Numeric data should use the `.tabular` class.

**UI component pattern** (see [components/ui/Button.tsx](components/ui/Button.tsx)): `base` string + `variants` / `sizes` records keyed by union types, composed via template literals; ref-forwarding when the parent might need a DOM handle (see [GlassCard.tsx](components/ui/GlassCard.tsx)). Match this pattern when adding new primitives.

Before writing any UI: skim [docs/project_definition/05_aesthetics.md](docs/project_definition/05_aesthetics.md) and [04_brand_identity.md](docs/project_definition/04_brand_identity.md).

## Stack rules (from [docs/agent_prompts/README.md](docs/agent_prompts/README.md))

- **Stack is locked:** Next.js + Tailwind + Supabase + Vercel + LLM API. Any new dependency requires explicit user approval — flag it and wait.
- **TypeScript, not JavaScript.** This overrides [docs/project_definition/06_tech_stack.md](docs/project_definition/06_tech_stack.md), which says JS — the user's confirmed preference is TS.
- **RLS-first:** every Supabase table is created with Row Level Security enabled. No exceptions.
- **Secrets stay server-side:** LLM API keys and scraper headers must never reach the client bundle.
- **Copy tone:** "expert personal trainer who is also your friend" — confident, data-backed, motivating, never preachy. See [04_brand_identity.md](docs/project_definition/04_brand_identity.md).
- **No commits or pushes** unless the user explicitly asks.

## When to pause and ask the user

Per [docs/agent_prompts/README.md](docs/agent_prompts/README.md) §6, hard-pause when you need:

- A new external account (Supabase, Vercel, OpenAI/Anthropic/Gemini, Sentry, etc.)
- API keys or credentials only the user can generate
- An MCP install that requires editing global Claude settings
- A product decision flagged ambiguous (TDEE formula, supermarket priority for v1, etc.)
- To spend money or hit a paid API for the first time
- Visual approval at the end of a phase before moving to the next
- A scraping ToS / legal blocker
