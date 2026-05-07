# Fase 6 — Optimization Algorithm

> **Cambio mayor vs spec original**: en Fase 5 se decidió separar precios/SKUs (`products`) de nutrición (`foods`). Cualquier rutina del optimizer que necesite calorías/macros/dietary tags **debe JOIN** `products` con `foods` por `products.food_id`. Productos con `food_id IS NULL` no se pueden optimizar (no sabemos qué aportan nutricionalmente) — se filtran fuera al inicio.
>
> Las flags dietarias (`is_vegan`, `is_vegetarian`, `is_gluten_free`, `is_lactose_free`) viven en `foods`. Filtrá por esas, no por categoría heurística.

2 prompts. El "Shopping List Builder" — núcleo intelectual de la app.

---

## P6.A — Diseño del problema + filtrado + algoritmo core

````prompt
🎯 TAREA: 6.1, 6.2, 6.3, 6.4, 6.5 — Formulación del problema, filtrado, optimizer core

📚 CONTEXTO OBLIGATORIO A LEER:
- docs/project_definition/02_core_functionality.md (sección 4: Optimization Algorithm)
- docs/project_definition/03_user_workflow.md (Phase 3 del workflow)
- docs/implementation_plan.md (Fase 6)

🛠️ SKILLS / MCPs A USAR:
- (ninguna externa, lógica propia)

📋 INSTRUCCIONES:

PARTE 1 — Formulación
1. Crear `docs/optimizer/formulation.md` con:
   - **Variables de decisión:** `qty[i]` = cantidad (en gramos) del producto `i`. Cada `i` referencia un row de `products` JOIN `foods` por `food_id`.
   - **Objetivo:** minimizar distancia ponderada a targets nutricionales semanales + maximizar variedad + minimizar costo.
     - Función score: `0.5 * sum_macros_distance + 0.2 * micros_coverage_gap + 0.2 * cost_ratio + 0.1 * (1 - variety_score)`.
   - **Constraints duras:**
     - `sum(qty[i] * price_per_g[i]) ≤ weekly_budget`.
     - Excluir productos cuya `foods.search_terms` o `foods.name_es` matchea algún allergeno del user.
     - Excluir productos cuyo `foods.name_es` matchea `disliked_foods`.
     - Excluir productos según restricciones dietarias del user, leyendo flags de `foods`:
       - User vegano → `foods.is_vegan = true`.
       - User vegetariano → `foods.is_vegetarian = true`.
       - User celíaco / "Sin TACC" → `foods.is_gluten_free = true`.
       - User intolerante a lactosa → `foods.is_lactose_free = true`.
     - Excluir productos con `food_id IS NULL` (no podemos aportar nutrición sin match).
   - **Constraints blandas (penalización):**
     - Lejanía a target de proteína (peso 3x).
     - Lejanía a target de grasa y carbos (peso 1x).
     - Falta de variedad (todos los kg de proteína viniendo de un solo `foods.id`: penalizar).
     - Productos cuyo `foods.name_es` no aparece en `preferred_foods` (penalización leve).

PARTE 2 — Decisión de algoritmo
2. PAUSAR Y PRESENTAR AL USUARIO 3 opciones, con trade-offs:
   - **(A) LP solver** (`javascript-lp-solver`): exacto y rápido para problemas chicos. Limitación: no maneja bien constraints no-lineales (variedad), y la "elección de producto" es entera (no podés comprar 0.3 paquetes de arroz).
   - **(B) Heurística greedy + scoring**: ordena productos por score (proteína por peso, fiber por peso, etc.) y va llenando la lista respetando budget. Rápido, predecible, fácil de debuggear. Sub-óptimo pero "good enough".
   - **(C) Híbrido**: heurística greedy para arrancar + búsqueda local (swap moves) para mejorar 100 iteraciones.
   - **Recomendación:** empezar con (B), si los outputs son flojos pasar a (C). LP queda en el roadmap si un día queremos optimalidad demostrable.
3. Esperar decisión del usuario. Continuar con la opción elegida.

PARTE 3 — Tipo de candidato + filtrado
4. Crear `lib/optimizer/types.ts` con el tipo `Candidate`:
   ```ts
   // Resultado del JOIN de products + foods. Ya tiene todo lo que el
   // optimizer necesita en una sola estructura.
   export interface Candidate {
     product_id: string;
     food_id: string;
     name: string;          // products.name (la cara del SKU)
     food_name: string;     // foods.name_es (canónico)
     brand: string | null;
     chain: 'carrefour' | 'jumbo' | 'dia';
     price_ars: number;
     weight_g: number | null;
     // Per 100g, viene de foods:
     kcal_per_100g: number;
     protein_per_100g: number;
     carbs_per_100g: number;
     fats_per_100g: number;
     fiber_per_100g: number;
     // Flags dietarios:
     is_vegan: boolean;
     is_vegetarian: boolean;
     is_gluten_free: boolean;
     is_lactose_free: boolean;
     category: string;       // foods.category
     image_url: string | null;
     source_url: string | null;
   }
   ```
5. Crear `lib/optimizer/loadCandidates.ts` con `loadCandidates(supabase, region) → Candidate[]`:
   - Query: `SELECT ... FROM products INNER JOIN foods ON products.food_id = foods.id WHERE products.region = $1 AND products.weight_g IS NOT NULL`.
   - El INNER JOIN excluye automáticamente productos sin match.

6. Crear `lib/optimizer/filter.ts` con `filterCandidates(candidates, profile) → Candidate[]`:
   - Excluir si `food_name` (lowercased + sin diacríticos) contiene una alergia del user.
   - Excluir si `food_name` está en `profile.disliked_foods` (case-insensitive).
   - Si `profile.dietary_restrictions` incluye:
     - `'Vegano'` → keep solo `is_vegan = true`.
     - `'Vegetariano'` → keep solo `is_vegetarian = true`.
     - `'Sin TACC' | 'Celíaco'` → keep solo `is_gluten_free = true`.
     - `'Sin lactosa'` → keep solo `is_lactose_free = true`.
   - Devolver el array filtrado.

PARTE 4 — Scoring
7. Crear `lib/optimizer/score.ts` con función `scoreCandidate(candidate, targets, profile) → number`:
   - Score inicial = 0.
   - **+W1** por densidad proteica por ARS:
     `(candidate.protein_per_100g / 100) × candidate.weight_g / candidate.price_ars`.
   - **+W2** por fibra: `candidate.fiber_per_100g`.
   - **+W3** boost si `candidate.food_name` aparece (case-insensitive) en `profile.preferred_foods`.
   - **−W4** penalización si el nombre del producto matchea heurísticas de ultra-procesado (ej: incluye "snack", "barrita", "instantáneo", marcas específicas).
   - Devolver score normalizado 0–100.

PARTE 5 — Optimizer core
8. Crear `lib/optimizer/build.ts` con `buildShoppingList(profile, targets, candidates) → ShoppingList`:
   - Algoritmo greedy (asumiendo opción B):
     ```
     remainingBudget = profile.weekly_budget
     remainingProtein = targets.weekly_protein_g
     remainingCarbs = targets.weekly_carbs_g
     remainingFats = targets.weekly_fats_g
     list = []
     used_food_ids = new Set()

     while remainingBudget > 0 AND remainingProtein > 0:
       // Re-score por necesidad remanente: si falta proteína, boost candidates con alta protein_per_100g
       candidate = pickBestForRemainingNeed(candidates, remaining*, used_food_ids, profile.preferred_foods)
       if candidate is null: break
       qty_g = computeOptimalQty(candidate, remaining*)        // tope por SKU + por necesidad
       cost = (qty_g / candidate.weight_g) × candidate.price_ars
       if cost > remainingBudget: qty_g = (remainingBudget / candidate.price_ars) × candidate.weight_g
       list.push({ candidate, qty_g, cost })
       used_food_ids.add(candidate.food_id)
       remainingBudget -= cost
       remainingProtein -= (candidate.protein_per_100g / 100) × qty_g
       remainingCarbs   -= (candidate.carbs_per_100g / 100) × qty_g
       remainingFats    -= (candidate.fats_per_100g / 100) × qty_g
     ```
   - Asegurar variedad: priorizar `food_id` no usados aún. Si todos los foods relevantes ya están en la lista, permitir agregar qty al mismo SKU (consolidar, no duplicar row).
   - Cap qty por producto a un máximo razonable (ej: 5000g semanales por SKU).

PARTE 6 — Tests
9. Crear `tests/optimizer/build.test.ts` con casos (usando fixtures de `Candidate[]` — no requieren DB):
   - Profile vegano + budget 50k ARS + targets razonables → la lista no contiene candidates con `is_vegan = false`.
   - Profile con `'Sin TACC'` → lista no contiene candidates con `is_gluten_free = false`.
   - Budget muy bajo (10k ARS) → función devuelve lista parcial + flag `feasible: false`.
   - Budget alto + targets normales → lista cubre ≥95% de proteína target.
   - Productos sin food_id NO aparecen en candidates (porque `loadCandidates` hace INNER JOIN). Test fixture refleja esto.

🙋 ACCIÓN HUMANA REQUERIDA: SÍ — decisión sobre algoritmo (A/B/C).

✅ CRITERIOS DE ACEPTACIÓN:
- `docs/optimizer/formulation.md` documenta el problema.
- Filtrado excluye correctamente alergenos / dieta vía flags de `foods`.
- Greedy core devuelve lista en <2s para 1000 candidates.
- Tests unitarios pasan.

📁 ARCHIVOS A CREAR:
- docs/optimizer/formulation.md
- lib/optimizer/types.ts
- lib/optimizer/loadCandidates.ts
- lib/optimizer/filter.ts
- lib/optimizer/score.ts
- lib/optimizer/build.ts
- tests/optimizer/build.test.ts
````

---

## P6.B — API route + persistencia + manejo de infeasibilidad

````prompt
🎯 TAREA: 6.6, 6.7, 6.8, 6.9 — API generador, persistencia, stats, manejo de infeasibilidad

📚 CONTEXTO OBLIGATORIO A LEER:
- lib/optimizer/* (de P6.A)
- docs/optimizer/formulation.md
- docs/implementation_plan.md (Fase 6)

🛠️ SKILLS / MCPs A USAR:
- supabase/agent-skills (para schema y RLS)

📋 INSTRUCCIONES:

PARTE 1 — Stats de salida
1. Modificar `lib/optimizer/build.ts` para que devuelva:
   ```ts
   {
     items: { product_id, qty_g, cost: number }[],
     summary: {
       total_cost: number,
       total_calories: number,
       total_protein_g: number,
       total_carbs_g: number,
       total_fats_g: number,
       total_fiber_g: number,
       micros_coverage_pct: Record<string, number>,
       budget_usage_pct: number,
       targets_match_pct: { protein, carbs, fats },
     },
     feasible: boolean,
     feasibility_message: string | null,
   }
   ```

PARTE 2 — Schema y migración
2. Crear migración `db/migrations/007_shopping_lists.sql` (006 está reservado para `scrape_logs` en P5.C):
   ```sql
   create table if not exists shopping_lists (
     id uuid primary key default gen_random_uuid(),
     user_id uuid not null references auth.users(id) on delete cascade,
     week_start date not null,
     summary_json jsonb not null,
     feasible boolean not null,
     created_at timestamptz default now(),
     unique(user_id, week_start)
   );

   create table if not exists shopping_list_items (
     id uuid primary key default gen_random_uuid(),
     list_id uuid not null references shopping_lists(id) on delete cascade,
     product_id uuid not null references products(id),
     qty_g numeric not null,
     cost numeric(10,2) not null,
     checked boolean default false,
     position int
   );

   alter table shopping_lists enable row level security;
   alter table shopping_list_items enable row level security;

   create policy "users read own lists" on shopping_lists
     for select using (auth.uid() = user_id);
   create policy "users manage own lists" on shopping_lists
     for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

   create policy "users read own list items" on shopping_list_items
     for select using (exists (
       select 1 from shopping_lists where id = list_id and user_id = auth.uid()
     ));
   create policy "users manage own list items" on shopping_list_items
     for all using (exists (
       select 1 from shopping_lists where id = list_id and user_id = auth.uid()
     )) with check (exists (
       select 1 from shopping_lists where id = list_id and user_id = auth.uid()
     ));
   ```
3. PAUSAR Y PEDIR AL USUARIO ejecutar la migración.

PARTE 3 — API route
4. Crear `app/api/shopping-list/generate/route.ts` (POST):
   - Server-only. Verificar sesión.
   - Leer perfil + targets de la semana actual.
   - Cargar candidates con `loadCandidates(supabase, profile.region)` — JOIN de `products` × `foods`, filtrado por región.
   - Aplicar `filterCandidates(candidates, profile)`.
   - Llamar a `buildShoppingList(profile, targets, filtered)`.
   - Si `feasible = false`, devolver 200 con la lista parcial + `feasibility_message` clara.
     - Ej: "Tu presupuesto cubre solo el 70% de tu proteína target. Sugerencias: subir presupuesto a $X, o ajustar el goal a 'maintenance'."
   - Persistir en `shopping_lists` + `shopping_list_items` (con `product_id` apuntando a `products.id`).
   - Devolver el ID + summary.

PARTE 4 — Manejo de infeasibilidad
5. Implementar lógica en `lib/optimizer/build.ts` para detectar infeasibilidad:
   - Calcular el presupuesto mínimo viable: cost del producto más eficiente en ARS/g de proteína × target proteína.
   - Si el budget del user < ese mínimo, devolver `feasible: false` con sugerencia concreta.
6. La sugerencia tiene que ser actionable, no genérica:
   - "Necesitás ~$X/semana para llegar a tu target de proteína. Estás en $Y. Opciones: subir a $X, bajar el target de proteína, o relajar la restricción `<dietary_tag>`."

PARTE 5 — Tests
7. Agregar tests en `tests/optimizer/api.test.ts`:
   - Llamada con profile + DB de products de fixtures → lista válida.
   - Llamada con budget imposible → infeasible + mensaje útil.

🙋 ACCIÓN HUMANA REQUERIDA: SÍ — ejecutar migración SQL.

✅ CRITERIOS DE ACEPTACIÓN:
- POST a `/api/shopping-list/generate` con perfil completo devuelve lista en <5s.
- La lista persiste en DB (cabecera + items).
- `summary.targets_match_pct.protein` ≥ 95% en casos factibles.
- Casos infactibles devuelven mensaje accionable.
- RLS impide cross-user.

📁 ARCHIVOS A CREAR / MODIFICAR:
- app/api/shopping-list/generate/route.ts
- lib/optimizer/build.ts (modificar)
- tests/optimizer/api.test.ts
- db/migrations/007_shopping_lists.sql
````

---

## Cierre de fase

Pedirle al usuario que pruebe la generación con 2-3 perfiles diferentes (gym bro, mujer fat-loss, vegano) y juzgue si los outputs son sensatos. Si la lista parece "rara" (pura bondiola, o demasiado uniforme), iterar el scoring antes de pasar a UI.
