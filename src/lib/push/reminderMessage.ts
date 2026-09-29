// What a workout reminder says. Pure. Factual, like the rest of the app: what's planned today and
// a way in — no streak pressure, no guilt.

export type PushPayload = {
  title: string;
  body: string;
  // Opened when the notification is tapped (same-origin path).
  url: string;
  // Notifications with the same tag replace each other, so a device never stacks duplicates.
  tag: string;
};

export function workoutReminderPayload(reminder: {
  localDate: string;
  planTitle: string | null;
  exerciseCount: number;
}): PushPayload {
  const title = `${reminder.planTitle?.trim() || "Workout"} is planned for today`;
  const exercises =
    reminder.exerciseCount > 0 ? `${reminder.exerciseCount} exercise${reminder.exerciseCount === 1 ? "" : "s"}. ` : "";
  return {
    title,
    body: `${exercises}Tap to start when you're ready.`,
    url: `/log/${reminder.localDate}`,
    tag: `workout-reminder-${reminder.localDate}`,
  };
}

export const TEST_NOTIFICATION: PushPayload = {
  title: "Reminders are on",
  body: "This is how workout reminders will look on this device.",
  url: "/profile",
  tag: "reminder-test",
};
