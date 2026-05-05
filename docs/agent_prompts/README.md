# FitList — Agent Prompts Guide

Esta carpeta contiene los **prompts listos para copy-paste** que se le pasan a un agente implementador para construir FitList fase por fase, según el roadmap en [`../implementation_plan.md`](../implementation_plan.md).

---

## 1. Cómo usar esta guía

### Workflow para cada prompt

1. **Abrí el archivo de la fase** que toca implementar (ej: `00_foundation.md`).
2. **Copiá el bloque de prompt** (todo el texto dentro del bloque ` ```prompt ` ).
3. **Pegalo en una sesión nueva del agente implementador**.
4. **Antes de ejecutar**, asegurate de tener instaladas las skills/MCPs que el prompt declara.
5. **Cuando el agente termine**, verificá los criterios de aceptación que figuran en el prompt.
6. **Si el prompt requiere una acción manual tuya** (ej: crear cuenta Supabase, agregar API key), va a estar marcado con el bloque `🙋 ACCIÓN HUMANA REQUERIDA` — el agente debe pausar y avisarte.

### Orden recomendado

Las fases son **secuenciales**. No empieces la fase N+1 hasta que la fase N tenga todos sus criterios de aceptación cumplidos.

Dentro de una misma fase, los prompts están numerados en orden de ejecución (ej: `P0.A` → `P0.B` → `P0.C`).

---

## 2. Skills y MCPs requeridos

Antes de empezar, instalá / habilitá lo siguiente. Algunos son skills locales de Claude Code, otros son MCPs externos.

### Skills locales (ya disponibles)

| Skill                            | Cuándo se usa        | Para qué                                                  |
| -------------------------------- | -------------------- | --------------------------------------------------------- |
| `init`                           | Fase 0               | Inicializar `CLAUDE.md` con contexto del codebase         |
| `update-config`                  | Fase 0, 5            | Configurar `settings.json`, hooks, env vars               |
| `less-permission-prompts`        | Después de Fase 0    | Reducir interrupciones de permisos                        |
| `claude-api`                     | Fase 4               | Si decidimos usar Claude API como LLM nutricional         |
| `simplify`                       | Después de cada fase | Revisar calidad y refactor del código                     |
| `review`                         | Post-implementación  | Code review formal de PR                                  |
| `security-review`                | Fase 2, 5, 9         | Auditoría de seguridad (auth, scraping, launch)           |
| `anthropic-skills:theme-factory` | Fase 1               | Apoyo en theming de showcase pages                        |
| `anthropic-skills:skill-creator` | Si surge             | Crear skills custom para FitList si las tareas se repiten |

### MCPs externos a instalar (críticos para Fase 5 — scraping)

#### Supabase MCP — `supabase/agent-skills`

Skill oficial de Supabase para Next.js, Auth, RLS, migrations. **Recomendado para Fases 2, 3, 4, 5, 6, 8.**

- Repo: <https://github.com/supabase/agent-skills>
- Docs: <https://supabase.com/docs/guides/getting-started/ai-skills>

#### Firecrawl MCP — para scraping con JS rendering

Maneja JavaScript, paginación, sitios anti-bot. Servicio managed (free tier disponible).

- Repo: <https://github.com/firecrawl/firecrawl-mcp-server>
- Docs: <https://docs.firecrawl.dev/mcp-server>
- **Decisión:** primera opción para Carrefour, Coto, Jumbo, Dia. Si el costo escala, evaluar Playwright local como fallback.

#### Playwright MCP — fallback para scraping local sin costo

Browser automation real, sin credenciales, todo local. Usa snapshots de accesibilidad (4x menos tokens).

- Doc: <https://claudefa.st/blog/tools/mcp-extensions/browser-automation>

#### Web Scraper Skill — `yfe404/web-scraper`

Selecciona automáticamente la estrategia correcta (Cheerio para HTML estático, Playwright para SPA). Útil como capa de abstracción.

- Repo: <https://github.com/yfe404/web-scraper>

#### Browserbase MCP — opcional, sólo si nos cazan los anti-bot

Cloud-hosted browsers con rotación de proxies, CAPTCHA solving, fingerprint management.

- Para sitios protegidos por Cloudflare. **No instalar a priori** — sólo si los otros fallan.

### Directorios para descubrir más

- <https://claudemarketplaces.com/skills> — 4,200+ skills de Claude Code.
- <https://mcpservers.org/agent-skills> — Agent Skills Library.
- <https://fastmcp.me/MCP/Explore?category=Browser+Automation> — MCPs de browser automation.

---

## 3. Convenciones de los prompts

Cada prompt sigue esta estructura:

```
🎯 TAREA: [ID y nombre del roadmap]

📚 CONTEXTO OBLIGATORIO A LEER:
- docs/project_definition/01_app_overview.md
- docs/project_definition/[archivos relevantes]
- docs/implementation_plan.md (la fase y tarea correspondiente)

🛠️ SKILLS / MCPs A USAR:
- [lista]

📋 INSTRUCCIONES:
[descripción detallada paso a paso]

🙋 ACCIÓN HUMANA REQUERIDA:
[Si el agente necesita que el usuario haga algo, debe PAUSAR y pedirlo aquí]

✅ CRITERIOS DE ACEPTACIÓN:
- [lista de checks visuales y funcionales]

📁 ARCHIVOS A CREAR / MODIFICAR:
- [paths exactos]
```

---

## 4. Reglas inviolables para todos los agentes

Cada prompt incluye estas reglas como recordatorio, pero las dejo acá centralizadas:

1. **Stack inamovible:** Next.js + Tailwind + Supabase + Vercel + LLM API. Cualquier dependencia adicional debe justificarse en un comentario al usuario antes de instalar.
2. **Lenguaje:** TypeScript (la preferencia del usuario, override del tech stack doc).
3. **Estética:** Dark mode obligatorio. Glassmorphism en cards. Paleta exacta: charcoal `#121212`, midnight `#0A0F1A`, cyan `#00F0FF`, mint `#00E676`, coral `#FF6B6B`. Fuentes Outfit / Inter. **Nunca verde genérico de "app de salud".**
4. **Tono de copys:** experto pero amigo, directo, motivador (ver `docs/project_definition/04_brand_identity.md`).
5. **RLS-first:** toda tabla Supabase nace con RLS habilitado. Sin excepción.
6. **Server-side secrets:** API keys de LLM y headers de scrapers nunca llegan al cliente.
7. **Si necesitás algo del usuario** (cuenta, key, decisión de producto), **pausá y pedile**. No improvises.
8. **No hagas commit ni push** salvo que el usuario te lo pida explícitamente.

---

## 5. Índice de fases

| Archivo                                              | Fase                   | Cantidad de prompts |
| ---------------------------------------------------- | ---------------------- | ------------------- |
| [`00_foundation.md`](./00_foundation.md)             | Foundation & Tooling   | 3                   |
| [`01_design_system.md`](./01_design_system.md)       | Design System & Brand  | 2                   |
| [`02_authentication.md`](./02_authentication.md)     | Authentication         | 1                   |
| [`03_onboarding.md`](./03_onboarding.md)             | Onboarding (Interview) | 2                   |
| [`04_nutrition_engine.md`](./04_nutrition_engine.md) | AI Nutrition Engine    | 2                   |
| [`05_scraping.md`](./05_scraping.md)                 | Web Scraping Layer     | 3                   |
| [`06_optimization.md`](./06_optimization.md)         | Optimization Algorithm | 2                   |
| [`07_shopping_list.md`](./07_shopping_list.md)       | Shopping List UI       | 3                   |
| [`08_feedback_loop.md`](./08_feedback_loop.md)       | Weekly Feedback Loop   | 1                   |
| [`09_polish_launch.md`](./09_polish_launch.md)       | Polish, Tests & Launch | 3                   |

**Total: 22 prompts** distribuidos en 10 fases.

---

## 6. Cuándo el agente debe pausar y pedirte algo

El agente implementador **DEBE** pausar y pedirte intervención manual cuando:

- Necesite **crear cuentas en servicios externos** (Supabase cloud, Vercel, OpenAI/Anthropic/Gemini, Sentry, etc.).
- Necesite **API keys o credenciales** que sólo vos podés generar.
- Necesite **instalar un MCP** que requiere config manual en `~/.claude/settings.json` o `~/.cursor/mcp.json`.
- Detecte una **decisión de producto ambigua** (ej: ¿qué fórmula de TDEE usamos? ¿qué supermercados priorizamos para v1?).
- Encuentre un **blocker legal/ToS** durante scraping.
- Vaya a **gastar dinero** (usar API paga, deploy con costo, suscripción).
- Termine una fase y necesite tu **aprobación visual** antes de pasar a la siguiente.

En todos estos casos, el agente debe escribirte un mensaje claro indicando:

1. Qué necesita.
2. Pasos exactos para hacerlo.
3. Qué hacer cuando esté listo (ej: "pegame la API key acá y continúo").

---

## 7. Cómo iterar este documento

Si durante la implementación descubrís que un prompt es ambiguo, fallaba, o que falta info: **abrí el archivo de la fase, ajustalo, y dejá una nota en el changelog al final del archivo**. La calidad de los prompts mejora con cada iteración.
