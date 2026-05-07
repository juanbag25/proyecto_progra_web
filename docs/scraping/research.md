# FitList — Scraping Research (Phase 5.A)

> **Investigación técnica por cadena**, hecha mediante WebFetch + análisis de robots.txt + sondeos del API VTEX. Compliance/ToS está en [`compliance.md`](./compliance.md). Las recomendaciones acá son **técnicas** (¿cómo obtenemos los datos?), no legales (¿podemos?).

**Última actualización:** 2026-05-06

---

## TL;DR — Qué encontramos

| # | Cadena | Plataforma | API JSON pública | Anti-bot | Estrategia recomendada |
|---|--------|------------|------------------|----------|------------------------|
| 1 | **Carrefour AR** | VTEX | ✅ Sí | No (en API) | Fetch directo del API VTEX (sin JS, sin Firecrawl) |
| 2 | **Dia AR** | VTEX | ✅ Sí | No (en API) | Fetch directo del API VTEX (sin JS, sin Firecrawl) |
| 3 | **Jumbo AR** | VTEX (confirmado) | ✅ Asumido | Sí (User-Agent filtering) | Firecrawl o Playwright para llamar al API VTEX |
| 4 | **Coto Digital** | Oracle ATG (legacy) | ❌ No | Sí (403 a fetches simples) | Firecrawl/Playwright + parseo HTML |

**El hallazgo crítico de toda la investigación:**

> 🚨 **Ninguna de las cadenas publica nutrición per producto en su catálogo online.** El VTEX API devuelve nombre, marca, precio, EAN, peso/unidad, imágenes y specs de marketing — pero macros (calorías, proteína, carbos, grasas) y micros (vitaminas, minerales) no están en el feed.

Esto cambia la arquitectura de la Fase 5 vs el spec original. Ver sección [§ Brecha de datos nutricionales](#brecha-de-datos-nutricionales) y la propuesta de mitigación.

---

## 1. Carrefour AR — `www.carrefour.com.ar`

### Plataforma
**VTEX**. Confirmado vía robots.txt (paths característicos: `/buscapagina/*`, `/quick-view/*`, `/espiar/*`) y vía respuesta del endpoint VTEX público.

### API público
✅ **Sí, accesible sin auth.**

```bash
curl "https://www.carrefour.com.ar/api/catalog_system/pub/products/search/leche?_from=0&_to=2"
```

Devuelve un JSON array con productos. Campos por producto:

```
productId, productName, brand, brandId, link, linkText, productReference,
categoryId, categories[], allSpecifications[], allSpecificationsGroups[],
description, items[]
```

Y por variante (`items[i]`):

```
itemId, name, nameComplete, ean, referenceId, measurementUnit (un|kg|gr),
unitMultiplier, modalType, isKit, images[], sellers[], Videos[]
```

### Datos útiles para FitList
- ✅ `productName`, `brand`, `categories[]` (jerarquía: `/Frescos/Lácteos/Leche/`)
- ✅ `items[0].ean` (EAN-13 del producto, **clave para cross-referenciar nutrición**)
- ✅ `items[0].measurementUnit` + `unitMultiplier` (ej: `kg` × `1.0`, `un` × `0.5`)
- ✅ `items[0].sellers[0].commertialOffer.Price` (precio actual) y `ListPrice` (precio sin oferta)
- ✅ `items[0].images[]` (URLs PNG transparentes — perfecto para el shopping list UI)
- ⚠️ `allSpecifications[]` — son keys de marketing/legales (`PrecioPorUnd`, `IVA`, `UnidaddeMedida`). En el sample de productos de yogur **ningún producto** publicó campos nutricionales (no había `Energía`, `Proteína`, `Calorías`, etc.).

### robots.txt (verbatim)

```
User-agent: *
Disallow: /img/*
Disallow: /account/*
Disallow: /login/*
Disallow: /checkout/*
Disallow: /busca/*
Disallow: /quick-view/*
Disallow: /espiar/*
Disallow: /buscapagina/*
Disallow: /*?_q
Disallow: /folletos-new/
Sitemap: https://www.carrefour.com.ar/sitemap.xml
```

**Lectura:** los paths bajo `/api/catalog_system/pub/*` **no están en disallow** — el endpoint público está habilitado a propósito por VTEX. Los paths bloqueados son rutas internas de la SPA del storefront, no del API.

### Riesgos técnicos
- Rate limiting no documentado pero existente (VTEX corta desde >5 req/s sostenidos por IP).
- `_to` máximo es 50 por request — paginar agresivamente.
- Algunos productos retornan EAN vacío o EAN-13 inválido — ignorar en el matcher.

### Veredicto
**Estrategia recomendada: fetch directo HTTP + JSON parse.** No hace falta Firecrawl ni Playwright para esta cadena.

---

## 2. Dia AR — `diaonline.supermercadosdia.com.ar`

### Plataforma
**VTEX**. Mismo patrón de robots.txt (`/buscapagina/`, `/quick-view/`, `/espiar/`) y mismo endpoint público funcionando.

### API público
✅ Mismo patrón que Carrefour:

```bash
curl "https://diaonline.supermercadosdia.com.ar/api/catalog_system/pub/products/search/leche?_from=0&_to=2"
```

Estructura idéntica a Carrefour (es VTEX standard).

### Datos útiles
Igual a Carrefour. `allSpecifications` está aún más vacío que Carrefour: en el sample fue `["PrecioPorUnd", "UnidaddeMedida", "IVA"]` — sin campos nutricionales.

### robots.txt (verbatim)

```
User-agent: *
Disallow: /img/*
Disallow: /account/*
Disallow: /login/*
Disallow: /checkout/*
Disallow: /busca/*
Disallow: /quick-view/*
Disallow: /espiar/*
Noindex: /buscapagina/*
Disallow: /busca/?ft=*
Disallow: /buscapagina
Disallow: /checkout/
Disallow: /cart/
Disallow: /account/
Disallow: /sistema/
Disallow: /buscavazia?ft=
Disallow: /checkout/cart/
Sitemap: https://diaonline.supermercadosdia.com.ar/sitemap.xml
```

### Veredicto
**Igual a Carrefour: fetch directo, sin Firecrawl.**

---

## 3. Jumbo AR — `www.jumbo.com.ar`

### Plataforma
**VTEX confirmado.** Cencosud (dueño de Jumbo, Disco, Vea) corre todas sus marcas AR en VTEX. Verificado vía búsqueda pública (storeleads.app, vtex.com case studies).

### API público
✅ **Asumido funcional** (mismo patrón que Carrefour/Dia, son VTEX standard), pero **no pudimos verificarlo desde nuestra investigación** — todos los fetches de WebFetch contra `jumbo.com.ar` cerraron el socket. Probable filtro de User-Agent / Cloudflare a clientes no-browser.

> 🔬 **Verificar en P5.B**: cuando Firecrawl esté instalado, primer test es hacer un GET al endpoint `/api/catalog_system/pub/products/search/leche?_from=0&_to=1` y confirmar respuesta JSON. Si retorna 403/empty → fallback a parseo del HTML del storefront.

### robots.txt
**No accesible** desde nuestro entorno (socket cerrado). Verificar con Firecrawl en P5.B.

### Veredicto
**Estrategia recomendada: Firecrawl** (managed, simula browser real con UA legítimo), apuntando al API VTEX. Si el API contesta JSON, parseamos directo; si bloquean el API también, parseamos el HTML del storefront (también con Firecrawl).

---

## 4. Coto Digital — `www.cotodigital.com.ar`

### Plataforma
**Oracle ATG / Oracle Commerce Cloud** (legacy enterprise). Confirmado por las directivas de su robots.txt — los parámetros `_DARGS` y `_dyncharset` son firmas inconfundibles de Oracle ATG.

> Aclaración: `coto.com.ar` (sin "digital") es la web institucional, no la tienda online. La tienda real vive en `cotodigital.com.ar`.

### API público
❌ **No hay API JSON público documentado.** Oracle ATG no expone catálogo via REST por default.

Lo que sí parece existir es el HTML del storefront (server-rendered ATG), pero los fetches simples a categorías retornaron contenido mínimo y la ToS retornó `403 Forbidden` — Coto **bloquea User-Agents no-browser**.

### robots.txt (verbatim)

```
User-agent: *
Disallow: /*_DARGS
Disallow: /global/
Disallow: /myaccount/
Disallow: //content/images/*
Disallow: /content/images/*
Disallow: /*_dyncharset
Sitemap: https://www.cotodigital.com.ar/sitios/cdigi/sitemap.xml
```

**Lectura:** rutas de categoría/producto NO están bloqueadas. El sitemap apunta a la lista pública de productos. Eso valida (técnicamente) que el catálogo está pensado para ser indexado por motores de búsqueda — pero el bloqueo de UAs sugiere que sólo aceptan crawlers identificados (Googlebot, Bingbot, etc.) o usuarios reales.

### Riesgos técnicos
- Sin API → todo es parseo HTML, frágil ante rediseños.
- 403 a UAs no-browser → necesita User-Agent legítimo.
- Las URLs ATG son verbosas (`?_DARGS=...`, `?_dyncharset=...`) — paginar sin caer en infinite-scroll trampas.

### Veredicto
**Estrategia recomendada: Firecrawl** (con UA realista) sobre las páginas de búsqueda + parseo de los productos en el HTML rendered. **Última prioridad si el tiempo aprieta** — es la cadena más cara de implementar y la única que NO comparte arquitectura con las otras 3.

---

## Brecha de datos nutricionales

### El problema

El spec original de Phase 5 asume que el scraper extrae:

> `name, brand, chain, region, price, unit, weight_g, calories_per_100g, protein_per_100g, carbs_per_100g, fats_per_100g, fiber_per_100g, micros_json, last_seen_at, source_url`

La realidad: **las cadenas argentinas no publican `*_per_100g` en sus catálogos online**. Los `allSpecifications` del API VTEX traen campos de marketing y legales (precio por unidad, IVA), no la tabla nutricional. Coto idem.

Esto está **previsto** en `docs/implementation_plan.md` como riesgo:
> _"Cobertura nutricional de scraping: los supers no siempre publican micros; puede requerir DB enriquecida con tabla USDA o equivalente local."_

### Mitigación recomendada — arquitectura en dos capas

**Capa 1 — Scraping (P5.B)**: extrae sólo lo que hay en los catálogos:
```
sku, ean, chain, region, name, brand, weight_g, unit, price, image_url, last_seen_at, source_url
```

**Capa 2 — Nutrición (NUEVA, propuesta P5.D)**: tabla canónica de alimentos con valores nutricionales por 100g. Cada `product` (scraped) referencia un `food` (canónico) por fuzzy match.

```
foods (canonical):
  id, slug, name_es, category, kcal_per_100g, protein_per_100g, carbs_per_100g,
  fats_per_100g, fiber_per_100g, micros_json (vitamin_d, b12, hierro, calcio, ...)
```

#### Fuentes de datos nutricionales (en orden de preferencia)

| # | Fuente | Cobertura AR | Costo | Calidad | Mecánica |
|---|--------|--------------|-------|---------|----------|
| 1 | **Open Food Facts** | Parcial (probamos 2 EANs AR, ambos missing) | Gratis | Alta cuando existe | API por EAN: `world.openfoodfacts.org/api/v0/product/{ean}.json` |
| 2 | **USDA FoodData Central** | Genérico (no AR-specific) | Gratis | Alta | API + key gratis. Útil para alimentos genéricos (`pollo pechuga`, `arroz blanco`) |
| 3 | **LLM lookup (Gemini)** | Universal | $0 (free tier) | Estimada, variable | Para EANs no en OFF/USDA, pasar `productName + brand + weight` a Gemini con un prompt de "devolveme nutrición per 100g como JSON" |
| 4 | **Manual seed** | Curado | 0 (tiempo manual) | Máxima | Top 100 staples (yogur, leche, pollo, arroz, avena, banana, etc.) con nutrición curada del paquete |

**Recomendación para v1**: hibrido. Manual seed de los **top ~100 staples** (cubre el 80% del volumen de una compra semanal típica) + LLM lookup como fallback para todo lo demás. Open Food Facts en el futuro cuando crezca la cobertura AR.

---

## Plan de implementación derivado (P5.B / P5.C / nuevo P5.D)

Sub-fases sugeridas para P5 a partir de esta investigación:

- **P5.B — Scrapers VTEX (Carrefour + Dia + Jumbo)**: scraper module compartido (los 3 son VTEX, una sola implementación), Firecrawl sólo para Jumbo. Tabla `products` simplificada (sin nutrición). Prompt original P5.B se mantiene en general, ajustando la columna nutricional como nullable.
- **P5.C — Scraper Coto** (Oracle ATG, HTML parsing via Firecrawl).
- **P5.D — Capa nutricional canónica** (NUEVO — no estaba en el spec original): seed manual + LLM lookup + tabla `foods`.

P5.D bloquea al optimizer (Phase 6), no al scraping. Se puede ir en paralelo con P5.B una vez decididas las fuentes.

---

## Datos a confirmar en P5.B

- [ ] Verificar que el endpoint VTEX de Jumbo responde JSON cuando se llama con UA realista (vía Firecrawl).
- [ ] Verificar rate limit real de cada cadena (cuántas req/s antes de 429).
- [ ] Sondeo de cobertura Open Food Facts: tomar 100 EANs random scrapeados de Carrefour y medir qué % está en OFF.
- [ ] Para Coto: identificar el patrón de URL de búsqueda y de producto, validar que Firecrawl lo parsea bien.
