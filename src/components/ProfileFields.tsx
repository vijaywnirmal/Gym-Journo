"use client";

import { useId, useState, type ReactNode } from "react";
import type { ProfileFieldsValue } from "@/lib/profile-fields";
import {
  GENDER_LABELS,
  GENDERS,
  MIN_PASSWORD_LENGTH,
  MAX_AGE_YEARS,
  MIN_AGE_YEARS,
  TRAINING_LOCATION_LABELS,
  TRAINING_LOCATIONS,
} from "@/lib/validation";
import Select, { type SelectOption } from "@/components/ui/Select";
import DateField from "@/components/ui/DateField";
import { DATE_FMT } from "@/lib/date";
import { format, subYears } from "date-fns";

const PRIMARY_GOAL_OPTIONS = [
  { value: "build_muscle", label: "Build muscle" },
  { value: "lose_fat", label: "Lose fat" },
  { value: "maintain", label: "Maintain" },
  { value: "general_fitness", label: "General fitness" },
];

export const GENDER_OPTIONS = GENDERS.map((g) => ({ value: g, label: GENDER_LABELS[g] }));

const TARGET_WEIGHT_GOALS = new Set(["build_muscle", "lose_fat"]);

const EXPERIENCE_LEVEL_OPTIONS = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
];

const TRAINING_LOCATION_OPTIONS = TRAINING_LOCATIONS.map((l) => ({ value: l, label: TRAINING_LOCATION_LABELS[l] }));

export type { ProfileFieldsValue };

// One height and one look for every control, so text inputs, dropdowns and the date field line up.
const controlClass = "field h-11 w-full rounded-[10px] px-3.5 text-base";
const labelClass = "mb-1.5 block text-sm font-medium";
const hintClass = "mt-1.5 text-xs text-label-2";

// The label wraps its control, so clicking the label focuses the field and screen readers announce it.
function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      {children}
      {hint && <span className={`${hintClass} block`}>{hint}</span>}
    </label>
  );
}

function FieldSelect({
  value,
  onChange,
  options,
  placeholder,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder: string;
  label: string;
}) {
  return (
    <Select
      value={value}
      onChange={onChange}
      options={options}
      placeholder={placeholder}
      ariaLabel={label}
      size="lg"
      searchable={false}
      className="w-full"
    />
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="card p-4">
      <h2 className="mb-4 text-sm font-semibold">{title}</h2>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

export default function ProfileFields({
  value,
  onChange,
}: {
  value: ProfileFieldsValue;
  onChange: (value: ProfileFieldsValue) => void;
}) {
  function set<K extends keyof ProfileFieldsValue>(key: K, v: ProfileFieldsValue[K]) {
    onChange({ ...value, [key]: v });
  }

  function setPrimaryGoal(goal: string) {
    const clearTargetWeight = !TARGET_WEIGHT_GOALS.has(goal);
    onChange({
      ...value,
      primaryGoal: goal,
      targetWeightKg: clearTargetWeight ? "" : value.targetWeightKg,
    });
  }

  const showTargetWeight = TARGET_WEIGHT_GOALS.has(value.primaryGoal);

  return (
    <div className="flex flex-col gap-4">
      <Card title="About you">
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name">
            <input
              value={value.firstName}
              onChange={(e) => set("firstName", e.target.value)}
              placeholder="First name"
              autoComplete="given-name"
              className={controlClass}
            />
          </Field>
          <Field label="Last name">
            <input
              value={value.lastName}
              onChange={(e) => set("lastName", e.target.value)}
              placeholder="Last name"
              autoComplete="family-name"
              className={controlClass}
            />
          </Field>
        </div>

        <Field label="Date of birth" hint="Used to work out your age for AI plans.">
          <DateField
            value={value.dateOfBirth}
            onChange={(v) => set("dateOfBirth", v)}
            min={format(subYears(new Date(), MAX_AGE_YEARS), DATE_FMT)}
            max={format(subYears(new Date(), MIN_AGE_YEARS), DATE_FMT)}
            clearable
            placeholder="Select your birthday"
            ariaLabel="Date of birth"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Height (cm)">
            <input
              type="number"
              inputMode="decimal"
              min={0}
              value={value.heightCm}
              onChange={(e) => set("heightCm", e.target.value)}
              placeholder="175"
              className={controlClass}
            />
          </Field>
          <Field label="Weight (kg)">
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step="0.1"
              value={value.weightKg}
              onChange={(e) => set("weightKg", e.target.value)}
              placeholder="70"
              className={controlClass}
            />
          </Field>
        </div>

        <Field label="Gender">
          <FieldSelect
            label="Gender"
            value={value.gender}
            onChange={(v) => set("gender", v)}
            placeholder="Select gender"
            options={GENDER_OPTIONS}
          />
        </Field>
      </Card>

      <Card title="Your goal">
        <Field label="Primary goal">
          <FieldSelect
            label="Primary goal"
            value={value.primaryGoal}
            onChange={setPrimaryGoal}
            placeholder="Select a goal"
            options={PRIMARY_GOAL_OPTIONS}
          />
        </Field>

        <Field label="Experience level">
          <FieldSelect
            label="Experience level"
            value={value.experienceLevel}
            onChange={(v) => set("experienceLevel", v)}
            placeholder="Select your experience level"
            options={EXPERIENCE_LEVEL_OPTIONS}
          />
        </Field>

        <Field label="Training days per week" hint="How many days you usually want to train.">
          <FieldSelect
            label="Training days per week"
            value={value.trainingDaysPerWeek}
            onChange={(v) => set("trainingDaysPerWeek", v)}
            placeholder="Select days per week"
            options={[1, 2, 3, 4, 5, 6, 7].map((n) => ({ value: String(n), label: `${n} day${n === 1 ? "" : "s"}` }))}
          />
        </Field>

        <Field label="Where you usually train (optional)" hint="Quick workouts only suggest what you can do there.">
          <FieldSelect
            label="Where you usually train"
            value={value.trainingLocation}
            onChange={(v) => set("trainingLocation", v)}
            placeholder="Select where you train"
            options={TRAINING_LOCATION_OPTIONS}
          />
        </Field>

        {showTargetWeight && (
          <Field label="Target weight (kg, optional)">
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step="0.1"
              value={value.targetWeightKg}
              onChange={(e) => set("targetWeightKg", e.target.value)}
              placeholder="65"
              className={controlClass}
            />
          </Field>
        )}
      </Card>
    </div>
  );
}

export function PasswordFields({
  password,
  confirmPassword,
  onPasswordChange,
  onConfirmPasswordChange,
  required,
}: {
  password: string;
  confirmPassword: string;
  onPasswordChange: (v: string) => void;
  onConfirmPasswordChange: (v: string) => void;
  required?: boolean;
}) {
  const [show, setShow] = useState(false);
  const passwordId = useId();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label htmlFor={passwordId} className={labelClass}>
          {required ? "Set a password" : "New password (optional)"}
        </label>
        <div className="flex gap-2">
          <input
            id={passwordId}
            type={show ? "text" : "password"}
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
            placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
            autoComplete="new-password"
            className={`${controlClass} flex-1`}
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="h-11 rounded-[10px] border border-separator px-4 text-sm font-semibold hover:bg-fill"
          >
            {show ? "Hide" : "Show"}
          </button>
        </div>
      </div>
      <Field label="Confirm password">
        <input
          type={show ? "text" : "password"}
          value={confirmPassword}
          onChange={(e) => onConfirmPasswordChange(e.target.value)}
          placeholder="Re-enter password"
          autoComplete="new-password"
          className={controlClass}
        />
      </Field>
    </div>
  );
}
