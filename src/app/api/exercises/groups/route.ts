import { exerciseGroupsQuerySchema, type MuscleGroupCount } from "@/lib/exerciseLibrary";
import { getExerciseGroupCounts } from "@/lib/exerciseQueries";
import { jsonError, jsonResponse, queryObject, signedInClient } from "@/lib/api";

// GET /api/exercises/groups?q=&equipment=
// Every muscle group with how many exercises in it match the filters.
export async function GET(request: Request): Promise<Response> {
  const session = await signedInClient();
  if (!session) return jsonError(401, "Not signed in");

  const query = exerciseGroupsQuerySchema.safeParse(queryObject(request));
  if (!query.success) return jsonError(400, "Invalid query");

  const groups = await getExerciseGroupCounts(session.supabase, { term: query.data.q, equipment: query.data.equipment });
  if (!groups) return jsonError(500, "Couldn't load muscle groups");
  return jsonResponse(groups satisfies MuscleGroupCount[]);
}
