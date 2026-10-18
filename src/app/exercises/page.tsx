import { getExercises, getMuscleGroups } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import PageHeader from "@/components/PageHeader";
import ExerciseBrowser from "./ExerciseBrowser";

export default async function ExercisesPage() {
  const [exercises, muscleGroups] = await Promise.all([getExercises(), getMuscleGroups()]);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="px-4 pt-6 md:px-8 md:pt-10">
      <PageHeader title="Exercises" subtitle="The library you pick from when planning and logging." />
      <ExerciseBrowser exercises={exercises} muscleGroups={muscleGroups} userId={user?.id ?? null} />
    </main>
  );
}
