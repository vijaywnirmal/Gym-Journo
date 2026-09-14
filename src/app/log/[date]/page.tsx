import Link from "next/link";
import { getExercises, getLogForDate, getPlanForDate } from "@/lib/queries";
import { formatDate } from "@/lib/date";
import LogForm from "./LogForm";

export default async function LogPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  const [exercises, plan, log] = await Promise.all([
    getExercises(),
    getPlanForDate(date),
    getLogForDate(date),
  ]);

  return (
    <main className="px-4 pt-6">
      <Link href="/calendar" className="mb-1 inline-block text-sm text-neutral-500">
        ← Calendar
      </Link>
      <h1 className="mb-1 text-xl font-bold">Log for {formatDate(date)}</h1>
      {plan?.title && <p className="mb-4 text-sm text-neutral-500">Scheduled: {plan.title}</p>}
      {!plan?.title && <div className="mb-4" />}
      <LogForm date={date} exercises={exercises} plan={plan} existingLog={log} />
    </main>
  );
}
