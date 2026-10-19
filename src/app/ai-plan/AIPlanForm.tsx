"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AiPlan } from "@/lib/queries";
import PlanMarkdown from "@/components/PlanMarkdown";
import Disclosure from "@/components/ui/Disclosure";
import Select from "@/components/ui/Select";
import { formatDateTime } from "@/lib/date";
import { generatePlan } from "./actions";

const ACTIVITY_OPTIONS = [
  { value: "Sedentary", label: "Sedentary", hint: "Little to no exercise" },
  { value: "Lightly active", label: "Lightly active", hint: "1–3 days a week" },
  { value: "Moderately active", label: "Moderately active", hint: "3–5 days a week" },
  { value: "Very active", label: "Very active", hint: "6–7 days a week" },
];

const DIET_OPTIONS = [
  { value: "", label: "No restrictions" },
  ...["Vegetarian", "Vegan", "Eggetarian", "Non-vegetarian", "Keto", "Gluten-free"].map((d) => ({ value: d, label: d })),
];

const labelClass = "mb-1.5 block text-sm font-medium";
const textareaClass = "field w-full resize-none rounded-[10px] px-3.5 py-2.5 text-sm field-sizing-content";

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
  const [formOpen, setFormOpen] = useState(pastPlans.length === 0);

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const res = await generatePlan({ activityLevel, dietaryPreference, notes, mealsToday });
      if (res.error) {
        setError(res.error);
        return;
      }
      setResult(res.planMarkdown ?? null);
      setFormOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4 pb-6">
      {!hasProfile && (
        <div className="card flex items-center gap-3 border-orange/30 bg-orange/5 px-4 py-3 text-sm">
          <p className="flex-1">Add your age, height, weight and goal for a more accurate plan.</p>
          <Link href="/profile" className="shrink-0 font-semibold text-link">
            Profile
          </Link>
        </div>
      )}

      <Disclosure
        open={formOpen}
        onOpenChange={setFormOpen}
        className="card"
        summaryClassName="px-4 py-3"
        panelClassName="flex flex-col gap-4 px-4 pb-4"
        summary={
          <span>
            <span className="block text-sm font-semibold">{result ? "Make a new plan" : "Tell us about your day"}</span>
            <span className="block text-xs text-label-2">Up to 3 plans per day</span>
          </span>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <span className={labelClass}>Activity level</span>
            <Select
              value={activityLevel}
              onChange={setActivityLevel}
              options={ACTIVITY_OPTIONS}
              placeholder="Choose one"
              ariaLabel="Activity level"
              size="lg"
              className="w-full"
            />
          </div>
          <div>
            <span className={labelClass}>Diet</span>
            <Select
              value={dietaryPreference}
              onChange={setDietaryPreference}
              options={DIET_OPTIONS}
              ariaLabel="Dietary preference"
              size="lg"
              className="w-full"
            />
          </div>
        </div>

        <label className="block">
          <span className={labelClass}>What have you eaten today?</span>
          <textarea
            value={mealsToday}
            onChange={(e) => setMealsToday(e.target.value)}
            rows={2}
            placeholder="e.g. oats and banana for breakfast, dal and rice for lunch"
            className={textareaClass}
          />
          <span className="mt-1.5 block text-xs text-label-2">Used to estimate today&apos;s calories and macros.</span>
        </label>

        <label className="block">
          <span className={labelClass}>
            Anything else? <span className="font-normal text-label-3">(optional)</span>
          </span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Injuries, equipment, preferences — e.g. bad knee, only dumbbells at home"
            className={textareaClass}
          />
        </label>

        {error && <p className="text-sm text-red">{error}</p>}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={pending}
          className="h-11 rounded-[10px] bg-accent px-4 text-[15px] font-semibold text-on-accent hover:bg-accent-hover disabled:opacity-50"
        >
          {pending ? "Writing your plan…" : "Generate plan"}
        </button>
      </Disclosure>

      {pending && (
        <div className="card flex flex-col gap-2 p-5" aria-label="Generating plan">
          <div className="skeleton h-5 w-1/3" />
          <div className="skeleton h-4 w-full" />
          <div className="skeleton h-4 w-5/6" />
          <div className="skeleton h-4 w-2/3" />
        </div>
      )}

      {result && !pending && (
        <section className="card p-5">
          <p className="mb-3 text-xs font-semibold text-link">
            Your latest plan{pastPlans[0] ? ` · ${formatDateTime(pastPlans[0].created_at)}` : ""}
          </p>
          <PlanMarkdown markdown={result} />
        </section>
      )}

      {pastPlans.length > 1 && (
        <section>
          <h2 className="section-title mt-2">Earlier plans</h2>
          <div className="card divide-y divide-separator">
            {pastPlans.slice(1).map((plan) => (
              <Disclosure
                key={plan.id}
                summary={<span className="text-sm font-medium">{formatDateTime(plan.created_at)}</span>}
                summaryClassName="px-4 py-3"
                panelClassName="px-4 pb-4"
              >
                <PlanMarkdown markdown={plan.plan_markdown} />
              </Disclosure>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
