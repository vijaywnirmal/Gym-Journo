import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import { PROGRAMS } from "@/lib/programs";
import { clientName } from "@/lib/clientStatus";
import { getClient } from "@/lib/trainers";
import ProgramPicker from "@/app/programs/ProgramPicker";
import { applyClientProgram, undoClientProgram } from "../actions";

export const metadata: Metadata = { title: "Programs for a client" };

export default async function ClientProgramsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await getClient(id);
  if (!client) notFound();
  const name = clientName(client);
  const firstName = client.first_name || name;

  return (
    <main className="px-4 pt-6 md:px-8 md:pt-10">
      <PageHeader
        title="Programs"
        subtitle={`Pick a program and it's added to ${firstName}'s plan. Days already planned stay as they are.`}
        back={{ href: `/trainer/clients/${id}`, label: name }}
      />
      <ProgramPicker
        programs={PROGRAMS}
        today={client.client_today}
        target={{
          apply: applyClientProgram.bind(null, id),
          undo: undoClientProgram.bind(null, id),
          addLabel: `Add to ${firstName}'s plan`,
          seeLabel: `See ${firstName}'s week`,
          seeHrefPrefix: `/trainer/clients/${id}?week=`,
          removedFrom: `${firstName}'s plan`,
        }}
      />
    </main>
  );
}
