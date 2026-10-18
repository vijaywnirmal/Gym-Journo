import { getAiPlans, getNutritionForDate, getProfile } from "@/lib/queries";
import { getToday } from "@/lib/userDate";
import AIPlanForm from "./AIPlanForm";

export default async function AIPlanPage() {
  const [profile, pastPlans, mealsToday] = await Promise.all([
    getProfile(),
    getAiPlans(),
    getNutritionForDate(await getToday()),
  ]);

  return (
    <main className="screen-enter px-4 pt-4">
      <h1 className="mb-1 large-title">AI Plan</h1>
      <p className="mb-6 text-sm text-label-2">
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
