"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AiPlan } from "@/lib/queries";
import PlanMarkdown from "@/components/PlanMarkdown";
import { formatDateTime } from "@/lib/date";
import { generatePlan } from "./actions";

export default function AIPlanForm({
  hasProfile,
  pastPlans,
  initialMealsToday,
}: {
  hasProfile: boolean;
  pastPlans: AiPlan[];
  initialMealsToday: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [activityLevel, setActivityLevel] = useState("");
  const [dietaryPreference, setDietaryPreference] = useState("");
  const [notes, setNotes] = useState("");
  const [mealsToday, setMealsToday] = useState(initialMealsToday);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(pastPlans[0]?.plan_markdown ?? null);

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const res = await generatePlan({ activityLevel, dietaryPreference, notes, mealsToday });
      if (res.error) {
        setError(res.error);
        return;
      }
      setResult(res.planMarkdown ?? null);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6 pb-6">
      {!hasProfile && (
        <div className="rounded-xl border border-amber-900 bg-amber-950 p-4 text-sm text-amber-300">
          Fill in your profile (age, height, weight, goal) first for a more accurate plan.
        </div>
      )}

      <div className="flex flex-col gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-400">Activity level</label>
          <select
            value={activityLevel}
            onChange={(e) => setActivityLevel(e.target.value)}
            className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-base text-neutral-100"
          >
            <option value="">Select...</option>
            <option value="Sedentary">Sedentary (little to no exercise)</option>
            <option value="Lightly active">Lightly active (1-3 days/week)</option>
            <option value="Moderately active">Moderately active (3-5 days/week)</option>
            <option value="Very active">Very active (6-7 days/week)</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-400">Dietary preference</label>
          <select
            value={dietaryPreference}
            onChange={(e) => setDietaryPreference(e.target.value)}
            className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-base text-neutral-100"
          >
            <option value="">No restrictions</option>
            <option value="Vegetarian">Vegetarian</option>
            <option value="Vegan">Vegan</option>
            <option value="Eggetarian">Eggetarian</option>
            <option value="Non-vegetarian">Non-vegetarian</option>
            <option value="Keto">Keto</option>
            <option value="Gluten-free">Gluten-free</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-400">
            What have you eaten today?
          </label>
          <textarea
            value={mealsToday}
            onChange={(e) => setMealsToday(e.target.value)}
            rows={3}
            placeholder="e.g. oats + banana for breakfast, dal and rice for lunch"
            className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-base text-neutral-100 placeholder-neutral-500"
          />
          <p className="mt-1 text-xs text-neutral-500">
            The AI will estimate calories/macros and factor this into your plan.
          </p>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-400">
            Additional notes (injuries, equipment, preferences...)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="e.g. bad knee, only dumbbells at home"
            className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-base text-neutral-100 placeholder-neutral-500"
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={pending}
        className="rounded-xl bg-white px-4 py-3 font-medium text-neutral-900 disabled:opacity-50"
      >
        {pending ? "Generating..." : "✨ Generate my plan"}
      </button>
      <p className="-mt-4 text-center text-xs text-neutral-500">Up to 3 plans per day</p>

      {result && (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
          <p className="mb-3 text-xs font-medium text-neutral-500">Latest plan</p>
          <PlanMarkdown markdown={result} />
        </div>
      )}

      {pastPlans.length > 1 && (
        <div>
          <p className="mb-2 text-sm font-semibold text-neutral-100">Past plans</p>
          <div className="flex flex-col gap-2">
            {pastPlans.slice(1).map((plan) => (
              <details key={plan.id} className="rounded-xl border border-neutral-800 p-3">
                <summary className="cursor-pointer text-sm text-neutral-300">
                  {formatDateTime(plan.created_at)}
                </summary>
                <div className="mt-3">
                  <PlanMarkdown markdown={plan.plan_markdown} />
                </div>
              </details>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
