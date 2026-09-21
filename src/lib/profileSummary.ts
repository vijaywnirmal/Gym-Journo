import { formatDateLong } from "@/lib/date";
import type { ProfileFieldsValue } from "@/lib/profile-fields";
import { GENDER_LABELS } from "@/lib/validation";
import { joinName } from "@/lib/names";

// What the read-only profile card shows: label + value rows, with a missing value shown as "Not set"
// (never blank, never "null"). Pure so it can be tested without rendering.

export type SummaryRow = { label: string; value: string; set: boolean };
export type SummarySection = { title: string; rows: SummaryRow[] };

const GOAL_LABELS: Record<string, string> = {
  build_muscle: "Build muscle",
  lose_fat: "Lose fat",
  maintain: "Maintain",
  general_fitness: "General fitness",
};

const EXPERIENCE_LABELS: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

const NOT_SET = "Not set";

function row(label: string, value: string | null): SummaryRow {
  return value ? { label, value, set: true } : { label, value: NOT_SET, set: false };
}

// Numbers are shown as the person entered them, without trailing zeros ("71", "71.5").
function measure(value: string, unit: string): string | null {
  const n = parseFloat(value);
  return Number.isFinite(n) && n > 0 ? `${n} ${unit}` : null;
}

export function displayNameOf(fields: Pick<ProfileFieldsValue, "firstName" | "lastName">): string {
  return joinName(fields.firstName, fields.lastName);
}

export function summarizeProfile(fields: ProfileFieldsValue): SummarySection[] {
  const showTarget = fields.primaryGoal === "build_muscle" || fields.primaryGoal === "lose_fat";
  return [
    {
      title: "About you",
      rows: [
        row("Date of birth", fields.dateOfBirth ? formatDateLong(fields.dateOfBirth) : null),
        row("Gender", GENDER_LABELS[fields.gender] ?? null),
        row("Height", measure(fields.heightCm, "cm")),
        row("Weight", measure(fields.weightKg, "kg")),
      ],
    },
    {
      title: "Your goal",
      rows: [
        row("Primary goal", GOAL_LABELS[fields.primaryGoal] ?? null),
        row("Experience", EXPERIENCE_LABELS[fields.experienceLevel] ?? null),
        row(
          "Training days",
          fields.trainingDaysPerWeek ? `${fields.trainingDaysPerWeek} per week` : null
        ),
        ...(showTarget ? [row("Target weight", measure(fields.targetWeightKg, "kg"))] : []),
      ],
    },
  ];
}
