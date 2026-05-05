# Fase 8 — Weekly Feedback Loop

1 prompt. Cierre del ciclo: peso, adherencia, recalibración, nueva lista.

---

## P8.A — Feedback loop completo

````prompt
🎯 TAREA: 8.1 a 8.6 — Trigger, form, recalibración, comparativa, gráfico de progreso

📚 CONTEXTO OBLIGATORIO A LEER:
- docs/project_definition/03_user_workflow.md (Phase 5: Weekly Feedback Loop)
- docs/project_definition/04_brand_identity.md (tono motivador en feedback)
- docs/implementation_plan.md (Fase 8)
- lib/nutrition/tdee.ts (de Fase 4)

🛠️ SKILLS / MCPs A USAR:
- supabase/agent-skills

📋 INSTRUCCIONES:

PARTE 1 — Schema y migración
1. Crear migración `db/migrations/007_feedback.sql`:
   ```sql
   create table if not exists weight_logs (
     id uuid primary key default gen_random_uuid(),
     user_id uuid not null references auth.users(id) on delete cascade,
     weight_kg numeric(5,2) not null,
     logged_at date not null default current_date,
     created_at timestamptz default now(),
     unique(user_id, logged_at)
   );

   create table if not exists weekly_feedback (
     id uuid primary key default gen_random_uuid(),
     user_id uuid not null references auth.users(id) on delete cascade,
     week_start date not null,
     finished_food boolean,
     adherence_pct int check (adherence_pct between 0 and 100),
     budget_actual numeric,
     notes text,
     created_at timestamptz default now(),
     unique(user_id, week_start)
   );

   alter table weight_logs enable row level security;
   alter table weekly_feedback enable row level security;
   create policy "users manage own logs" on weight_logs for all
     using (auth.uid() = user_id) with check (auth.uid() = user_id);
   create policy "users manage own feedback" on weekly_feedback for all
     using (auth.uid() = user_id) with check (auth.uid() = user_id);
   ```
2. PAUSAR Y PEDIR AL USUARIO ejecutar la migración.

PARTE 2 — Trigger
3. Lógica de trigger:
   - El backend marca una lista como "due for feedback" cuando han pasado ≥7 días desde `created_at`.
   - El user ve un banner sticky en `/app` cuando hay feedback pendiente: "Cerrá la semana 📋" (si emoji aprobado, sino texto).
   - También permitir trigger manual desde un botón en /app/list.

PARTE 3 — Form de feedback
4. Crear `app/app/feedback/page.tsx` con un mini-flow tipo onboarding (3 cards):
   - **Card 1 — Adherencia**: "¿Cómo te fue?" con 3 botones grandes (Bien, Más o menos, Mal). Si "Más o menos" o "Mal", textarea para notas (opcional).
   - **Card 2 — Peso**: "¿Cuánto pesás hoy?" con NumberInput grande, mostrar diff vs peso anterior (ej: "−0.4 kg vs hace una semana 💪" con tono motivador).
   - **Card 3 — Presupuesto**: "¿Gastaste lo que pensabas?" con un slider de %, default 100%. Permitir ajustar el budget de la próxima semana ("¿Querés cambiar el presupuesto? Ahora son $X").

5. On submit:
   - POST a `/api/feedback/submit` con todos los datos.
   - Espera de 1-2s con loading state motivador.
   - Redirect a `/app/list` mostrando la nueva lista generada.

PARTE 4 — API + recalibración
6. Crear `lib/nutrition/recalibration.ts`:
   - Función `recalibrateProfile(profile, weightDelta, goal) → newAdjustments`:
     - Compara delta de peso vs delta esperado para el goal.
     - Si goal=fat_loss y peso no bajó: aumentar déficit en 5%.
     - Si goal=fat_loss y peso bajó >1kg/sem: avisar "estás bajando muy rápido, te subo las cals 5%" (defensa anti-perdida-de-músculo).
     - Si goal=muscle_gain y peso no subió: aumentar superávit en 5%.
     - Si peso subió mucho y goal=muscle_gain: alertar "ganaste +0.6kg, está OK pero si seguís así te paso a recomp".
     - Devuelve nuevos targets sin reescribir profile (audit trail).

7. Crear `app/api/feedback/submit/route.ts` (POST):
   - Server-only.
   - Validar payload con zod.
   - Insertar en `weight_logs` y `weekly_feedback`.
   - Llamar a `recalibrateProfile`.
   - Llamar al endpoint de generate de nutrition targets (Fase 4) con los nuevos parámetros.
   - Llamar al endpoint de generate de shopping list (Fase 6) para la próxima semana.
   - Devolver `{ next_list_id }` y un summary de cambios.

PARTE 5 — Comparativa
8. Crear `components/feedback/WeekComparison.tsx`:
   - GlassCard con 2 columnas: "Semana pasada" / "Esta semana".
   - Diff de: macros target, costo total, peso, adherencia.
   - Iconitos ↑ ↓ → en cyan/coral según dirección esperada.

PARTE 6 — Gráfico de progreso
9. Crear `components/feedback/ProgressChart.tsx`:
   - Line chart simple (recomendado: usar `recharts` o un SVG manual si querés evitar dep).
   - X axis: fechas de los `weight_logs`.
   - Y axis: peso.
   - Línea cyan, fondo charcoal.
   - Banda de "rango esperado" según goal (verde mint translúcido).
10. PAUSAR Y AVISAR al usuario antes de instalar `recharts` si no estaba — alternativa: SVG manual con d3-shape.
11. Mostrar este chart en `/app/profile` y en `/app/feedback` después del submit.

🙋 ACCIÓN HUMANA REQUERIDA: SÍ — ejecutar migración SQL; aprobar instalación de `recharts` si lo proponés.

✅ CRITERIOS DE ACEPTACIÓN:
- Después de 7 días de la creación de una lista, el banner de feedback aparece.
- El form submit dispara recalibración y nueva lista en cadena.
- WeekComparison muestra diffs claros.
- ProgressChart se actualiza con cada nuevo weight log.
- Tono empático en todos los copys.

📁 ARCHIVOS A CREAR / MODIFICAR:
- app/app/feedback/page.tsx
- lib/nutrition/recalibration.ts
- app/api/feedback/submit/route.ts
- components/feedback/WeekComparison.tsx
- components/feedback/ProgressChart.tsx
- db/migrations/007_feedback.sql
- app/app/page.tsx (banner sticky de feedback pendiente)
- app/app/profile/page.tsx (mostrar ProgressChart)
````

---

## Cierre de fase

Esta fase cierra el ciclo del producto. A partir de acá la app es "self-sustaining" semana a semana. Pedirle al usuario una sesión de revisión del flow completo (sign up → onboarding → primera lista → feedback simulado → segunda lista) antes de Fase 9.
