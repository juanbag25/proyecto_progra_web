# Fase 9 — Polish, Testing & Launch

3 prompts. Llevar la app de "funciona" a "lista para producción".

---

## P9.A — Tests E2E con Playwright

````prompt
🎯 TAREA: 9.1 — Tests E2E para flujos críticos

📚 CONTEXTO OBLIGATORIO A LEER:
- docs/implementation_plan.md (Fase 9)

🛠️ SKILLS / MCPs A USAR:
- Playwright MCP (también sirve para E2E)

📋 INSTRUCCIONES:
1. PAUSAR Y AVISAR AL USUARIO antes de instalar `@playwright/test`. Justificación: necesario para tests confiables. Pedirle aprobación.
2. Instalar Playwright: `npm i -D @playwright/test && npx playwright install chromium`.
3. Crear `playwright.config.ts` con:
   - baseURL: http://localhost:3000.
   - Browser: chromium (mobile viewport + desktop).
   - Reporter: html.
   - Use trace on retry.
4. Crear fixtures en `tests/e2e/fixtures/`:
   - `users.ts`: helpers para crear y limpiar test users vía Supabase Admin API.
   - `mock-data.ts`: profile válido de prueba.
5. Crear los siguientes tests E2E:
   - `tests/e2e/auth.spec.ts`: sign up → confirm email (mock o usar mailtrap) → login → logout.
   - `tests/e2e/onboarding.spec.ts`: completar los 7 steps + review + submit.
   - `tests/e2e/list-generation.spec.ts`: trigger generate → ver lista renderizada → tachar items → ver rings actualizar.
   - `tests/e2e/feedback.spec.ts`: simular paso de tiempo (manipular `created_at` en DB) → completar feedback → ver nueva lista.
6. Setup de DB de test:
   - Pedirle al usuario crear un proyecto Supabase **separado** para CI/tests.
   - Cargar las claves como secrets de GitHub si decidimos correr tests en CI.
7. Agregar script: `"test:e2e": "playwright test"`.
8. Crear `.github/workflows/e2e.yml` (sólo si el usuario confirma que quiere CI):
   - Trigger en PR a main.
   - Setup node, install deps, run Playwright.
   - Subir el report como artifact.

🙋 ACCIÓN HUMANA REQUERIDA: SÍ — aprobar instalación, crear proyecto Supabase de test, decidir si querés CI con GitHub Actions.

✅ CRITERIOS DE ACEPTACIÓN:
- `npm run test:e2e` corre los 4 specs en local.
- Todos pasan.
- Si CI está habilitado: workflow corre en cada PR.

📁 ARCHIVOS A CREAR:
- playwright.config.ts
- tests/e2e/fixtures/users.ts, mock-data.ts
- tests/e2e/auth.spec.ts
- tests/e2e/onboarding.spec.ts
- tests/e2e/list-generation.spec.ts
- tests/e2e/feedback.spec.ts
- .github/workflows/e2e.yml (opcional)
- package.json (scripts + dev deps)
````

---

## P9.B — Accesibilidad + Performance + SEO

````prompt
🎯 TAREA: 9.2, 9.3, 9.4 — A11y audit, perf optimization, SEO básico

📚 CONTEXTO OBLIGATORIO A LEER:
- docs/implementation_plan.md (Fase 9)
- docs/project_definition/04_brand_identity.md (para meta tags y OG)

🛠️ SKILLS / MCPs A USAR:
- review (al final, code review formal del PR de polish)

📋 INSTRUCCIONES:

PARTE 1 — Accesibilidad (WCAG AA)
1. Auditoría con axe-core: instalar `@axe-core/playwright` y agregar un spec `tests/e2e/a11y.spec.ts` que recorra las rutas principales (/, /sign-up, /login, /onboarding, /app, /app/list) y assertee no violations.
2. Verificar manualmente:
   - Keyboard nav: todos los botones/inputs alcanzables con Tab. Focus ring visible (cyan glow).
   - Screen reader labels: todo `<button>` sin text tiene `aria-label`. Inputs tienen `<label>` asociado.
   - Contraste: pasar todos los textos por https://webaim.org/resources/contrastchecker/ contra el fondo charcoal. Mínimo AA (4.5:1).
   - Animaciones: respetar `prefers-reduced-motion` (reducir/desactivar las animaciones de SwipeableCard, RadialProgress, etc.).
3. Aplicar fixes encontrados.

PARTE 2 — Performance
4. Correr Lighthouse en /app/list (con datos reales) y en /. Target: ≥90 en Performance.
5. Optimizaciones típicas:
   - Imágenes con `next/image` con `sizes` correctos y `priority` solo en above-the-fold.
   - Preload de fuentes en `<head>` (next/font ya lo hace).
   - Code splitting: dynamic imports para componentes pesados (ProgressChart, ItemCard nunca se rompen los charts).
   - Eliminar re-renders innecesarios (React.memo en ItemCard).
   - Bundle analyzer: `npm i -D @next/bundle-analyzer` y revisar.
6. Server: cachear queries pesadas (products list) con `revalidate: 3600` o `unstable_cache`.

PARTE 3 — SEO
7. `app/layout.tsx`: meta tags dinámicos:
   - title default: "FitList — Tu lista de compras inteligente".
   - description: "Cumplí tus objetivos fitness sin contar calorías. Solo comprá lo que está en la lista".
   - OG image: crear una imagen 1200x630 con la skill `anthropic-skills:canvas-design` o el theme-factory. Tema dark + acentos cyan/mint, mock de la app.
   - twitter:card summary_large_image.
8. Crear `app/sitemap.ts` con las rutas públicas.
9. Crear `app/robots.ts` que permita indexación de las rutas públicas y bloquee `/app/*`, `/dev/*`, `/api/*`.
10. Verificar que `/app/list` no se indexe (es privado).

PARTE 4 — Code review
11. Al terminar todos los fixes, invocar la skill `review` con un resumen de cambios para code review formal.

🙋 ACCIÓN HUMANA REQUERIDA: Aprobar instalación de @axe-core/playwright y @next/bundle-analyzer; revisar y aprobar la imagen OG.

✅ CRITERIOS DE ACEPTACIÓN:
- axe-core no reporta violations en las rutas principales.
- Lighthouse Performance ≥90.
- Lighthouse Accessibility ≥95.
- Lighthouse SEO ≥95.
- prefers-reduced-motion respetado.
- /robots.txt y /sitemap.xml accesibles.

📁 ARCHIVOS A CREAR / MODIFICAR:
- tests/e2e/a11y.spec.ts
- app/sitemap.ts
- app/robots.ts
- app/layout.tsx (metadata)
- public/og.png
- next.config.mjs (image optimization)
- (varios — fixes de a11y y perf en componentes)
````

---

## P9.C — Monitoring, analytics, legal, deploy productivo

````prompt
🎯 TAREA: 9.5 a 9.9 — Sentry + analytics + legal + deploy + smoke test

📚 CONTEXTO OBLIGATORIO A LEER:
- docs/implementation_plan.md (Fase 9)

🛠️ SKILLS / MCPs A USAR:
- security-review (al final, audit completo pre-launch)
- update-config (para cargar env vars y secrets)

📋 INSTRUCCIONES:

PARTE 1 — Error monitoring
1. PAUSAR Y PEDIR AL USUARIO crear cuenta en Sentry (free tier alcanza). Dar el DSN.
2. Instalar `@sentry/nextjs`: `npx @sentry/wizard@latest -i nextjs`. Esto crea los archivos de config automáticamente.
3. Configurar `sentry.client.config.ts` y `sentry.server.config.ts` con:
   - DSN desde env.
   - tracesSampleRate: 0.1 en producción.
   - replaysSessionSampleRate: 0.1.
   - Ignorar errores de extensions de browser conocidos.
4. Probar: tirar un error a propósito y verificar que aparece en Sentry.

PARTE 2 — Analytics (privacy-friendly)
5. PAUSAR Y PEDIR AL USUARIO decidir entre:
   - **PostHog** (más features, free tier, privacy-friendly si self-hosted).
   - **Plausible** (más simple, GDPR-friendly, ~$9/mes).
   - **Vercel Analytics** (built-in, simple, $0 con Vercel Pro).
6. Setup según elección.
7. Trackear eventos clave (NO trackear PII):
   - `signup_started`, `signup_completed`.
   - `onboarding_started`, `onboarding_completed`, `onboarding_step_dropped` (con step number).
   - `list_generated`, `list_generated_infeasible`.
   - `item_checked`, `feedback_submitted`.
8. Crear `lib/analytics.ts` como abstracción para que cambiar de provider sea fácil.

PARTE 3 — Legal
9. Crear `app/(legal)/layout.tsx` con un layout simple (GlassCard).
10. Crear:
    - `app/(legal)/privacy/page.tsx`: Política de privacidad. PAUSAR Y AVISAR al usuario que necesita generar el texto con un servicio legal o adaptar un template (Termly, GetTerms, etc.). Para v1 mínimo: qué datos guardamos, dónde (Supabase EU/US), cómo borrar la cuenta, cookies.
    - `app/(legal)/terms/page.tsx`: ToS — incluir cláusula de scraping ("usamos datos públicos de supermercados para uso personal, no garantizamos exactitud de precios").
    - `app/(legal)/cookies/page.tsx`: explicación de cookies usadas.
11. Crear `components/CookieBanner.tsx`:
    - Banner inferior en primera visita.
    - Botones: "Aceptar todo" / "Solo esenciales".
    - Persistir decisión en localStorage.
12. Linkear footer global con privacy / terms / cookies.

PARTE 4 — Deploy productivo
13. PAUSAR Y PEDIR AL USUARIO:
    - Confirmar que quiere deploy a producción.
    - Comprar dominio si quiere uno custom (ej: fitlist.ar). Configurar DNS en Vercel.
    - Tener todas las env vars productivas en Vercel: SUPABASE_*, LLM_API_KEY, FIRECRAWL_API_KEY, CRON_SECRET, SENTRY_DSN, ANALYTICS_*.
    - Crear proyecto Supabase de **producción** separado del de dev.
    - Aplicar todas las migraciones en el proyecto productivo.
14. Hacer un release a `main`. Vercel deploya. Confirmar URL accesible.

PARTE 5 — Smoke test productivo
15. Ejecutar smoke test manual:
    - Sign up con un email real.
    - Confirmar email.
    - Onboarding completo.
    - Generar lista — debe haber productos reales (correr el cron de scraping primero si la DB de prod está vacía).
    - Tachar items.
    - Logout, login.
16. security-review final con foco productivo:
    - HTTPS forzado.
    - Headers de seguridad (CSP, HSTS, X-Frame-Options) — Vercel los aplica con un `next.config.mjs` mínimo.
    - No logs con PII.
    - Rate limiting en endpoints públicos.
17. Crear `docs/launch_checklist.md` con todos los pasos completados marcados.

PARTE 6 — Lanzamiento
18. PAUSAR Y FELICITAR AL USUARIO 🎉. La v1 está en producción.

🙋 ACCIÓN HUMANA REQUERIDA: SÍ — múltiples veces:
- Cuenta Sentry + DSN.
- Decisión analytics + setup cuenta.
- Aprobar / generar textos legales.
- Comprar dominio (opcional).
- Crear Supabase de producción.
- Cargar todas las env vars productivas en Vercel.
- Confirmar release.

✅ CRITERIOS DE ACEPTACIÓN:
- Errores en producción aparecen en Sentry.
- Eventos de analytics aparecen en el dashboard.
- /privacy, /terms, /cookies accesibles desde el footer.
- Cookie banner aparece en primera visita.
- Producción responde con HTTPS + dominio configurado.
- Smoke test completo OK.
- security-review productivo limpio.
- launch_checklist.md committed con todo en ✅.

📁 ARCHIVOS A CREAR:
- sentry.client.config.ts, sentry.server.config.ts (auto-generados)
- lib/analytics.ts
- app/(legal)/layout.tsx
- app/(legal)/privacy/page.tsx
- app/(legal)/terms/page.tsx
- app/(legal)/cookies/page.tsx
- components/CookieBanner.tsx
- components/Footer.tsx
- next.config.mjs (security headers)
- docs/launch_checklist.md
````

---

## Cierre del proyecto
Si llegamos acá, **FitList v1 está vivo en producción**. Empieza la fase de iteración basada en uso real:
- Métricas a vigilar: tasa de completion del onboarding, % de usuarios que generan ≥2 listas, costo LLM por user/mes, errores de scraping por cadena.
- Próximos pasos (post-v1): app móvil, integraciones con Mercado Libre / PedidosYa / Rappi para checkout directo, recetas a partir de la lista, modo familiar (compartir lista entre usuarios).
