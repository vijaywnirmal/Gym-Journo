import { format } from "date-fns";
import { jsonError, signedInClient } from "@/lib/api";
import { buildExportDocument } from "@/lib/dataExport";
import { renderExportPdf } from "@/lib/exportPdf";
import type { BodyMeasurement, WorkoutLog, WorkoutPlan } from "@/lib/types";

// GET /api/export — "Download my data" on Profile (story I5.1): the signed-in person's workouts,
// plans and body weight as a PDF. Only their own rows (user_id filter, and row-level security).

const BATCH = 200;

type Session = NonNullable<Awaited<ReturnType<typeof signedInClient>>>;

// Every row, a batch at a time: one request can't return more than the API's row limit.
async function readAll<T>(
  fetchBatch: (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }>
): Promise<T[] | null> {
  const rows: T[] = [];
  for (let from = 0; ; from += BATCH) {
    const { data, error } = await fetchBatch(from, from + BATCH - 1);
    if (error || !Array.isArray(data)) return null;
    rows.push(...(data as T[]));
    if (data.length < BATCH) return rows;
  }
}

async function readData({ supabase, userId }: Session) {
  const [logs, plans, bodyWeight, profile] = await Promise.all([
    readAll<WorkoutLog>((from, to) =>
      supabase
        .from("workout_logs")
        .select("*, logged_exercises(*, exercise:exercises(name), logged_sets(*))")
        .eq("user_id", userId)
        .order("date", { ascending: false })
        .order("id")
        .range(from, to)
    ),
    readAll<WorkoutPlan>((from, to) =>
      supabase
        .from("workout_plans")
        .select("*, planned_exercises(*, exercise:exercises(name))")
        .eq("user_id", userId)
        .order("date", { ascending: false })
        .order("id")
        .range(from, to)
    ),
    readAll<BodyMeasurement>((from, to) =>
      supabase
        .from("body_measurements")
        .select("*")
        .eq("user_id", userId)
        .order("date", { ascending: false })
        .order("id")
        .range(from, to)
    ),
    supabase.from("profiles").select("full_name, first_name").eq("id", userId).maybeSingle(),
  ]);
  if (!logs || !plans || !bodyWeight) return null;
  const name = (profile.data?.full_name as string | null) ?? (profile.data?.first_name as string | null) ?? null;
  return { logs, plans, bodyWeight, name };
}

export async function GET(): Promise<Response> {
  const session = await signedInClient();
  if (!session) return jsonError(401, "Not signed in");

  const data = await readData(session);
  if (!data) return jsonError(500, "Couldn't read your data");

  const today = format(new Date(), "yyyy-MM-dd");
  const pdf = await renderExportPdf(buildExportDocument({ ...data, generatedOn: today }));
  return new Response(pdf as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="gymjourno-data-${today}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
