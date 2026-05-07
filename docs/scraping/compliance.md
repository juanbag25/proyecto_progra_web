# FitList — Scraping Compliance Plan (Phase 5.A)

> **Disclaimer**: este documento NO es asesoramiento legal. Es un mapeo honesto de los riesgos detectados y un plan de mitigación pragmático para un proyecto académico (ITBA — Programación Web). Para uso comercial, validar con un abogado especializado en propiedad intelectual y datos digitales en Argentina.

**Última actualización:** 2026-05-06

---

## Decisiones tomadas (2026-05-06, cierre de P5.A)

1. **Coto: descartado en v1.** Lanzamos sólo con Carrefour + Dia + Jumbo (los 3 VTEX → un solo módulo de scraping compartido). Coto entra eventualmente en una v1.5 si el optimizer + UI ya están vivos.
2. **Nutrición: manual seed + LLM fallback.** Tabla `foods` curada con ~100 staples (yogur, leche, pollo, arroz, etc.) + Gemini como fallback para productos no matcheados. Open Food Facts queda fuera para v1 (cobertura AR insuficiente).
3. **ToS no verificadas manualmente** — proyecto académico, proof of concept. Si el alcance crece a producción, hay que volver a este punto.
4. **Firecrawl: stand-by, no instalado como MCP.** La API key está cargada en `.env.local` como fallback. Primary path es Node `fetch()` con User-Agent realista. Si Jumbo bloquea, swap point-by-point a Firecrawl.

---

## TL;DR

| Cadena | robots.txt | ToS verificado | Riesgo legal | Riesgo técnico | Veredicto |
|--------|-----------|----------------|--------------|----------------|-----------|
| Carrefour AR | ✅ Permisivo en `/api/` | ⚠️ No accesible (404) — verificar manualmente | Bajo (API pública diseñada para terceros) | Bajo | OK proceder con rate limiting |
| Dia AR | ✅ Permisivo en `/api/` | ⚠️ No verificada | Bajo (igual que Carrefour) | Bajo | OK proceder con rate limiting |
| Jumbo AR | ⚠️ No accesible | ⚠️ No verificada | Bajo (igual patrón VTEX) | Medio (anti-bot) | OK con UA legítimo (Firecrawl) |
| Coto Digital | ⚠️ Permisivo a productos pero bloquea UAs no-browser | ⚠️ No accesible (403) | **Medio** | Alto | Pausar y discutir con usuario |

**Hallazgo importante**: ninguna de las ToS pudo ser leída automáticamente desde nuestra investigación (errores 404, 403, sockets cerrados). Esto NO significa que no existan — sólo que requieren verificación humana en un browser real antes de cualquier scraping productivo.

---

## Marco legal aplicable (Argentina)

Para un proyecto en Argentina, los marcos relevantes son:

- **Ley 11.723 (Propiedad Intelectual)** — protege bases de datos compiladas con esfuerzo sustancial. Reproducir sistemáticamente toda una base de datos comercial puede ser considerado infracción incluso si los datos individuales son fácticos.
- **Código Civil y Comercial — Daños y perjuicios (art. 1716 y siguientes)** — si el scraping causa daño económico (degrada el servicio, sobrecarga servidores), responsabilidad civil.
- **Ley 25.326 (Datos personales)** — no aplica a este caso (precios y catálogo son datos de productos, no personales), pero relevante mencionarla.
- **Ley 26.388 (Delitos informáticos)** — penaliza el "acceso ilegítimo" a sistemas. Acceder a un endpoint que el dueño hizo público a propósito (como el `/api/catalog_system/pub/` de VTEX) NO es acceso ilegítimo. Forzar el bypass de un anti-bot SÍ podría serlo.

**Test práctico**: si el dueño del sitio diseñó el endpoint para ser público (sin auth, sin captcha, sin headers exóticos), scrapearlo con respeto razonable a la infraestructura es defendible. Si tenés que romper protecciones técnicas para acceder, no.

---

## Cláusulas de ToS — qué encontramos

### Carrefour AR
- ToS en `https://www.carrefour.com.ar/terminos-y-condiciones-de-uso` → **404** al momento de la investigación.
- **Pendiente humano**: pegarla en un browser real, leer las cláusulas relacionadas a:
  - "uso automatizado" / "robots" / "crawlers" / "scraping"
  - "minería de datos" / "data mining"
  - "uso comercial de la información"
  - "reproducción del contenido"
- **Default optimista** (para proyecto académico): el endpoint `/api/catalog_system/pub/products/search/` está habilitado a propósito por VTEX para terceros (apps de descuentos, comparadores). Mientras respetemos rate limit y no demos uso comercial al output, riesgo bajo.

### Dia AR
- Mismo análisis que Carrefour. ToS no verificada. Asumimos default optimista.

### Jumbo AR
- ToS en `https://www.jumbo.com.ar/legales` → **socket cerrado** al fetch automatizado (mismo anti-bot que el resto del sitio).
- **Pendiente humano**: leer en browser.

### Coto Digital
- ToS en `https://www.cotodigital.com.ar/sitios/cdigi/terminos-y-condiciones` → **403** al fetch.
- **Riesgo más alto** de las 4: el bloqueo activo a User-Agents no-browser es señal de que **no quieren** scraping. Aunque robots.txt no bloquee las páginas de producto, la actitud técnica del sitio es defensiva.

---

## Plan de mitigación

### 1. Rate limiting (todas las cadenas)
- **1 request por 2 segundos por cadena** como floor (0.5 RPS).
- Cap diario: ~10.000 requests / cadena / día. Cubre catálogo de >5.000 productos con paginación holgada.
- Backoff exponencial ante 429/503: 5s, 15s, 60s, 300s. A la cuarta, abortar el job y alertar.
- Concurrency = 1 por cadena (sin múltiples conexiones paralelas). 4 cadenas = max 4 RPS total.

### 2. User-Agent identificable
Todos los scrapers se identifican explícitamente:
```
User-Agent: FitList/0.1 (academic project — ITBA Programación Web; contact: jgramaglia@metanoia.net.ar)
```
Esto es buena práctica:
- Le da al admin del super una vía de contacto para pedir que paremos.
- Evidencia que el uso es educativo, no malicioso (relevante si llega un cease-and-desist).
- Distingue nuestro tráfico del de bots maliciosos genéricos en sus logs.

### 3. Respeto de robots.txt
- Antes de scrapear cada cadena, parsear `/robots.txt` y verificar que las URLs no estén bloqueadas. Implementar como check al inicio del scrape job.
- Carrefour y Dia: `/api/catalog_system/pub/` está habilitado, ✅.
- Coto: `/sitios/cdigi/categoria/` y `/sitios/cdigi/producto/` no están en disallow, ✅, **pero** combinarlo con el bloqueo activo de UAs es ambiguo. Ver decisión específica abajo.

### 4. Cache agresivo
- Tabla `products` con `last_seen_at` — no re-scrapeamos un producto si fue visto en las últimas 24h (excepto en el cron de refresh nightly).
- LRU en memoria del scraper para deduplicar EANs durante un mismo job.

### 5. Headers honestos
- Sin spoofing de cookies de sesión, sin imitar tokens del browser, sin bypass de Cloudflare.
- Si Cloudflare nos cazas con un challenge, paramos y no insistimos.
- Firecrawl gestiona los headers de forma identificable (no es bypass).

### 6. Fallback a entrada manual (futuro)
Documentar como roadmap (post-v1):
- Si una cadena pide formalmente que paremos, ofrecer al usuario en la UI un toggle "ingresar manualmente productos" o "subir foto del ticket de compra" + OCR.
- Mantener el algoritmo de optimización + tabla canónica de `foods` aún si el scraper se cae — son features valiosas independientes.

### 7. No publicar la DB de productos
- Los datos scrapeados se usan **internamente** en el optimizer. NO se exponen via API pública del proyecto.
- Si el usuario quiere ver el detalle de un producto, lo redirigimos al `source_url` original del super (donde el super puede mostrar su precio + tracking + monetizar el click).
- Esto reduce sustancialmente el daño económico potencial: el super sigue capturando el tráfico de compra real.

---

## Decisiones que necesito del usuario

### Decisión 1 — Coto: incluir en v1 o diferir
Riesgos vs beneficio:
- **Pros**: Coto tiene cobertura nacional + es el más popular en algunas provincias.
- **Contras**:
  - Único Oracle ATG → 30-40% más esfuerzo de implementación (cero reuso con Carrefour/Dia/Jumbo).
  - Bloquea UAs no-browser → señal técnica de "no scrapees".
  - 403 a la ToS → no podemos verificar las cláusulas remotamente.

**Opciones**:
- **A. Diferir Coto a post-v1**. Lanzamos con Carrefour + Dia + Jumbo. Las 3 son VTEX → una sola implementación, riesgo legal bajo. Coto entra en una v1.5 una vez validado el producto.
- **B. Incluir Coto pero gated**. Implementamos Coto pero le ponemos un toggle en `.env` (`SCRAPE_COTO=false`) que **por default está apagado** en producción hasta que el usuario lea la ToS y dé OK explícito.
- **C. Incluir Coto sin gates**. Mayor riesgo legal, más esfuerzo técnico, sin upside técnico claro vs A.

**Mi recomendación**: **A** para el proyecto académico. Si el profesor pide explícitamente las 4 cadenas, B.

### Decisión 2 — Capa de nutrición canónica
Como descubrimos en `research.md`, **ninguna cadena publica nutrición**. La capa de scraping te da nombre + marca + EAN + precio + peso. La nutrición tiene que venir de otro lado.

**Opciones**:
- **A. Manual seed (~100 staples)** + LLM fallback para el resto. Recomendado, más control.
- **B. Sólo LLM lookup** por producto. Más automático pero accuracy variable.
- **C. Integración Open Food Facts** + fallback LLM. OFF tiene cobertura parcial AR (probamos 2 EANs random y ambos miss), pero crece con el tiempo.

**Mi recomendación**: **A + LLM** como fallback. Curado garantiza calidad para los staples del 80% de volumen.

### Decisión 3 — ¿Verificar las ToS manualmente antes de seguir?
Para que sea defendible si llega un mail de un super:
- Vos abrís en un browser las ToS de las 4 cadenas (links abajo).
- Buscás cláusulas con "scraping", "automatizado", "robots", "crawlers", "minería", "reproducción".
- Si encontrás alguna restrictiva, la pegás acá y la sumamos al doc + ajustamos el plan.
- Si las ToS no las prohíben explícitamente, asumimos default optimista para el scope académico.

URLs a revisar:
- Carrefour: <https://www.carrefour.com.ar/terminos-y-condiciones-de-uso>
- Dia: <https://diaonline.supermercadosdia.com.ar> → footer "Términos y Condiciones"
- Jumbo: <https://www.jumbo.com.ar/legales>
- Coto: <https://www.cotodigital.com.ar/sitios/cdigi/terminos-y-condiciones>

---

## Resumen de mitigaciones (para incluir en código P5.B)

```ts
// scrapers/lib/policy.ts — bake estas constantes en el scraper module
export const SCRAPE_POLICY = {
  rateLimitMs: 2000,                  // 1 req / 2s por cadena
  maxConcurrency: 1,                  // serial por cadena
  userAgent: 'FitList/0.1 (academic project — ITBA Programación Web; contact: jgramaglia@metanoia.net.ar)',
  retryBackoffsMs: [5_000, 15_000, 60_000, 300_000],
  maxDailyRequests: 10_000,
  cacheTtlMs: 24 * 60 * 60 * 1000,    // 24h
  respectRobotsTxt: true,
  abortOnConsecutiveBlocks: 4,        // tras 4 bloqueos seguidos, parar
};
```

Toda excepción a esta política (ej: cron mensual de full-refresh con concurrencia más alta) requiere flag explícito + comentario justificándolo.
