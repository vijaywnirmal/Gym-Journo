import { getExercises, getMuscleGroups, getPlanForDate, getTemplates } from "@/lib/queries";
import { formatDate } from "@/lib/date";
import ScheduleForm from "./ScheduleForm";
import BackLink from "@/components/BackLink";

export default async function SchedulePage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  const [muscleGroups, exercises, plan, templates] = await Promise.all([
    getMuscleGroups(),
    getExercises(),
    getPlanForDate(date),
    getTemplates(),
  ]);

  return (
    <main className="screen-enter px-4 pt-4">
      <BackLink href="/calendar" label="Calendar" />
      <h1 className="mb-4 large-title">Schedule for {formatDate(date)}</h1>
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
