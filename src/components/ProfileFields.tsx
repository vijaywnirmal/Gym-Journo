"use client";

import { useState } from "react";
import type { ProfileFieldsValue } from "@/lib/profile-fields";
import { MIN_PASSWORD_LENGTH } from "@/lib/validation";

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

const inputClass =
  "rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-base text-neutral-100 placeholder-neutral-500";
const labelClass = "mb-1 block text-xs font-medium text-neutral-400";

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
    <div className="flex flex-col gap-3">
      <div>
        <label className={labelClass}>Name</label>
        <input
          value={value.fullName}
          onChange={(e) => set("fullName", e.target.value)}
          placeholder="Your name"
          className={`${inputClass} w-full`}
        />
      </div>

      <div>
        <label className={labelClass}>Date of birth</label>
        <input
          type="date"
          value={value.dateOfBirth}
          onChange={(e) => set("dateOfBirth", e.target.value)}
          className={`${inputClass} w-full`}
        />
      </div>

      <div className="flex gap-3">
        <div className="flex-1">
          <label className={labelClass}>Height (cm)</label>
          <input
            type="number"
            min={0}
            value={value.heightCm}
            onChange={(e) => set("heightCm", e.target.value)}
            placeholder="175"
            className={`${inputClass} w-full`}
          />
        </div>
        <div className="flex-1">
          <label className={labelClass}>Weight (kg)</label>
          <input
            type="number"
            min={0}
            step="0.1"
            value={value.weightKg}
            onChange={(e) => set("weightKg", e.target.value)}
            placeholder="70"
            className={`${inputClass} w-full`}
          />
        </div>
      </div>

      <div>
        <label className={labelClass}>Sex (optional)</label>
        <select
          value={value.sex}
          onChange={(e) => set("sex", e.target.value)}
          className={`${inputClass} w-full`}
        >
          <option value="">Prefer not to say</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
          <option value="other">Other</option>
        </select>
      </div>

      <div className="border-t border-neutral-800 pt-5">
        <h2 className="mb-3 text-sm font-semibold text-neutral-200">Your goal</h2>

        <div className="flex flex-col gap-3">
          <div>
            <label className={labelClass}>Primary goal</label>
            <select
              value={value.primaryGoal}
              onChange={(e) => setPrimaryGoal(e.target.value)}
              className={`${inputClass} w-full`}
            >
              <option value="">Select a goal</option>
              {PRIMARY_GOAL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Experience level</label>
            <select
              value={value.experienceLevel}
              onChange={(e) => set("experienceLevel", e.target.value)}
              className={`${inputClass} w-full`}
            >
              <option value="">Select your experience level</option>
              {EXPERIENCE_LEVEL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>How many days per week do you usually want to train?</label>
            <select
              value={value.trainingDaysPerWeek}
              onChange={(e) => set("trainingDaysPerWeek", e.target.value)}
              className={`${inputClass} w-full`}
            >
              <option value="">Select days per week</option>
              {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>

          {showTargetWeight && (
            <div>
              <label className={labelClass}>Target weight (kg, optional)</label>
              <input
                type="number"
                min={0}
                step="0.1"
                value={value.targetWeightKg}
                onChange={(e) => set("targetWeightKg", e.target.value)}
                placeholder="65"
                className={`${inputClass} w-full`}
              />
            </div>
          )}
        </div>
      </div>
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

  return (
    <div className="flex flex-col gap-3">
      <div>
        <label className={labelClass}>
          {required ? "Set a password" : "New password (optional)"}
        </label>
        <div className="flex gap-2">
          <input
            type={show ? "text" : "password"}
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
            placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
            className={`${inputClass} flex-1`}
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="rounded-lg border border-neutral-700 px-3 text-sm text-neutral-300"
          >
            {show ? "Hide" : "Show"}
          </button>
        </div>
      </div>
      <div>
        <label className={labelClass}>Confirm password</label>
        <input
          type={show ? "text" : "password"}
          value={confirmPassword}
          onChange={(e) => onConfirmPasswordChange(e.target.value)}
          placeholder="Re-enter password"
          className={`${inputClass} w-full`}
        />
      </div>
    </div>
  );
}
