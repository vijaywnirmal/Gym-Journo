import { getMuscleGroups } from "@/lib/queries";
import ExerciseLibrary from "./ExerciseLibrary";

// The library itself loads page by page from /api/exercises (see ExerciseLibraryBrowser); only the
// muscle groups for the create form are read here.
export default async function ExercisesPage() {
  const muscleGroups = await getMuscleGroups();

  return (
    <main className="px-4 pt-6">
      <h1 className="mb-4 text-xl font-bold">Exercise Library</h1>
      <ExerciseLibrary muscleGroups={muscleGroups} />
    </main>
  );
}
