# Fase 6 — Optimization Algorithm

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
   - **Variables de decisión:** `qty[i]` = cantidad (en gramos) del producto `i`.
   - **Objetivo:** minimizar distancia ponderada a targets nutricionales semanales + maximizar variedad + minimizar costo.
     - Función score: `0.5 * sum_macros_distance + 0.2 * micros_coverage_gap + 0.2 * cost_ratio + 0.1 * (1 - variety_score)`.
   - **Constraints duras:**
     - `sum(qty[i] * price_per_g[i]) ≤ weekly_budget`.
     - Excluir productos que contengan alergenos del user.
     - Excluir productos en `disliked_foods`.
     - Excluir productos no compatibles con dieta (vegano, vegetariano, etc.) — requerimos un campo `dietary_tags` en products que se infiere por categoría/marca.
   - **Constraints blandas (penalización):**
     - Lejanía a target de proteína (peso 3x).
     - Lejanía a target de grasa y carbos (peso 1x).
     - Falta de variedad (todos los kg de proteína viniendo de un solo producto: penalizar).
     - Productos no en `preferred_foods` (penalización leve).

PARTE 2 — Decisión de algoritmo
2. PAUSAR Y PRESENTAR AL USUARIO 3 opciones, con trade-offs:
   - **(A) LP solver** (`javascript-lp-solver`): exacto y rápido para problemas chicos. Limitación: no maneja bien constraints no-lineales (variedad), y la "elección de producto" es entera (no podés comprar 0.3 paquetes de arroz).
   - **(B) Heurística greedy + scoring**: ordena productos por score (proteína por peso, fiber por peso, etc.) y va llenando la lista respetando budget. Rápido, predecible, fácil de debuggear. Sub-óptimo pero "good enough".
   - **(C) Híbrido**: heurística greedy para arrancar + búsqueda local (swap moves) para mejorar 100 iteraciones.
   - **Recomendación:** empezar con (B), si los outputs son flojos pasar a (C). LP queda en el roadmap si un día queremos optimalidad demostrable.
3. Esperar decisión del usuario. Continuar con la opción elegida.

PARTE 3 — Filtrado de candidatos
4. Crear `lib/optimizer/filter.ts` con función `filterCandidates(products, profile) → Product[]`:
   - Excluir si `name`/`category` matchea allergies del user (búsqueda fuzzy básica).
   - Excluir si está en `disliked_foods`.
   - Si user es vegano/vegetariano, excluir productos en categoría `protein_animal`, `dairy`, etc.
   - Excluir productos sin precio o sin nutrición mínima (calorías + macros).
   - Devolver el array filtrado.

PARTE 4 — Scoring
5. Crear `lib/optimizer/score.ts` con función `scoreProduct(product, targets) → number`:
   - Score inicial = 0.
   - +X si tiene mucha proteína por ARS.
   - +Y si tiene fiber.
   - +Z si está en `preferred_foods` (boost).
   - −W si es ultra-procesado (heurística por nombre/marca).
   - Devolver score normalizado 0–100.

PARTE 5 — Optimizer core
6. Crear `lib/optimizer/build.ts` con `buildShoppingList(profile, targets, products) → ShoppingList`:
   - Algoritmo greedy (asumiendo opción B):
     ```
     remainingBudget = profile.weekly_budget
     remainingProtein = targets.weekly_protein_g
     remainingCarbs = targets.weekly_carbs_g
     remainingFats = targets.weekly_fats_g
     list = []

     while remainingBudget > 0 AND remainingProtein > 0:
       candidate = pickBestForRemainingNeed(products, remaining*, list, profile.preferred_foods)
       if candidate is null: break
       qty = computeOptimalQty(candidate, remaining*)
       cost = qty * candidate.price_per_g
       if cost > remainingBudget: qty = remainingBudget / candidate.price_per_g
       list.push({ product: candidate, qty })
       update remaining*
     ```
   - Asegurar variedad: no permitir que el mismo producto aparezca 2 veces (acumular qty si ya está).
   - Cap qty por producto a un máximo razonable (5kg de pollo es ridículo para 1 semana).

PARTE 6 — Tests
7. Crear `tests/optimizer/build.test.ts` con casos:
   - Profile vegano + budget 50k ARS + targets razonables → la lista no contiene productos animales.
   - Profile con alergia a gluten → lista no contiene trigo, avena no certificada.
   - Budget muy bajo (10k ARS) → función devuelve lista incompleta + flag `feasible: false`.
   - Budget alto + targets normales → lista cubre ≥95% de proteína target.

🙋 ACCIÓN HUMANA REQUERIDA: SÍ — decisión sobre algoritmo (A/B/C).

✅ CRITERIOS DE ACEPTACIÓN:
- `docs/optimizer/formulation.md` documenta el problema.
- Filtrado excluye correctamente alergenos / dieta.
- Greedy core devuelve lista en <2s para 1000 productos.
- Tests unitarios pasan.

📁 ARCHIVOS A CREAR:
- docs/optimizer/formulation.md
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
2. Crear migración `db/migrations/006_shopping_lists.sql`:
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
   - Leer `products` filtrando por región del user.
   - Llamar a `buildShoppingList`.
   - Si `feasible = false`, devolver 200 con la lista parcial + `feasibility_message` clara.
     - Ej: "Tu presupuesto cubre solo el 70% de tu proteína target. Sugerencias: subir presupuesto a $X, o ajustar el goal a 'maintenance'."
   - Persistir en `shopping_lists` + `shopping_list_items`.
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
- db/migrations/006_shopping_lists.sql
````

---

## Cierre de fase
Pedirle al usuario que pruebe la generación con 2-3 perfiles diferentes (gym bro, mujer fat-loss, vegano) y juzgue si los outputs son sensatos. Si la lista parece "rara" (pura bondiola, o demasiado uniforme), iterar el scoring antes de pasar a UI.
