import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import { formatDate, isValidIsoDate } from "@/lib/date";
import { clientName, mondayOf, toWorkoutPlan } from "@/lib/clientStatus";
import { getMuscleGroups, getTemplates } from "@/lib/queries";
import { getClient, getClientPlans } from "@/lib/trainers";
import ScheduleForm from "@/app/schedule/[date]/ScheduleForm";
import { deleteClientPlan, saveClientPlan } from "../../actions";

export const metadata: Metadata = { title: "Plan for a client" };

export default async function ClientPlanPage({ params }: { params: Promise<{ id: string; date: string }> }) {
  const { id, date } = await params;
  if (!isValidIsoDate(date)) notFound();
  const client = await getClient(id);
  if (!client) notFound();
  const [muscleGroups, plans, templates] = await Promise.all([getMuscleGroups(), getClientPlans(id, date, date), getTemplates()]);
  const plan = plans[0] ? toWorkoutPlan(plans[0], id, muscleGroups) : null;
  const name = clientName(client);

  return (
    <main className="px-4 pt-6 md:px-8 md:pt-10">
      <PageHeader
        title={`Plan ${formatDate(date)}`}
        subtitle={`For ${name}`}
        back={{ href: `/trainer/clients/${id}?week=${mondayOf(date)}`, label: name }}
      />
      <ScheduleForm
        // Keyed by day so moving between days starts from that day's plan.
        key={date}
        date={date}
        muscleGroups={muscleGroups}
        existingPlan={plan}
        templates={templates}
        saveAction={saveClientPlan.bind(null, id)}
        deleteAction={deleteClientPlan.bind(null, id)}
        manageTemplates={false}
      />
    </main>
  );
}
