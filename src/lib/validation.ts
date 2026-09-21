
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
export function validateDateOfBirth(dateOfBirth: string): string | null {
  const parsed = new Date(dateOfBirth);
  if (Number.isNaN(parsed.getTime())) return "Enter a valid date of birth.";
  const now = new Date();
  if (parsed > now) return "Date of birth can't be in the future.";
  const minDate = new Date(now.getFullYear() - 120, now.getMonth(), now.getDate());
  if (parsed < minDate) return "Enter a valid date of birth.";
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

// Same loose-sanity-bounds style as validateTargetWeightKg — just enough to catch typos/garbage,
// not a precise medical bound.
export function validateWeightKg(value: number): string | null {
  if (!Number.isFinite(value) || value <= 0 || value > 500) {
    return "Enter a valid weight.";
  }
  return null;
}

// Body measurements are historical/current only — a future date isn't a meaningful entry.
// Compared as plain yyyy-MM-dd strings against `todayStr` — the person's own today (`getToday()`),
// the same one Calendar, Home and the logger use. A UTC-derived date could disagree with it near
// midnight and wrongly reject the current day's own date.
export function validateMeasurementDate(date: string, todayStr: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(new Date(date).getTime())) {
    return "Enter a valid date.";
  }
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
