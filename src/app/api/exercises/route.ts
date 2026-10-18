import { decodeCursor, exerciseListQuerySchema, type ExercisePage } from "@/lib/exerciseLibrary";
import { browseExercises } from "@/lib/exerciseQueries";
import { jsonError, jsonResponse, queryObject, signedInClient } from "@/lib/api";

// GET /api/exercises?muscleGroup=&q=&equipment=&cursor=
// One page of exercises (EXERCISE_PAGE_SIZE) in name order, optionally within one muscle group and
// filtered by search term and equipment. Pass `nextCursor` back as `cursor` for the next page.
export async function GET(request: Request): Promise<Response> {
  const session = await signedInClient();
  if (!session) return jsonError(401, "Not signed in");

  const query = exerciseListQuerySchema.safeParse(queryObject(request));
  if (!query.success) return jsonError(400, "Invalid query");

  const after = query.data.cursor ? decodeCursor(query.data.cursor) : null;
  if (query.data.cursor && !after) return jsonError(400, "Invalid cursor");

  const page = await browseExercises(session.supabase, session.userId, {
    muscleGroupId: query.data.muscleGroup,
    term: query.data.q,
    equipment: query.data.equipment,
    after,
  });
  if (!page) return jsonError(500, "Couldn't load exercises");
  return jsonResponse(page satisfies ExercisePage);
}
