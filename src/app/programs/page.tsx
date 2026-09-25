import Link from "next/link";
import { PROGRAMS } from "@/lib/programs";
import { getToday } from "@/lib/userDate";
import ProgramPicker from "./ProgramPicker";

export default async function ProgramsPage() {
  const today = await getToday();
  return (
    <main className="px-4 pt-6">
      <Link href="/calendar" className="mb-1 inline-block text-sm text-neutral-500">
        ← Calendar
      </Link>
      <h1 className="mb-1 text-xl font-bold">Programs</h1>
      <p className="mb-4 text-sm text-neutral-400">
        Pick a program and it&apos;s scheduled onto your calendar. Days you&apos;ve already planned are left as they are.
      </p>
      <ProgramPicker programs={PROGRAMS} today={today} />
    </main>
  );
}
