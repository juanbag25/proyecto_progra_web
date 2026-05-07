import 'server-only';

import { Type, type Schema } from '@google/genai';
import { z } from 'zod';
import type { NutritionInputs, WeeklyTargets } from './tdee';

/**
 * "AI Nutritionist" prompt + schemas. Two-layer validation:
 *   1. Provider-native schema (Gemini Schema) shapes the model's JSON output.
 *   2. Zod schema (`nutritionLLMResponseSchema`) re-validates it server-side
 *      before we trust the values — Gemini honors `responseSchema` very
 *      consistently, but skipping the second pass would be reckless for
 *      anything health-adjacent.
 */

// -- System prompt -----------------------------------------------------------
//
// Locked rules:
//   * No invented nutrients — only the 9 micros listed below.
//   * Targets must stay in scientifically defensible ranges.
//   * Aggressive deficits (>25%) get walked back AND explained.
//   * Always JSON, always Spanish rioplatense, "personal trainer + amigo" tone.

export const NUTRITIONIST_SYSTEM_PROMPT = `Sos un nutricionista deportivo basado en evidencia científica. Tu rol es ajustar y enriquecer targets nutricionales semanales para un usuario específico, dadas sus métricas, objetivo, restricciones y un cálculo determinístico previo (Mifflin-St Jeor + factor de actividad + ajuste por goal).

Reglas inviolables:
- NUNCA inventes nutrientes. Sólo trabajás con macros estándar (calorías, proteína, carbos, grasas, fibra) y los 9 micros que se te piden.
- Los targets de macros tienen que estar en rangos saludables y sostenibles. Tomás como baseline el cálculo determinístico que recibís y lo ajustás sólo si es necesario por restricciones (ej: dieta vegana → más B12, hierro), edad/género (ej: mujer en edad fértil → más hierro y calcio), u otros factores legítimos.
- Si el goal es fat_loss y el déficit calculado es mayor al 25% del TDEE, ajustalo a -25% como máximo y explicá en el campo "explanation" por qué.
- Para micros, dá targets SEMANALES (no diarios) para exactamente estos 9: vitamin_d_iu, vitamin_b12_mcg, iron_mg, calcium_mg, magnesium_mg, zinc_mg, potassium_mg, omega3_g, fiber_g. Multiplicá las RDAs diarias por 7.
- Considerá las restricciones del usuario (alergias, dietas) al sugerir prioridades en "explanation". Si es vegano, mencioná B12 e hierro. Si es mujer joven, mencioná hierro y calcio. No moralices — informá.
- Devolvé SIEMPRE JSON válido siguiendo exactamente el schema que se te pasa. No agregues campos extra. No envuelvas el JSON en markdown.

Tono y estilo del campo "explanation":
- 2 a 3 oraciones cortas, en español rioplatense (vos, no tú).
- Tono "personal trainer experto pero amigo": confiado, motivante, datos-backed, nunca preachy.
- Mencioná SOLO 1-2 datos relevantes del cálculo (ej: "te calculamos un déficit del 20% sobre tu TDEE"). El detalle largo va en otra UI.
- Cerrá con algo concreto y accionable, no con un disclaimer.

Ejemplos de tono OK:
✅ "Te calculamos un déficit del 20% sobre tu TDEE para una pérdida sostenible. Subimos un poco la proteína (2.2 g/kg) para protegerte la masa magra mientras bajás. Comé fuerte de carnes magras y huevo."
✅ "Para hipertrofia te dejamos un superávit del 10%, con proteína al piso de 2 g/kg. Sumamos hierro y B12 porque dijiste que sos vegana — atenta con esos."

Ejemplos de tono que NO va:
❌ "Es importante consultar a un médico antes de iniciar cualquier plan." (preachy, disclaimer)
❌ "Su déficit calórico es del 20%." (formal, no-rioplatense)
❌ "¡Vamos campeón! Tu cuerpo te va a agradecer este cambio increíble." (exagerado, vacío)`;

// -- User prompt builder -----------------------------------------------------

export function buildNutritionUserPrompt(
  profile: NutritionInputs & {
    allergies?: string[] | null;
    dietary_restrictions?: string[] | null;
    preferred_foods?: string[] | null;
    disliked_foods?: string[] | null;
  },
  baseline: WeeklyTargets,
): string {
  const restrictions =
    [
      profile.allergies?.length ? `Alergias: ${profile.allergies.join(', ')}` : null,
      profile.dietary_restrictions?.length
        ? `Dietas: ${profile.dietary_restrictions.join(', ')}`
        : null,
    ]
      .filter(Boolean)
      .join(' · ') || 'sin restricciones declaradas';

  return `Perfil del usuario:
- Edad: ${profile.age}
- Sexo: ${profile.gender}
- Peso: ${profile.weight_kg} kg
- Altura: ${profile.height_cm} cm
- Nivel de actividad: ${profile.activity_level}
- Objetivo: ${profile.fitness_goal}
- ${restrictions}

Cálculo determinístico (Mifflin-St Jeor + factor actividad + ajuste por goal) — usalo como punto de partida, ajustá solo si hay razones de salud:
- Calorías diarias: ${baseline.daily_calories}
- Calorías semanales: ${baseline.weekly_calories}
- Proteína semanal: ${baseline.weekly_protein_g} g
- Carbos semanales: ${baseline.weekly_carbs_g} g
- Grasas semanales: ${baseline.weekly_fats_g} g
- Fibra semanal: ${baseline.weekly_fiber_g} g

Devolvé los targets semanales finales (macros + 9 micros) y la explicación, en JSON.`;
}

// -- Zod schema (server-side validation) ------------------------------------

export const microsSchema = z.object({
  vitamin_d_iu: z.number().nonnegative(),
  vitamin_b12_mcg: z.number().nonnegative(),
  iron_mg: z.number().nonnegative(),
  calcium_mg: z.number().nonnegative(),
  magnesium_mg: z.number().nonnegative(),
  zinc_mg: z.number().nonnegative(),
  potassium_mg: z.number().nonnegative(),
  omega3_g: z.number().nonnegative(),
  fiber_g: z.number().nonnegative(),
});

export const nutritionLLMResponseSchema = z.object({
  weekly_calories: z.number().positive(),
  weekly_protein_g: z.number().positive(),
  weekly_carbs_g: z.number().positive(),
  weekly_fats_g: z.number().positive(),
  weekly_fiber_g: z.number().positive(),
  micros: microsSchema,
  explanation: z.string().min(20).max(800),
});

export type NutritionLLMResponse = z.infer<typeof nutritionLLMResponseSchema>;
export type Micros = z.infer<typeof microsSchema>;

// -- Gemini-native response schema -------------------------------------------
// Mirrors the zod schema above so the model emits the right shape on the
// first try. Keep the two in sync — if you add a field, add it in BOTH places.

const microsResponseSchema: Schema = {
  type: Type.OBJECT,
  required: [
    'vitamin_d_iu',
    'vitamin_b12_mcg',
    'iron_mg',
    'calcium_mg',
    'magnesium_mg',
    'zinc_mg',
    'potassium_mg',
    'omega3_g',
    'fiber_g',
  ],
  properties: {
    vitamin_d_iu: { type: Type.NUMBER },
    vitamin_b12_mcg: { type: Type.NUMBER },
    iron_mg: { type: Type.NUMBER },
    calcium_mg: { type: Type.NUMBER },
    magnesium_mg: { type: Type.NUMBER },
    zinc_mg: { type: Type.NUMBER },
    potassium_mg: { type: Type.NUMBER },
    omega3_g: { type: Type.NUMBER },
    fiber_g: { type: Type.NUMBER },
  },
};

export const nutritionResponseSchema: Schema = {
  type: Type.OBJECT,
  required: [
    'weekly_calories',
    'weekly_protein_g',
    'weekly_carbs_g',
    'weekly_fats_g',
    'weekly_fiber_g',
    'micros',
    'explanation',
  ],
  properties: {
    weekly_calories: { type: Type.NUMBER },
    weekly_protein_g: { type: Type.NUMBER },
    weekly_carbs_g: { type: Type.NUMBER },
    weekly_fats_g: { type: Type.NUMBER },
    weekly_fiber_g: { type: Type.NUMBER },
    micros: microsResponseSchema,
    explanation: { type: Type.STRING },
  },
};
