import type { createClient } from "@/lib/supabase/server";
import { searchWords } from "@/lib/exerciseSearch";
import {
  EXERCISE_PAGE_SIZE,
  encodeCursor,
  instructionSteps,
  type ExerciseCursor,
  type ExercisePage,
  type ExerciseTutorial,
  type MuscleGroupCount,
} from "@/lib/exerciseLibrary";

// Server-side reads behind the exercise library API. Each takes the request's Supabase client, so
// row-level security scopes results to the signed-in person, and returns null on a query error.

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

type BrowseRow = { id: string; name: string; equipment: string | null; user_id: string | null; has_tutorial: boolean };
type GroupCountRow = { muscle_group_id: string; name: string; exercise_count: number };
type TutorialRow = {
  id: string;
  name: string;
  equipment: string | null;
  instructions: string | null;
  demo_images: string[] | null;
  exercise_muscle_groups: { muscle_group: { name: string } | null }[] | null;
};

function wordsOrNull(term: string | undefined): string[] | null {
  const words = searchWords(term ?? "");
  return words.length > 0 ? words : null;
}

// One page of exercises in name order. Asks for one extra row to know whether another page exists.
export async function browseExercises(
  supabase: SupabaseClient,
  viewerId: string,
  options: { muscleGroupId?: string; term?: string; equipment?: string; after?: ExerciseCursor | null }
): Promise<ExercisePage | null> {
  const { data, error } = await supabase.rpc("browse_exercises", {
    p_muscle_group_id: options.muscleGroupId ?? null,
    p_words: wordsOrNull(options.term),
    p_equipment: options.equipment ?? null,
    p_after_name: options.after?.name ?? null,
    p_after_id: options.after?.id ?? null,
    p_limit: EXERCISE_PAGE_SIZE + 1,
  });
  if (error || !data) return null;

  const rows = data as BrowseRow[];
  const pageRows = rows.slice(0, EXERCISE_PAGE_SIZE);
  const last = pageRows[pageRows.length - 1];
  return {
    items: pageRows.map((row) => ({
      id: row.id,
      name: row.name,
      equipment: row.equipment,
      isOwn: row.user_id === viewerId,
      hasTutorial: row.has_tutorial,
    })),
    nextCursor: rows.length > EXERCISE_PAGE_SIZE && last ? encodeCursor({ name: last.name, id: last.id }) : null,
  };
}

// Every muscle group with how many exercises in it match the filters.
export async function getExerciseGroupCounts(
  supabase: SupabaseClient,
  options: { term?: string; equipment?: string }
): Promise<MuscleGroupCount[] | null> {
  const { data, error } = await supabase.rpc("exercise_group_counts", {
    p_words: wordsOrNull(options.term),
    p_equipment: options.equipment ?? null,
  });
  if (error || !data) return null;
  return (data as GroupCountRow[]).map((row) => ({
    id: row.muscle_group_id,
    name: row.name,
    exerciseCount: row.exercise_count,
  }));
}

export type TutorialResult = { status: "found"; tutorial: ExerciseTutorial } | { status: "not_found" } | { status: "error" };

// Instructions, demo images and muscle groups for one exercise. "not_found" also covers another
// person's custom exercise, which row-level security hides.
export async function getExerciseTutorial(supabase: SupabaseClient, id: string): Promise<TutorialResult> {
  const { data, error } = await supabase
    .from("exercises")
    .select("id, name, equipment, instructions, demo_images, exercise_muscle_groups(muscle_group:muscle_groups(name))")
    .eq("id", id)
    .maybeSingle();
  if (error) return { status: "error" };
  if (!data) return { status: "not_found" };

  const row = data as unknown as TutorialRow;
  const tutorial: ExerciseTutorial = {
    id: row.id,
    name: row.name,
    equipment: row.equipment,
    muscleGroups: (row.exercise_muscle_groups ?? [])
      .map((emg) => emg.muscle_group?.name)
      .filter((name): name is string => !!name)
      .sort((a, b) => a.localeCompare(b)),
    steps: instructionSteps(row.instructions),
    demoImages: row.demo_images ?? [],
  };
  return { status: "found", tutorial };
}
