import { getExercises, getMuscleGroups } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import ExerciseCreateForm from "./ExerciseCreateForm";
import DeleteExerciseButton from "./DeleteExerciseButton";

export default async function ExercisesPage() {
  const [exercises, muscleGroups] = await Promise.all([getExercises(), getMuscleGroups()]);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const grouped = new Map<string, typeof exercises>();
  for (const ex of exercises) {
    const key = ex.muscle_groups?.[0]?.name ?? "Other";
    grouped.set(key, [...(grouped.get(key) ?? []), ex]);
  }

  return (
    <main className="px-4 pt-6">
      <h1 className="mb-4 text-xl font-bold">Exercise Library</h1>

      <ExerciseCreateForm muscleGroups={muscleGroups} />

      <div className="flex flex-col gap-3 pb-6">
        {[...grouped.entries()].map(([groupName, list]) => (
          <details key={groupName} className="rounded-xl border border-neutral-800">
            <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-neutral-200">
              {groupName} ({list.length})
            </summary>
            <ul className="flex flex-col gap-2 px-4 pb-4">
              {list.map((ex) => (
                <li
                  key={ex.id}
                  className="flex items-center justify-between rounded-xl border border-neutral-800 px-4 py-3"
                >
                  <div>
                    <p className="font-medium text-neutral-100">{ex.name}</p>
                    <p className="text-xs text-neutral-400">
                      {ex.equipment ?? "—"}
                      {ex.muscle_groups && ex.muscle_groups.length > 1
                        ? ` · ${ex.muscle_groups.map((m) => m.name).join(", ")}`
                        : ""}
                    </p>
                  </div>
                  {ex.user_id === user?.id && <DeleteExerciseButton exerciseId={ex.id} />}
                </li>
              ))}
            </ul>
          </details>
        ))}
      </div>
    </main>
  );
}
