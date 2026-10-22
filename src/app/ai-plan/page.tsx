import type { Metadata } from "next";
import { getAiPlans, getNutritionForDate, getProfile } from "@/lib/queries";
import { getToday } from "@/lib/userDate";
import PageHeader from "@/components/PageHeader";
import AIPlanForm from "./AIPlanForm";

export const metadata: Metadata = { title: "AI plan" };

export default async function AIPlanPage() {
  const [profile, pastPlans, mealsToday] = await Promise.all([
    getProfile(),
    getAiPlans(),
    getNutritionForDate(await getToday()),
  ]);

  return (
    <main className="px-4 pt-6 md:px-8 md:pt-10">
      <PageHeader
        title="AI plan"
        subtitle="A diet and workout plan built from your profile, training history and schedule."
        back={{ href: "/", label: "Today" }}
      />
      <AIPlanForm
        hasProfile={!!(profile?.date_of_birth && profile?.height_cm && profile?.weight_kg)}
        pastPlans={pastPlans}
        initialMealsToday={mealsToday ?? ""}
      />
    </main>
  );
}
