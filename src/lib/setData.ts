// Set type and effort (RPE) — shared by the logger, validation and Analyze. Mirrors the checks in
// supabase/migrations/0020_add_set_type_rpe_exercise_notes.sql.

export const SET_TYPES = ["working", "warmup", "drop", "failure"] as const;
export type SetType = (typeof SET_TYPES)[number];
export const DEFAULT_SET_TYPE: SetType = "working";

export const SET_TYPE_LABEL: Record<SetType, string> = {
  working: "Working",
  warmup: "Warm-up",
  drop: "Drop set",
  failure: "To failure",
};

// Short badge for the set row; working sets show their number instead.
export const SET_TYPE_BADGE: Record<SetType, string | null> = {
  working: null,
  warmup: "W",
  drop: "D",
  failure: "F",
};

export function isSetType(value: unknown): value is SetType {
  return typeof value === "string" && (SET_TYPES as readonly string[]).includes(value);
}

// Unknown or missing values (old rows, old clients) read as working sets.
export function toSetType(value: unknown): SetType {
  return isSetType(value) ? value : DEFAULT_SET_TYPE;
}

export function nextSetType(current: SetType): SetType {
  return SET_TYPES[(SET_TYPES.indexOf(current) + 1) % SET_TYPES.length];
}

// RPE 1–10 in half steps.
export const RPE_OPTIONS = Array.from({ length: 19 }, (_, i) => 1 + i * 0.5);

export function isValidRpe(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 1 && value <= 10 && Number.isInteger(value * 2);
}

export const MAX_EXERCISE_NOTE_LENGTH = 500;

// Warm-ups are performed (History shows them) but never count toward progress, volume or records.
export function countsTowardProgress(set: { setType?: string | null }): boolean {
  return toSetType(set.setType) !== "warmup";
}

// Extra detail shown after a saved set: "Warm-up · RPE 8". Empty for a working set with no RPE.
export function formatSetDetail(setType: unknown, rpe: number | null | undefined): string {
  const type = toSetType(setType);
  const parts = [
    type === DEFAULT_SET_TYPE ? null : SET_TYPE_LABEL[type],
    rpe === null || rpe === undefined ? null : `RPE ${Number(rpe)}`,
  ].filter((p): p is string => p !== null);
  return parts.join(" · ");
}

// Compact form for one-line lists: "W 10×40kg @8".
export function formatSetCompact(set: {
  reps: number | null;
  weight: number | null;
  weight_unit: string;
  set_type?: string | null;
  rpe?: number | null;
}): string {
  const badge = SET_TYPE_BADGE[toSetType(set.set_type)];
  const rpe = set.rpe === null || set.rpe === undefined ? "" : ` @${Number(set.rpe)}`;
  return `${badge ? `${badge} ` : ""}${set.reps ?? "?"}×${set.weight ?? "?"}${set.weight_unit}${rpe}`;
}
