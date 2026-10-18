import { notFound } from "next/navigation";
import { getExercises, getMuscleGroups, getPlanForDate, getTemplates } from "@/lib/queries";
import { formatDate, isValidIsoDate } from "@/lib/date";
import PageHeader from "@/components/PageHeader";
import ScheduleForm from "./ScheduleForm";

export default async function SchedulePage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  if (!isValidIsoDate(date)) notFound();
  const [muscleGroups, exercises, plan, templates] = await Promise.all([
    getMuscleGroups(),
    getExercises(),
    getPlanForDate(date),
    getTemplates(),
  ]);

  return (
    <main className="px-4 pt-6 md:px-8 md:pt-10">
      <PageHeader
        title={`Plan ${formatDate(date)}`}
        subtitle={plan ? "Edit what you plan to do this day." : "Decide what you'll do this day."}
        back={{ href: "/calendar", label: "Calendar" }}
      />
      <ScheduleForm
        date={date}
        muscleGroups={muscleGroups}
        exercises={exercises}
        existingPlan={plan}
        templates={templates}
      />
    </main>
  );
}
