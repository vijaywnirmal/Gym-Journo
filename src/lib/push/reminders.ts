import type { SupabaseClient } from "@supabase/supabase-js";
import { workoutReminderPayload } from "./reminderMessage";
import { deliver, type PushTransport, type StoredSubscription } from "./send";

// The reminder job (server only, service role): find who is due (due_workout_reminders, migration
// 0030), send each of them one notification per device, drop devices that are gone, and record the
// day so nobody is reminded twice. A person whose every delivery failed for a transient reason is
// not marked, so the next run inside their window tries again.

type DueRow = { user_id: string; local_date: string; plan_title: string | null; exercise_count: number };

export type ReminderRunSummary = { due: number; notified: number; expiredDevices: number; failedDevices: number };

export async function sendDueWorkoutReminders(
  admin: SupabaseClient,
  transport: PushTransport,
  now: Date = new Date()
): Promise<ReminderRunSummary> {
  const { data, error } = await admin.rpc("due_workout_reminders", { p_now: now.toISOString() });
  if (error) throw new Error(`due_workout_reminders failed: ${error.message}`);
  const due = (data ?? []) as DueRow[];

  const summary: ReminderRunSummary = { due: due.length, notified: 0, expiredDevices: 0, failedDevices: 0 };
  for (const person of due) {
    const { data: subscriptions, error: subscriptionsError } = await admin
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_id", person.user_id);
    if (subscriptionsError) {
      summary.failedDevices++;
      continue;
    }

    const payload = workoutReminderPayload({
      localDate: person.local_date,
      planTitle: person.plan_title,
      exerciseCount: person.exercise_count,
    });
    const result = await deliver((subscriptions ?? []) as StoredSubscription[], payload, transport);

    if (result.expired.length > 0) {
      await admin.from("push_subscriptions").delete().in("endpoint", result.expired);
    }
    summary.expiredDevices += result.expired.length;
    summary.failedDevices += result.failed;

    const allTransientFailures = result.delivered === 0 && result.failed > 0;
    if (!allTransientFailures) {
      await admin.from("profiles").update({ reminder_last_sent_on: person.local_date }).eq("id", person.user_id);
    }
    if (result.delivered > 0) summary.notified++;
  }
  return summary;
}
