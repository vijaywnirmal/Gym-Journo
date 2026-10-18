import { PROGRAMS } from "@/lib/programs";
import { getToday } from "@/lib/userDate";
import PageHeader from "@/components/PageHeader";
import ProgramPicker from "./ProgramPicker";

export default async function ProgramsPage() {
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
