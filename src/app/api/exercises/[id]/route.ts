import { exerciseIdSchema, type ExerciseTutorial } from "@/lib/exerciseLibrary";
import { getExerciseTutorial } from "@/lib/exerciseQueries";
import { jsonError, jsonResponse, signedInClient } from "@/lib/api";

// Library content rarely changes, so the browser may reuse a tutorial for an hour.
const TUTORIAL_CACHE_CONTROL = "private, max-age=3600";

// GET /api/exercises/:id
// An exercise's tutorial: its instruction steps, demo images and muscle groups. Loaded only when
// someone opens that exercise.
export async function GET(_request: Request, ctx: RouteContext<"/api/exercises/[id]">): Promise<Response> {
  const session = await signedInClient();
  if (!session) return jsonError(401, "Not signed in");

  const id = exerciseIdSchema.safeParse((await ctx.params).id);
  if (!id.success) return jsonError(404, "Exercise not found");

  const result = await getExerciseTutorial(session.supabase, id.data);
  if (result.status === "error") return jsonError(500, "Couldn't load exercise");
  if (result.status === "not_found") return jsonError(404, "Exercise not found");
  return jsonResponse(result.tutorial satisfies ExerciseTutorial, { cacheControl: TUTORIAL_CACHE_CONTROL });
}
