import type { Metadata } from "next";
import { getMuscleGroups } from "@/lib/queries";
import PageHeader from "@/components/PageHeader";
import ExerciseLibrary from "./ExerciseLibrary";

export const metadata: Metadata = { title: "Exercises" };

// The library itself loads page by page from /api/exercises (see ExerciseLibraryBrowser); only the
// muscle groups for the create form are read here.
export default async function ExercisesPage() {
  const muscleGroups = await getMuscleGroups();

  return (
    <main className="px-4 pt-6 md:px-8 md:pt-10">
      <PageHeader title="Exercises" subtitle="The library you pick from when planning and logging." />
      <ExerciseLibrary muscleGroups={muscleGroups} />
    </main>
  );
}
