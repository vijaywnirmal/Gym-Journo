"use client";

import { useId, useState, type ReactNode } from "react";
import type { ProfileFieldsValue } from "@/lib/profile-fields";
import { GENDER_LABELS, GENDERS, MIN_PASSWORD_LENGTH } from "@/lib/validation";

const PRIMARY_GOAL_OPTIONS = [
  { value: "build_muscle", label: "Build muscle" },
  { value: "lose_fat", label: "Lose fat" },
  { value: "maintain", label: "Maintain" },
  { value: "general_fitness", label: "General fitness" },
];

const TARGET_WEIGHT_GOALS = new Set(["build_muscle", "lose_fat"]);

const EXPERIENCE_LEVEL_OPTIONS = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
];

export type { ProfileFieldsValue };

// One height and one look for every control, so text inputs, dropdowns and the date field line up.
// `color-scheme: dark` makes the browser's own date picker and dropdown list dark too.
const controlClass =
  "h-12 w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 text-base text-neutral-100 placeholder-neutral-500 [color-scheme:dark] focus:border-neutral-400 focus:outline-none";
const labelClass = "mb-1.5 block text-xs font-medium text-neutral-300";
const hintClass = "mt-1.5 text-xs text-neutral-500";

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

function Select({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${controlClass} appearance-none pr-10`}
      >
        {children}
      </select>
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m5 8 5 5 5-5" />
      </svg>
    </div>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
      <h2 className="mb-4 text-sm font-semibold text-neutral-100">{title}</h2>
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
          <input
            type="date"
            value={value.dateOfBirth}
            onChange={(e) => set("dateOfBirth", e.target.value)}
            className={controlClass}
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
          <Select value={value.gender} onChange={(v) => set("gender", v)}>
            <option value="">Select gender</option>
            {GENDERS.map((g) => (
              <option key={g} value={g}>
                {GENDER_LABELS[g]}
              </option>
            ))}
          </Select>
        </Field>
      </Card>

      <Card title="Your goal">
        <Field label="Primary goal">
          <Select value={value.primaryGoal} onChange={setPrimaryGoal}>
            <option value="">Select a goal</option>
            {PRIMARY_GOAL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Experience level">
          <Select value={value.experienceLevel} onChange={(v) => set("experienceLevel", v)}>
            <option value="">Select your experience level</option>
            {EXPERIENCE_LEVEL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Training days per week" hint="How many days you usually want to train.">
          <Select value={value.trainingDaysPerWeek} onChange={(v) => set("trainingDaysPerWeek", v)}>
            <option value="">Select days per week</option>
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Select>
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
            className="h-12 rounded-lg border border-neutral-700 px-4 text-sm text-neutral-300"
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
