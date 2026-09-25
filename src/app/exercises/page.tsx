import { getExercises, getMuscleGroups } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import ExerciseCreateForm from "./ExerciseCreateForm";
import ExerciseBrowser from "./ExerciseBrowser";

export default async function ExercisesPage() {
  const [exercises, muscleGroups] = await Promise.all([getExercises(), getMuscleGroups()]);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="px-4 pt-6">
      <h1 className="mb-4 text-xl font-bold">Exercise Library</h1>

      <ExerciseCreateForm muscleGroups={muscleGroups} />

      <ExerciseBrowser exercises={exercises} muscleGroups={muscleGroups} userId={user?.id ?? null} />
    </main>
  );
}
