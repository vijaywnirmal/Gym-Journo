import { isValidIsoDate } from "./date";

// Only allow same-origin, path-relative redirect targets — prevents open redirects via a crafted `next` param.
export function safeRedirectPath(next: string | null | undefined, fallback = "/"): string {
  if (!next) return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  if (next.includes("://")) return fallback;
  return next;
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Loose sanity bounds — not a precise policy, just enough to catch typos (e.g. future dates,
// or a birth year so old it's clearly a mistake).
// Matches the date picker's range (ProfileFields): at most 120 years ago, and at least 18 years ago.
// 18 is a rule, not a typo check: India's data protection law (DPDP Act) needs a parent's consent
// for anyone younger, so Gym Journal is for adults only (also confirmed at onboarding).
export const MIN_AGE_YEARS = 18;
export const MAX_AGE_YEARS = 120;

export function validateDateOfBirth(dateOfBirth: string): string | null {
  // A real yyyy-MM-dd date: new Date() would roll 2000-02-30 over to March.
  if (!isValidIsoDate(dateOfBirth)) return "Enter a valid date of birth.";
  const parsed = new Date(dateOfBirth);
  const now = new Date();
  if (parsed > now) return "Date of birth can't be in the future.";
  const minDate = new Date(now.getFullYear() - MAX_AGE_YEARS, now.getMonth(), now.getDate());
  if (parsed < minDate) return "Enter a valid date of birth.";
  const youngest = new Date(now.getFullYear() - MIN_AGE_YEARS, now.getMonth(), now.getDate());
  if (parsed > youngest) return `You need to be ${MIN_AGE_YEARS} or older to use Gym Journal.`;
  return null;
}

// Gender is asked explicitly; "prefer not to say" is an answer, not a blank.
export const GENDERS = ["male", "female", "other", "prefer_not_to_say"] as const;
export type Gender = (typeof GENDERS)[number];

export const GENDER_LABELS: Record<string, string> = {
  male: "Male",
  female: "Female",
  other: "Other",
  prefer_not_to_say: "Prefer not to say",
};

export function validateGender(value: string): string | null {
  return (GENDERS as readonly string[]).includes(value) ? null : "Select a gender option.";
}

export const MIN_PASSWORD_LENGTH = 8;

export function validatePassword(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  return null;
}

export const PRIMARY_GOALS = ["build_muscle", "lose_fat", "maintain", "general_fitness"] as const;
export type PrimaryGoal = (typeof PRIMARY_GOALS)[number];

export const EXPERIENCE_LEVELS = ["beginner", "intermediate", "advanced"] as const;
export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];

export function validatePrimaryGoal(value: string): string | null {
  if (!PRIMARY_GOALS.includes(value as PrimaryGoal)) return "Select a valid goal.";
  return null;
}

export function validateExperienceLevel(value: string): string | null {
  if (!EXPERIENCE_LEVELS.includes(value as ExperienceLevel)) return "Select a valid experience level.";
  return null;
}

// Where the person usually trains (migration 0041); decides what quick workouts can suggest.
export const TRAINING_LOCATIONS = ["gym", "home_dumbbells", "bodyweight"] as const;
export type TrainingLocation = (typeof TRAINING_LOCATIONS)[number];

export const TRAINING_LOCATION_LABELS: Record<TrainingLocation, string> = {
  gym: "At a gym",
  home_dumbbells: "At home with dumbbells",
  bodyweight: "Anywhere, no equipment",
};

export function validateTrainingLocation(value: string): string | null {
  if (!TRAINING_LOCATIONS.includes(value as TrainingLocation)) return "Select where you usually train.";
  return null;
}

export function validateTrainingDaysPerWeek(value: number): string | null {
  if (!Number.isInteger(value) || value < 1 || value > 7) {
    return "Training days per week must be between 1 and 7.";
  }
  return null;
}

// Loose sanity bounds, matching the style used for date of birth — just enough to catch typos.
export function validateTargetWeightKg(value: number): string | null {
  if (!Number.isFinite(value) || value <= 0 || value > 500) {
    return "Enter a valid target weight.";
  }
  return null;
}

export const MAX_EXERCISE_NAME_LENGTH = 100;

export function validateExerciseName(name: string): string | null {
  if (typeof name !== "string" || !name.trim()) return "Enter an exercise name.";
  if (name.trim().length > MAX_EXERCISE_NAME_LENGTH) {
    return `Exercise name must be ${MAX_EXERCISE_NAME_LENGTH} characters or fewer.`;
  }
  return null;
}

export const MAX_TEMPLATE_NAME_LENGTH = 100;

export function validateTemplateName(name: string): string | null {
  if (typeof name !== "string" || !name.trim()) return "Enter a template name.";
  if (name.trim().length > MAX_TEMPLATE_NAME_LENGTH) {
    return `Template name must be ${MAX_TEMPLATE_NAME_LENGTH} characters or fewer.`;
  }
  return null;
}

// Targets are optional (see validation callsite), but when a value is supplied it must be a
// sane positive number — loose bounds, just enough to catch typos.
export function validateTargetSets(value: number): string | null {
  if (!Number.isInteger(value) || value < 1 || value > 50) {
    return "Enter a valid number of sets.";
  }
  return null;
}

export function validateTargetReps(value: number): string | null {
  if (!Number.isInteger(value) || value < 1 || value > 200) {
    return "Enter a valid number of reps.";
  }
  return null;
}

// Profile height, same loose-sanity-bounds style: just enough to catch typos like 5000 cm or -5.
export function validateHeightCm(value: number): string | null {
  if (!Number.isFinite(value) || value < 50 || value > 275) {
    return "Enter a height between 50 and 275 cm.";
  }
  return null;
}

// Same loose-sanity-bounds style as validateTargetWeightKg — just enough to catch typos/garbage,
// not a precise medical bound.
export function validateWeightKg(value: number): string | null {
  if (!Number.isFinite(value) || value <= 0 || value > 500) {
    return "Enter a valid weight.";
  }
  return null;
}

// Shared by every place a weight is recorded against a unit (logged sets, planned/template
// exercise targets) — one definition, so "kg" and "lb" can't drift apart between them.
export const WEIGHT_UNITS = new Set(["kg", "lb"]);

// A planned/template exercise's target weight. Unlike validateWeightKg (a body measurement, which
// can never sensibly be 0), 0 is valid here — a bodyweight exercise's target is legitimately "no
// added weight" — matching the >= 0 bound logged_sets already uses (0009_add_logged_set_constraints.sql).
export function validateTargetWeight(value: number): string | null {
  if (!Number.isFinite(value) || value < 0 || value > 500) {
    return "Enter a valid target weight.";
  }
  return null;
}

// Body measurements are historical/current only — a future date isn't a meaningful entry.
// Compared as plain yyyy-MM-dd strings against `todayStr` — the person's own today (`getToday()`),
// the same one Calendar, Home and the logger use. A UTC-derived date could disagree with it near
// midnight and wrongly reject the current day's own date.
export function validateMeasurementDate(date: string, todayStr: string): string | null {
  if (!isValidIsoDate(date)) return "Enter a valid date.";
  if (date > todayStr) return "Date can't be in the future.";
  return null;
}

export const MAX_MEASUREMENT_NOTE_LENGTH = 500;

export function validateMeasurementNote(notes: string): string | null {
  if (notes.length > MAX_MEASUREMENT_NOTE_LENGTH) {
    return `Note must be ${MAX_MEASUREMENT_NOTE_LENGTH} characters or fewer.`;
  }
  return null;
}
