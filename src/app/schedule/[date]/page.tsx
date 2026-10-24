import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getMuscleGroups, getPlanForDate, getTemplates } from "@/lib/queries";
import { getCurrentUser } from "@/lib/currentUser";
import { planAuthorNote } from "@/lib/planAuthors";
import { getKnownTrainer } from "@/lib/trainers";
import { formatDate, isValidIsoDate } from "@/lib/date";
import PageHeader from "@/components/PageHeader";
import { requireMemberApp } from "@/lib/workAccount";
import ScheduleForm from "./ScheduleForm";

// The day in the title, so each day's page is announced on its own.
export async function generateMetadata({ params }: { params: Promise<{ date: string }> }): Promise<Metadata> {
  const { date } = await params;
  return { title: isValidIsoDate(date) ? `Plan · ${formatDate(date)}` : "Plan" };
}

export default async function SchedulePage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  await requireMemberApp();
  const { date } = await params;
  if (!isValidIsoDate(date)) notFound();
  const [muscleGroups, plan, templates, me, trainer] = await Promise.all([
    getMuscleGroups(),
    getPlanForDate(date),
    getTemplates(),
    getCurrentUser(),
    getKnownTrainer(),
  ]);
  const authorNote = plan && me ? planAuthorNote(plan, me.id, trainer) : null;

  return (
    <main className="px-4 pt-6 md:px-8 md:pt-10">
      <PageHeader
        title={`Plan ${formatDate(date)}`}
        subtitle={plan ? "Edit what you plan to do this day." : "Decide what you'll do this day."}
        back={{ href: "/calendar", label: "Calendar" }}
      />
      {authorNote && <p className="mb-4 rounded-[10px] bg-fill px-3 py-2.5 text-sm text-label-2">{authorNote}</p>}
      <ScheduleForm
        date={date}
        muscleGroups={muscleGroups}
        existingPlan={plan}
        templates={templates}
      />
    </main>
  );
}
