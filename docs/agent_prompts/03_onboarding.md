# Fase 3 — Onboarding (The Interview)

2 prompts. Flow swipeable de cards que captura todo el perfil del usuario.

---

## P3.A — State machine + schema de DB del perfil

````prompt
🎯 TAREA: 3.1 — State machine del onboarding + schema de DB

📚 CONTEXTO OBLIGATORIO A LEER:
- docs/project_definition/02_core_functionality.md (sección 1: User Profiling)
- docs/project_definition/03_user_workflow.md (Phase 1 del workflow)
- docs/implementation_plan.md (Fase 3)
- db/migrations/001_users_profile.sql (de Fase 2)

🛠️ SKILLS / MCPs A USAR:
- supabase/agent-skills (para el patrón de migrations + RLS)

📋 INSTRUCCIONES:
1. Diseñar el schema completo del perfil. Crear migración `db/migrations/002_user_profile_data.sql`:
   ```sql
   -- Biometría
   alter table users_profile
     add column if not exists age int,
     add column if not exists weight_kg numeric(5,2),
     add column if not exists height_cm numeric(5,2),
     add column if not exists gender text check (gender in ('male','female','other'));

   -- Actividad
   alter table users_profile
     add column if not exists activity_level text check (activity_level in ('sedentary','light','moderate','active','athlete')),
     add column if not exists exercise_type text[];

   -- Goal
   alter table users_profile
     add column if not exists fitness_goal text check (fitness_goal in ('muscle_gain','fat_loss','recomp','strength','maintenance'));

   -- Preferencias
   alter table users_profile
     add column if not exists preferred_foods text[],
     add column if not exists disliked_foods text[];

   -- Restricciones
   alter table users_profile
     add column if not exists allergies text[],
     add column if not exists dietary_restrictions text[];

   -- Logística
   alter table users_profile
     add column if not exists country text,
     add column if not exists region text,
     add column if not exists weekly_budget_ars numeric(10,2);

   -- Estado del onboarding (para resume)
   alter table users_profile
     add column if not exists onboarding_step int default 0;
   ```
2. PAUSAR Y PEDIR AL USUARIO ejecutar la migración en Supabase SQL Editor. Confirmar antes de seguir.
3. Crear `lib/onboarding/schema.ts` con:
   - Type `UserProfileData` que matchea el schema.
   - Validadores zod por step (`biometricsSchema`, `activitySchema`, `goalSchema`, etc.).
   - Type `OnboardingStep` enum: `BIOMETRICS | ACTIVITY | GOAL | PREFERENCES | RESTRICTIONS | LOCATION | BUDGET | REVIEW`.
4. Crear `lib/onboarding/machine.ts` con:
   - State machine simple (sin XState, vanilla TS) que tracquea step actual + draft data en memoria + persistencia auto-save.
   - Funciones: `getNextStep`, `getPrevStep`, `validateStep`, `persistDraft(step, data)`.
   - El `persistDraft` hace UPDATE a `users_profile` setteando los campos del step actual + `onboarding_step`.
5. Crear `app/api/onboarding/draft/route.ts` (POST) que reciba `{ step, data }` y persista. RLS + zod en el server.

🙋 ACCIÓN HUMANA REQUERIDA: SÍ — ejecutar la migración SQL en Supabase Dashboard.

✅ CRITERIOS DE ACEPTACIÓN:
- Migración aplicada sin error.
- `lib/onboarding/schema.ts` exporta tipos y validadores.
- POST a `/api/onboarding/draft` con datos válidos persiste; con inválidos devuelve 400.
- Resume: si `onboarding_step = 3`, la app sabe en qué paso retomar.
- RLS sigue impidiendo cross-user reads.

📁 ARCHIVOS A CREAR / MODIFICAR:
- db/migrations/002_user_profile_data.sql
- lib/onboarding/schema.ts
- lib/onboarding/machine.ts
- app/api/onboarding/draft/route.ts
- package.json (deps: zod si no estaba)
````

---

## P3.B — Cards de los 7 steps + review + edit

```prompt
🎯 TAREA: 3.2 a 3.10 — UI completa del onboarding swipeable

📚 CONTEXTO OBLIGATORIO A LEER:
- docs/project_definition/05_aesthetics.md (sección "Onboarding (The Interview)")
- docs/project_definition/04_brand_identity.md (tono de copys)
- lib/onboarding/* (de P3.A)
- components/ui/SwipeableCard.tsx (de Fase 1)

🛠️ SKILLS / MCPs A USAR:
- simplify (al final, para deduplicar entre cards)

📋 INSTRUCCIONES:
1. Crear `app/onboarding/layout.tsx`:
   - Layout fullscreen, fondo `mesh-gradient`.
   - Progress bar en la parte superior (cyan) que muestra `currentStep / totalSteps`.
   - Botón "Atrás" (ghost) si no es step 0.
   - Soft animation de transición entre cards (slide horizontal).

2. Crear `app/onboarding/page.tsx`:
   - Server component que lee `users_profile.onboarding_step` y renderiza el step correspondiente.
   - Si `onboarding_completed = true`, redirect a `/app`.

3. Crear un componente `<OnboardingStepCard>` reusable en `components/onboarding/StepCard.tsx`:
   - GlassCard centrado con título grande, subtítulo, slot para inputs, botón "Continuar" (primary).
   - Maneja swipe right para "Continuar" si es válido, swipe left para "Atrás".

4. Crear los 7 step cards en `components/onboarding/steps/`:
   - `BiometricsStep.tsx`: edad (NumberInput), peso kg (NumberInput), altura cm (NumberInput), género (Select).
   - `ActivityStep.tsx`: nivel de actividad (Select con 5 opciones + descripción de cada una), tipo de ejercicio (chips multi-select).
   - `GoalStep.tsx`: 5 cards visuales grandes (hipertrofia, pérdida de grasa, recomp, fuerza, mantenimiento), tap para seleccionar. Cada una con un ícono + descripción 1-liner.
   - `PreferencesStep.tsx`: dos textareas tipo chips: "Lo que amás" y "Lo que odiás". Sugerencias precargadas como chips clickeables (pollo, arroz, atún, etc.).
   - `RestrictionsStep.tsx`: chips multi-select para alergias comunes (gluten, lactosa, frutos secos, mariscos, soja, huevo) + chips para dietas (vegano, vegetariano, kosher, halal). Campo libre "otras".
   - `LocationStep.tsx`: Select de país (default Argentina), Select de región/provincia. Por ahora hardcodear Argentina + lista de provincias.
   - `BudgetStep.tsx`: NumberInput grande para ARS semanales con feedback visual ("Eso es ~$X por día"). Slider opcional.

5. Crear `components/onboarding/ReviewStep.tsx`:
   - Resumen visual de todo lo cargado, agrupado en cards por categoría.
   - Botón grande "Confirmar y generar mi plan" (primary, glow cyan).
   - Cada categoría tiene un botón pequeño "editar" que vuelve al step correspondiente.
   - Submit hace POST a `/api/onboarding/complete` que:
     - Setea `onboarding_completed = true`.
     - Trigger de Phase 4 (cálculo de targets nutricionales) — por ahora sólo redirect a `/app` con un toast "Generando tu plan...".

6. Crear `app/api/onboarding/complete/route.ts` (POST):
   - Validar que todos los campos requeridos estén.
   - Set `onboarding_completed = true`.
   - Devolver `{ ok: true }`.

7. Crear `app/app/profile/page.tsx` (UI para reeditar perfil):
   - Botón "Editar perfil" que redirige al step 0 del onboarding manteniendo los valores existentes.
   - Vista read-only del perfil actual.

8. Tono de copys ejemplo (todo el flow):
   - "Empezamos. ¿Cuántos años tenés?" (en lugar de "Edad")
   - "Movete por la vida ¿cómo?" (en lugar de "Nivel de actividad")
   - "¿Qué buscás conseguir?" (objetivo)
   - "Lo que comerías todos los días" (preferencias)
   - "Lo que NO podés/querés comer" (restricciones)
   - "¿Dónde vivís?" (ubicación)
   - "¿Cuánto podés gastar por semana en comida?" (presupuesto)

9. Al final, ejecutar la skill `simplify` para revisar duplicación entre los step cards.

🙋 ACCIÓN HUMANA REQUERIDA: Al terminar, pedile al usuario que haga el flow completo en local. Si encuentra fricciones, iterar.

✅ CRITERIOS DE ACEPTACIÓN:
- Flow completo end-to-end sin errores.
- Auto-save por step: si cierras el tab y volvés a entrar, retomás donde estabas.
- Swipe horizontal funciona en mobile y con drag de mouse.
- Animaciones suaves (60fps).
- Validaciones bloquean continuar si faltan campos.
- ReviewStep deja editar cualquier categoría con un click.
- Después de confirmar, `onboarding_completed = true` en DB.
- Botón "Editar perfil" en `/app/profile` funciona.

📁 ARCHIVOS A CREAR / MODIFICAR:
- app/onboarding/layout.tsx
- app/onboarding/page.tsx
- components/onboarding/StepCard.tsx
- components/onboarding/steps/BiometricsStep.tsx
- components/onboarding/steps/ActivityStep.tsx
- components/onboarding/steps/GoalStep.tsx
- components/onboarding/steps/PreferencesStep.tsx
- components/onboarding/steps/RestrictionsStep.tsx
- components/onboarding/steps/LocationStep.tsx
- components/onboarding/steps/BudgetStep.tsx
- components/onboarding/ReviewStep.tsx
- app/api/onboarding/complete/route.ts
- app/app/profile/page.tsx
```

---

## Cierre de fase

La fricción del onboarding es decisiva para la retención. Pedile al usuario que lo pruebe en mobile (DevTools responsive) y dé visto bueno antes de Fase 4.
