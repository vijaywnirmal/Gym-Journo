import type { Metadata } from "next";
import { PROGRAMS } from "@/lib/programs";
import { getToday } from "@/lib/userDate";
import PageHeader from "@/components/PageHeader";
import { requireMemberApp } from "@/lib/workAccount";
import ProgramPicker from "./ProgramPicker";

export const metadata: Metadata = { title: "Programs" };

export default async function ProgramsPage() {
  await requireMemberApp();
  const today = await getToday();
  return (
    <main className="px-4 pt-6 md:px-8 md:pt-10">
      <PageHeader
        title="Programs"
        subtitle="Pick a program and it's added to your calendar. Days you've already planned stay as they are."
        back={{ href: "/calendar", label: "Calendar" }}
      />
      <ProgramPicker programs={PROGRAMS} today={today} />
    </main>
  );
}
