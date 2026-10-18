import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedCronRequest } from "@/lib/cronAuth";
import { jsonError, jsonResponse } from "@/lib/api";
import { sendDueWorkoutReminders } from "@/lib/push/reminders";
import { pushConfigFromEnv, webPushTransport } from "@/lib/push/send";

// POST /api/cron/reminders — sends today's workout reminders to everyone who is due (see
// lib/push/reminders.ts). Called every 15 minutes by the scheduler (.github/workflows/reminders.yml)
// with `Authorization: Bearer $CRON_SECRET`. Safe to call more often: each person gets at most one
// reminder a day.
export async function POST(request: Request): Promise<Response> {
  if (!isAuthorizedCronRequest(request)) return jsonError(401, "Unauthorized");

  const config = pushConfigFromEnv();
  const admin = createAdminClient();
  if (!config || !admin) return jsonError(503, "Push reminders aren't configured");

  try {
    const summary = await sendDueWorkoutReminders(admin, webPushTransport(config));
    return jsonResponse(summary);
  } catch (error) {
    console.error("reminder job failed", error);
    return jsonError(500, "Reminder job failed");
  }
}
