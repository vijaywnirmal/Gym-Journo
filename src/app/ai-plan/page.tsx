import { getAiPlans, getNutritionForDate, getProfile } from "@/lib/queries";
import { today } from "@/lib/date";
import AIPlanForm from "./AIPlanForm";

export default async function AIPlanPage() {
  const [profile, pastPlans, mealsToday] = await Promise.all([
    getProfile(),
    getAiPlans(),
    getNutritionForDate(today()),
  ]);

  return (
    <main className="px-4 pt-6">
      <h1 className="mb-1 text-xl font-bold text-neutral-100">✨ AI Plan</h1>
      <p className="mb-6 text-sm text-neutral-400">
        Get a personalized diet and workout plan based on your profile, training history, and
        schedule.
      </p>
      <AIPlanForm
        hasProfile={!!(profile?.date_of_birth && profile?.height_cm && profile?.weight_kg)}
        pastPlans={pastPlans}
        initialMealsToday={mealsToday ?? ""}
      />
    </main>
  );
}
