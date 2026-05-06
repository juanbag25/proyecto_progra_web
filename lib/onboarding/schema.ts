import { z } from 'zod';

// Ordered list of onboarding steps. Index = position in the resume cursor
// stored in users_profile.onboarding_step.
export const ONBOARDING_STEPS = [
  'biometrics',
  'activity',
  'goal',
  'preferences',
  'restrictions',
  'location',
  'budget',
  'review',
] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

// --- Per-step Zod schemas ---------------------------------------------------
// Each schema validates the slice of profile data the corresponding step
// captures. The keys MUST match the `users_profile` column names so the
// `/api/onboarding/draft` handler can spread the parsed object straight into
// the UPDATE payload.

export const biometricsSchema = z.object({
  age: z.number().int().min(13).max(120),
  weight_kg: z.number().positive().min(30).max(300),
  height_cm: z.number().positive().min(100).max(250),
  gender: z.enum(['male', 'female', 'other']),
});

export const activitySchema = z.object({
  activity_level: z.enum(['sedentary', 'light', 'moderate', 'active', 'athlete']),
  exercise_type: z.array(z.string().min(1).max(60)).max(20),
});

export const goalSchema = z.object({
  fitness_goal: z.enum(['muscle_gain', 'fat_loss', 'recomp', 'strength', 'maintenance']),
});

export const preferencesSchema = z.object({
  preferred_foods: z.array(z.string().min(1).max(80)).max(50),
  disliked_foods: z.array(z.string().min(1).max(80)).max(50),
});

export const restrictionsSchema = z.object({
  allergies: z.array(z.string().min(1).max(60)).max(30),
  dietary_restrictions: z.array(z.string().min(1).max(60)).max(20),
});

export const locationSchema = z.object({
  country: z.string().min(2).max(100),
  region: z.string().min(2).max(100),
});

export const budgetSchema = z.object({
  weekly_budget_ars: z.number().positive().min(1000).max(10_000_000),
});

// Review step has no input — it just confirms; the API handler interprets
// this as "mark onboarding_completed = true".
export const reviewSchema = z.object({}).strict();

export const STEP_SCHEMAS = {
  biometrics: biometricsSchema,
  activity: activitySchema,
  goal: goalSchema,
  preferences: preferencesSchema,
  restrictions: restrictionsSchema,
  location: locationSchema,
  budget: budgetSchema,
  review: reviewSchema,
} as const satisfies Record<OnboardingStep, z.ZodType>;

// Per-step inferred input shape, indexed by step name.
export type StepDataMap = {
  [K in OnboardingStep]: z.infer<(typeof STEP_SCHEMAS)[K]>;
};

// Full profile = union of every step's fields. Only useful as a reference
// type; the DB row may have any subset of these set at any time.
export type UserProfileData = StepDataMap['biometrics'] &
  StepDataMap['activity'] &
  StepDataMap['goal'] &
  StepDataMap['preferences'] &
  StepDataMap['restrictions'] &
  StepDataMap['location'] &
  StepDataMap['budget'];
