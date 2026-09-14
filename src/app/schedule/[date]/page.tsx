import Link from "next/link";
import { getExercises, getMuscleGroups, getPlanForDate } from "@/lib/queries";
import { formatDate } from "@/lib/date";
import ScheduleForm from "./ScheduleForm";

export default async function SchedulePage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  const [muscleGroups, exercises, plan] = await Promise.all([
    getMuscleGroups(),
    getExercises(),
    getPlanForDate(date),
  ]);

  return (
    <main className="px-4 pt-6">
      <Link href="/calendar" className="mb-1 inline-block text-sm text-neutral-500">
        ← Calendar
      </Link>
      <h1 className="mb-4 text-xl font-bold">Schedule for {formatDate(date)}</h1>
      <ScheduleForm date={date} muscleGroups={muscleGroups} exercises={exercises} existingPlan={plan} />
    </main>
  );
}
