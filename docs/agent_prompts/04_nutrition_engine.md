# Fase 4 — AI Nutrition Engine

**Estado: ✅ DONE** (P4.A + P4.B implementados; commits posteriores a Fase 3).

2 prompts. Convertir el perfil del usuario en macros + micros semanales con LLM + fórmulas científicas.

---

## Decisiones tomadas durante la implementación

- **Proveedor LLM elegido**: Gemini (free tier). Modelo `gemini-2.5-flash`, SDK `@google/genai@^1.52`. La API key vive en `.env.local` como `LLM_API_KEY` (server-only, sin prefix `NEXT_PUBLIC_`).
- **Fallback determinístico**: si el LLM falla validación dos veces, [`generateAndPersistTargets`](../../lib/nutrition/generate.ts) persiste con `method='mifflin_st_jeor'` y `micros=null` en lugar de fallar el request.
- **Hook al fin del onboarding**: [`/api/onboarding/complete`](../../app/api/onboarding/complete/route.ts) llama directamente a `generateAndPersistTargets()` (no fetch self-loop) para evitar un round-trip extra.
- **Persistencia**: [`db/migrations/003_nutrition_targets.sql`](../../db/migrations/003_nutrition_targets.sql) — RLS habilitado, upsert por `(user_id, week_start)`.
- **UI**: [`components/nutrition/TargetsPanel.tsx`](../../components/nutrition/TargetsPanel.tsx) con 3 tabs (Macros / Micros / Cómo calculamos esto), renderizado en `/app` cuando hay targets.
- **Tests**: 27 specs en [`tests/nutrition/tdee.test.ts`](../../tests/nutrition/tdee.test.ts) — Vitest 4.1 instalado durante P4.A.

> Si retomás esta fase para un fix o cambio de proveedor, los prompts originales abajo siguen siendo guía válida — pero la fuente de verdad es el código en `lib/nutrition/`, `lib/llm/`, y la migración `003`.

---

## P4.A — Cálculo determinístico (TDEE + ajuste por goal) [DONE]

````prompt
🎯 TAREA: 4.3, 4.4 — Implementar TDEE (Mifflin-St Jeor) + lógica de ajuste por objetivo

📚 CONTEXTO OBLIGATORIO A LEER:
- docs/project_definition/02_core_functionality.md (sección 2: AI Expert Nutrition Engine)
- docs/project_definition/03_user_workflow.md (Phase 2 del workflow)
- docs/implementation_plan.md (Fase 4)

🛠️ SKILLS / MCPs A USAR:
- (ninguna externa; cálculo determinístico puro)

📋 INSTRUCCIONES:
1. Crear `lib/nutrition/tdee.ts` con:
   - `calculateBMR(profile)`: Mifflin-St Jeor formula:
     - Hombre: `BMR = 10*kg + 6.25*cm - 5*age + 5`
     - Mujer: `BMR = 10*kg + 6.25*cm - 5*age - 161`
     - Other: promedio de las dos.
   - `calculateTDEE(bmr, activityLevel)`: multiplica por factor:
     - sedentary: 1.2
     - light: 1.375
     - moderate: 1.55
     - active: 1.725
     - athlete: 1.9
   - `applyGoalAdjustment(tdee, goal)`:
     - muscle_gain: +10% (superávit moderado)
     - fat_loss: -20% (déficit moderado, no agresivo)
     - recomp: 0% (mantenimiento, énfasis en proteína)
     - strength: +5% (superávit leve)
     - maintenance: 0%
   - `calculateMacros(targetCalories, profile)`:
     - Proteína: 2.0g/kg para muscle_gain/recomp/strength, 2.2g/kg para fat_loss, 1.6g/kg para maintenance.
     - Grasa: 25-30% de calorías totales (mínimo 0.8g/kg).
     - Carbos: el resto.
   - `calculateWeeklyTargets(profile)`: orquesta lo anterior y multiplica por 7. Devuelve objeto:
     ```ts
     {
       weekly_calories: number,
       weekly_protein_g: number,
       weekly_carbs_g: number,
       weekly_fats_g: number,
       weekly_fiber_g: number, // 14g por cada 1000kcal
       daily_calories: number,
       method: 'mifflin_st_jeor' | 'llm_adjusted',
       calculated_at: string
     }
     ```

2. Crear tests unitarios en `tests/nutrition/tdee.test.ts` con casos conocidos:
   - Hombre 25 años, 75kg, 180cm, moderate, muscle_gain → ~2900 kcal/día.
   - Mujer 30 años, 60kg, 165cm, light, fat_loss → ~1500 kcal/día.
   - Casos edge (peso muy bajo / muy alto / edad mínima 14, máxima 80).

3. Decidir el setup de testing si no existe (Vitest recomendado: rápido y compatible con Next). PAUSAR Y AVISAR al usuario antes de instalar Vitest si no estaba en deps.

4. NO incluir micros (vitaminas/minerales) en este prompt. Eso lo hace el LLM en P4.B.

🙋 ACCIÓN HUMANA REQUERIDA: Aprobación para instalar Vitest si no estaba.

✅ CRITERIOS DE ACEPTACIÓN:
- `npm test` corre y pasa todos los casos.
- Función `calculateWeeklyTargets(profile)` devuelve targets en rangos científicamente sanos.
- 100% type-safe (sin any).

📁 ARCHIVOS A CREAR / MODIFICAR:
- lib/nutrition/tdee.ts
- tests/nutrition/tdee.test.ts
- vitest.config.ts (si se instala Vitest)
- package.json (script "test")
````

---

## P4.B — LLM integration + API route + UI explicación [DONE]

````prompt
🎯 TAREA: 4.1, 4.2, 4.5, 4.6, 4.7, 4.8 — LLM nutritional engine + persistencia + UI transparencia

📚 CONTEXTO OBLIGATORIO A LEER:
- docs/project_definition/02_core_functionality.md (sección 2)
- docs/project_definition/04_brand_identity.md (valor "Science-driven")
- docs/implementation_plan.md (Fase 4)
- lib/nutrition/tdee.ts (de P4.A)

🛠️ SKILLS / MCPs A USAR:
- claude-api (CRÍTICO si elegimos Claude API como LLM — usar prompt caching y best practices)
- security-review (al final, para verificar que la API key nunca llega al cliente)

📋 INSTRUCCIONES:

PARTE 1 — Decisión de proveedor LLM
1. PAUSAR Y PREGUNTAR AL USUARIO qué LLM usar:
   - **Claude API (Anthropic)** — recomendado por calidad de razonamiento + skill `claude-api` disponible.
   - **OpenAI GPT-4o**
   - **Gemini**
   Esperar la decisión y la API key. Cuando la pegue, guardarla en `.env.local` como `LLM_PROVIDER` y `LLM_API_KEY`. Pedirle también que la cargue en Vercel env vars.

PARTE 2 — Cliente LLM
2. Crear `lib/llm/client.ts` con un cliente unificado:
   - Lee `LLM_PROVIDER` y dispatch al SDK correcto (`@anthropic-ai/sdk`, `openai`, `@google/generative-ai`).
   - Función `callLLM(systemPrompt, userPrompt, opts)` que devuelve string o JSON parseado.
   - Si es Anthropic: aplicar prompt caching del system prompt (es estable). Esto está cubierto por la skill `claude-api`.
   - Si es OpenAI: usar response_format json_object.
   - Manejo de errores con retries (max 3, exponential backoff).
3. NUNCA loguear la API key. NUNCA exponer este módulo a un client component.

PARTE 3 — System prompt del nutricionista
4. Crear `lib/nutrition/llm-prompt.ts` con el system prompt del "AI Nutritionist":
   ```
   Sos un nutricionista deportivo basado en evidencia científica. Tu rol es ajustar y enriquecer
   targets nutricionales semanales para un usuario específico, dadas sus métricas, objetivo,
   restricciones y un cálculo determinístico previo.

   Reglas:
   - NUNCA inventes nutrientes. Solo trabajá con macros estándar y micros bien documentados.
   - Validá que los targets de macros estén en rangos saludables.
   - Si el goal es fat_loss agresivo (déficit > 25%), ajustalo hacia abajo y explicá.
   - Para micros, dá targets semanales para: vitamin_d_iu, vitamin_b12_mcg, iron_mg, calcium_mg,
     magnesium_mg, zinc_mg, potassium_mg, omega3_g, fiber_g.
   - Considerá las restricciones (vegano, etc.) al sugerir prioridades de micros.
   - Devolvé SIEMPRE JSON válido siguiendo el schema que se te pasa.
   - En el campo "explanation" escribí 2-3 oraciones cortas explicando cómo se llegó a estos
     números, en tono "personal trainer experto pero amigo", siempre en español rioplatense.
   ```

PARTE 4 — API route
5. Crear `app/api/nutrition/targets/route.ts` (POST):
   - Server-only. Verifica sesión.
   - Lee el perfil del user de DB.
   - Llama a `calculateWeeklyTargets(profile)` (P4.A) → targets determinísticos.
   - Pasa profile + targets al LLM con el system prompt + un user prompt que incluye el JSON schema esperado.
   - Valida la respuesta del LLM con zod (`nutritionTargetsSchema`).
   - Si la validación falla, retry una vez. Si falla otra vez, fallback a los targets determinísticos sin micros.
   - Persiste en `nutrition_targets` (ver Parte 5).
   - Devuelve los targets + explanation.

PARTE 5 — Schema de DB
6. Crear migración `db/migrations/003_nutrition_targets.sql`:
   ```sql
   create table if not exists nutrition_targets (
     id uuid primary key default gen_random_uuid(),
     user_id uuid not null references auth.users(id) on delete cascade,
     week_start date not null,
     weekly_calories numeric not null,
     weekly_protein_g numeric not null,
     weekly_carbs_g numeric not null,
     weekly_fats_g numeric not null,
     weekly_fiber_g numeric,
     micros_json jsonb,
     method text not null,
     llm_explanation text,
     created_at timestamptz default now(),
     unique(user_id, week_start)
   );

   alter table nutrition_targets enable row level security;
   create policy "users read own targets" on nutrition_targets
     for select using (auth.uid() = user_id);
   create policy "system insert" on nutrition_targets
     for insert with check (auth.uid() = user_id);
   ```
7. PAUSAR Y PEDIR AL USUARIO que ejecute la migración.

PARTE 6 — UI de transparencia
8. Crear `components/nutrition/TargetsPanel.tsx`:
   - GlassCard con tabs: "Macros" / "Micros" / "Cómo calculamos esto".
   - Macros: 3 RadialProgress (proteína, carbos, grasas) con valor semanal y target en gramos.
   - Micros: lista de cada micro con barra de progreso.
   - "Cómo calculamos esto": muestra el `llm_explanation` + un disclaimer sobre Mifflin-St Jeor + factor de actividad + ajuste por goal.

9. Mostrar este panel en `/app` (cuando exista), después de que el user complete onboarding.

PARTE 7 — Hook al fin del onboarding
10. Modificar `app/api/onboarding/complete/route.ts` (de Fase 3) para que llame a `/api/nutrition/targets` después de marcar el onboarding como completo.

PARTE 8 — Verificación
11. Invocar `security-review` y verificar:
    - API key sólo se accede server-side.
    - El módulo `lib/llm/client.ts` NO está importado en ningún client component.
    - RLS impide que un user lea targets de otro.
12. Probar end-to-end: completar onboarding → ver targets generados con explicación.

🙋 ACCIÓN HUMANA REQUERIDA: SÍ — múltiples veces:
- Decisión del proveedor LLM.
- API key del proveedor (más cargarla en Vercel env vars).
- Ejecutar migración SQL.

✅ CRITERIOS DE ACEPTACIÓN:
- Llamada a `/api/nutrition/targets` con perfil válido devuelve targets en <10s.
- Targets caen en rangos razonables (cross-check con calculateWeeklyTargets).
- `llm_explanation` está en español rioplatense, tono amigable.
- Persistencia funciona (una row por user/week).
- security-review limpio.

📁 ARCHIVOS A CREAR / MODIFICAR:
- lib/llm/client.ts
- lib/nutrition/llm-prompt.ts
- app/api/nutrition/targets/route.ts
- components/nutrition/TargetsPanel.tsx
- db/migrations/003_nutrition_targets.sql
- app/api/onboarding/complete/route.ts (modificar)
- package.json (deps: @anthropic-ai/sdk u openai u @google/generative-ai)
- .env.local (LLM_PROVIDER, LLM_API_KEY)
````

---

## Cierre de fase

Pedirle al usuario que revise el panel de targets para uno de sus perfiles de prueba y juzgue si el output suena científicamente sano y empático.
