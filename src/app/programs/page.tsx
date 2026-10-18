import { PROGRAMS } from "@/lib/programs";
import { getToday } from "@/lib/userDate";
import ProgramPicker from "./ProgramPicker";
import BackLink from "@/components/BackLink";

export default async function ProgramsPage() {
  const today = await getToday();
  return (
    <main className="screen-enter px-4 pt-4">
      <BackLink href="/calendar" label="Calendar" />
      <h1 className="mb-1 large-title">Programs</h1>
      <p className="mb-4 text-sm text-label-2">
        Pick a program and it&apos;s scheduled onto your calendar. Days you&apos;ve already planned are left as they are.
      </p>
      <ProgramPicker programs={PROGRAMS} today={today} />
    </main>
  );
}
