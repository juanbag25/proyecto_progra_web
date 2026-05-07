# FitList — Optimizer Problem Formulation (P6.A)

> Formulación matemática del "Shopping List Builder" — el problema que resuelve la app. Independiente del algoritmo elegido para resolverlo. La discusión de algoritmos (LP / greedy / híbrido) y la decisión final viven en P6.A parte 2 + en este doc al final.

**Última actualización:** 2026-05-07

---

## Contexto

El optimizer toma 3 inputs y produce 1 output:

| Input | Tabla / fuente | Vivacidad |
|-------|----------------|-----------|
| Perfil del usuario | `users_profile` | Cambia en feedback semanal (P8) |
| Targets nutricionales semanales | `nutrition_targets` (P4) | Recalculados cada semana |
| Catálogo de productos disponibles | `products` JOIN `foods` (P5) | Refrescado por cron nightly |

**Output**: una `shopping_list` con N items, cada uno apuntando a `products.id` con una cantidad en gramos, persistida en `shopping_lists` + `shopping_list_items` (P6.B).

---

## Variables de decisión

Para cada producto candidato `i ∈ Candidates`:

```
qty[i] ∈ ℝ≥0    — cantidad en gramos del producto i para la semana
```

**Por qué gramos y no "unidades de producto"**:
- Los productos vienen en presentaciones distintas (1L de leche vs 12 unidades de yogur). Trabajar en gramos normaliza el cálculo nutricional (todos los foods están per 100g).
- Permite comprar fracciones de paquete a nivel matemático. Después, en presentación al usuario, redondeamos a múltiplos de `weight_g` por SKU.
- Simplifica la función objetivo: macros aportadas = `qty[i] / 100 × food.protein_per_100g`, etc.

**Cap por SKU**: `qty[i] ≤ MAX_GRAMS_PER_SKU` (default 5000g/sem) para evitar listas tipo "20kg de pollo y nada más".

**Compras enteras** (no decisiones binarias): el problema es continuo en `qty[i]`. Las cantidades reales en el ticket se redondean al múltiplo más cercano de `weight_g` antes de mostrar al usuario.

---

## Función objetivo

Minimizar una suma ponderada que combina:

```
score(plan) = w₁ · macros_distance(plan)         // qué tan lejos quedamos de los targets
            + w₂ · micros_coverage_gap(plan)     // % de micros sin cubrir
            + w₃ · cost_ratio(plan)              // gasto vs presupuesto
            + w₄ · (1 − variety_score(plan))     // qué poco diverso es el plan
```

con pesos sugeridos `w₁=0.5, w₂=0.2, w₃=0.2, w₄=0.1`. La proteína dentro de `macros_distance` lleva peso 3× vs carbos/grasa porque es la macro crítica para los goals de fitness (hipertrofia/recomp).

### Fórmulas

- `macros_distance` = `3 · |Σqty·prot/100 − target_prot| + |Σqty·carbs/100 − target_carbs| + |Σqty·fats/100 − target_fats|`, normalizado a [0, 1] dividiendo por la suma de targets.
- `micros_coverage_gap` = `1 − (count(micros con cobertura ≥ 80%) / total_micros_evaluados)`. Por ahora siempre 0 hasta que `foods.micros_json` esté poblado a escala.
- `cost_ratio` = `Σqty·price/weight_g / weekly_budget`, capeado a 1.
- `variety_score` = `count(distinct food_id en plan) / count(distinct food_id en candidatos viables)`, en [0, 1].

Maximizar variedad y minimizar costo a la vez es una tensión real (el producto más eficiente por ARS suele ser uno solo); los pesos chicos en cost (0.2) y variety (0.1) reflejan que **lo crítico es cumplir los macros**, todo lo demás es secundario.

---

## Constraints duras

Si **alguna** se viola, el plan es **infactible** y el optimizer debe devolver `feasible: false` + un mensaje accionable explicando qué relajar.

| # | Constraint | De dónde sale |
|---|------------|---------------|
| 1 | `Σ qty[i] · price_per_g[i] ≤ weekly_budget` | `users_profile.weekly_budget_ars` |
| 2 | `food_id` debe ser NOT NULL (sin nutrición no podemos optimizar) | INNER JOIN en `loadCandidates` |
| 3 | Excluir `i` si `food.name_es` o `food.search_terms` matchean cualquier `profile.allergies[]` | `users_profile.allergies` |
| 4 | Excluir `i` si `food.name_es` matchea cualquier `profile.disliked_foods[]` (case-insensitive, sin diacríticos) | `users_profile.disliked_foods` |
| 5 | Si `dietary_restrictions` incluye `'Vegano'` → keep solo `food.is_vegan = true` | flag `foods.is_vegan` |
| 6 | Si `dietary_restrictions` incluye `'Vegetariano'` → keep solo `food.is_vegetarian = true` | flag `foods.is_vegetarian` |
| 7 | Si `dietary_restrictions` incluye `'Sin TACC'` → keep solo `food.is_gluten_free = true` | flag `foods.is_gluten_free` |
| 8 | Si `allergies` incluye `'Lactosa'` → keep solo `food.is_lactose_free = true` | flag `foods.is_lactose_free` |
| 9 | Si `allergies` incluye `'Gluten'` → keep solo `food.is_gluten_free = true` | flag `foods.is_gluten_free` (cruza con #7) |
| 10 | `qty[i] ≤ MAX_GRAMS_PER_SKU` | constante del optimizer |

**Otras dietas no soportadas todavía** (Pescetariano, Kosher, Halal, Keto): no hay flag canónico en `foods`. Se ignoran silenciosamente en v1 — TODO documentado para que el flag llegue cuando enriquezcamos `foods`.

---

## Constraints blandas (penalizaciones)

Estas se reflejan en `score()` y tiran al optimizer hacia mejores planes sin invalidarlos:

- **Lejanía a target de proteína**: peso 3× en `macros_distance`. Faltarle 50g de proteína cuesta 3× más que faltarle 50g de carbos.
- **Lejanía a target de grasas y carbos**: peso 1×.
- **Falta de variedad**: si todos los gramos de proteína vienen de un solo `food_id`, penalización en `(1 − variety_score)`.
- **Productos no preferidos**: penalización leve si `food.name_es` no aparece (case-insensitive, sin diacríticos) en `profile.preferred_foods[]`. Equivalente a un descuento de score, no exclusión.
- **Productos ultraprocesados** (heurística): si el `product.name` (no el `food.name_es`) matchea palabras como `"snack"`, `"barrita"`, `"instantáneo"`, restamos score. Imperfecto pero filtra los obvios.

---

## Manejo de infeasibilidad

El plan es infactible si después de aplicar las constraints duras (#1–10) no podemos cubrir el target de proteína dentro del presupuesto. Detectamos esto calculando, ANTES de armar la lista:

```
min_protein_cost = target_protein_g × cost_per_g_protein(producto_más_eficiente_filtrado)
```

Si `min_protein_cost > weekly_budget`, devolvemos:

```ts
{
  feasible: false,
  feasibility_message: `Necesitás ~$${min_protein_cost} para llegar a tu target de proteína (${target_protein_g}g). Estás en $${budget}. Opciones: subir presupuesto a $${min_protein_cost}, bajar el target de proteína (cambiar goal a 'maintenance'), o relajar la restricción <restriction>.`,
  items: [],  // o lista parcial best-effort
  summary: { ... }
}
```

La lista parcial se devuelve igual para mostrar contexto: "esto es lo más cerca que llegamos con tu presupuesto actual".

---

## Algoritmo elegido

**Pendiente decisión humana** (P6.A parte 2). Las 3 opciones evaluadas:

### A — LP solver (`javascript-lp-solver`)
- ✅ Solución óptima demostrable
- ✅ Rápido para N candidates pequeño (<500)
- ❌ Constraints no-lineales (variedad, ultraprocessed) son difíciles de expresar
- ❌ Resultado fraccional (compras 0.3 paquetes); reconstruir enteros es no trivial
- ❌ Agregar dependencia nueva (no aprobada todavía)

### B — Greedy + scoring (RECOMENDADO)
- ✅ Cero dependencias nuevas (vanilla TS)
- ✅ Predecible y debuggeable (cada decisión es trazeable)
- ✅ Soporta cualquier scoring no-lineal trivialmente
- ✅ Naturalmente entero (cantidades incrementales)
- ❌ Sub-óptimo (puede dejar plata sin gastar si las primeras decisiones son malas)

### C — Híbrido (greedy + búsqueda local)
- Mismo greedy de B + 100 iteraciones de "swap moves" (sacar item X, agregar item Y, ¿mejoró el score?).
- ✅ Más cerca del óptimo que B
- ❌ +tiempo (estimado +1s por 100 iters)
- ❌ Sin solver no hay garantía de optimalidad — solo "mejor que greedy"

**Recomendación inicial: B**. Si los outputs son flojos en casos reales (P6.B testing con perfiles ground-truth), pasamos a C. LP queda en backlog si un día queremos optimalidad demostrable.

---

## Performance budget

- **Latencia objetivo**: <2s para 1000 candidates (típico de un region AR con 3 cadenas scrapeadas y filtros aplicados).
- **Memoria**: el set de candidates entero cabe en memoria (1000 × ~500 bytes = 500KB). Sin streaming, sin paginación.
- **Cold start**: el optimizer es server-only y se carga lazy en el route handler de `/api/shopping-list/generate` (P6.B). Sin overhead visible.

---

## Outputs (forma final)

`buildShoppingList()` devuelve:

```ts
{
  items: Array<{
    product_id: string;
    qty_g: number;             // cantidad calculada
    cost: number;              // ARS aportado
  }>;
  summary: {
    total_cost: number;
    total_calories: number;
    total_protein_g: number;
    total_carbs_g: number;
    total_fats_g: number;
    total_fiber_g: number;
    micros_coverage_pct: Record<string, number>;  // vacío en v1
    budget_usage_pct: number;
    targets_match_pct: { protein: number; carbs: number; fats: number };
  };
  feasible: boolean;
  feasibility_message: string | null;
}
```

Esa shape es lo que P6.B persiste en `shopping_lists.summary_json` + filas en `shopping_list_items`.
