import { getExercises, getMuscleGroups } from "@/lib/queries";
import { createExercise, deleteExercise } from "./actions";
import { createClient } from "@/lib/supabase/server";

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

      <details className="mb-6 rounded-xl border border-neutral-800 p-4">
        <summary className="cursor-pointer text-sm font-medium text-neutral-100">+ Add custom exercise</summary>
        <form action={createExercise} className="mt-4 flex flex-col gap-3">
          <input
            name="name"
            required
            placeholder="Exercise name"
            className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-base text-neutral-100 placeholder-neutral-500"
          />
          <input
            name="equipment"
            placeholder="Equipment (optional)"
            className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-base text-neutral-100 placeholder-neutral-500"
          />
          <div>
            <p className="mb-2 text-xs font-medium text-neutral-400">Muscle groups</p>
            <div className="flex flex-wrap gap-2">
              {muscleGroups.map((mg) => (
                <label
                  key={mg.id}
                  className="flex items-center gap-1.5 rounded-full border border-neutral-700 px-3 py-1.5 text-sm text-neutral-100 has-checked:border-white has-checked:bg-white has-checked:text-neutral-900"
                >
                  <input
                    type="checkbox"
                    name="muscle_group_ids"
                    value={mg.id}
                    className="sr-only"
                  />
                  {mg.name}
                </label>
              ))}
            </div>
          </div>
          <button
            type="submit"
            className="rounded-lg bg-white px-4 py-2.5 font-medium text-neutral-900"
          >
            Add exercise
          </button>
        </form>
      </details>

      <div className="flex flex-col gap-6 pb-6">
        {[...grouped.entries()].map(([groupName, list]) => (
          <div key={groupName}>
            <h2 className="mb-2 text-sm font-semibold text-neutral-400">{groupName}</h2>
            <ul className="flex flex-col gap-2">
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
                  {ex.user_id === user?.id && (
                    <form
                      action={async () => {
                        "use server";
                        await deleteExercise(ex.id);
                      }}
                    >
                      <button className="text-xs text-red-400">Delete</button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </main>
  );
}
