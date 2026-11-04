import { formatDate, shiftDate } from "@/lib/date";
import type { DayType } from "@/lib/dayType";
import type { PushPayload } from "./reminderMessage";

// Plan updates from a trainer share a tag, so planning a whole week replaces the notification on the
// client's phone instead of stacking seven. Today's change has its own, so a later day's doesn't
// hide it.
export const TRAINER_PLAN_TAG = "trainer-plan";
export const TRAINER_TODAY_TAG = "trainer-plan-today";

function dayLabel(date: string, today: string): string {
  if (date === today) return "Today";
  if (date === shiftDate(today, 1)) return "Tomorrow";
  return formatDate(date);
}

// What the client sees when their trainer plans (or changes) one of their days.
export function trainerPlanMessage({
  trainerName,
  date,
  today,
  title,
  dayType,
}: {
  trainerName: string;
  date: string;
  today: string;
  title: string;
  dayType: DayType;
}): PushPayload {
  const when = dayLabel(date, today);
  const name = title.trim();
  return {
    title:
      dayType === "workout"
        ? `${trainerName} planned your workout`
        : dayType === "rest"
          ? `${trainerName} planned a rest day`
          : `${trainerName} marked a day off`,
    body: dayType === "workout" ? `${when}: ${name || "Workout"}` : name ? `${when}: ${name}` : when,
    url: date === today ? "/" : `/schedule/${date}`,
    tag: date === today ? TRAINER_TODAY_TAG : TRAINER_PLAN_TAG,
  };
}

export function trainerProgramMessage({
  trainerName,
  created,
  firstDate,
  today,
}: {
  trainerName: string;
  created: number;
  firstDate: string;
  today: string;
}): PushPayload {
  const when = dayLabel(firstDate, today);
  return {
    title: `${trainerName} added a program to your plan`,
    body: `${created} workout${created === 1 ? "" : "s"}, starting ${when === "Today" || when === "Tomorrow" ? when.toLowerCase() : when}`,
    url: `/calendar?week=${firstDate}`,
    tag: TRAINER_PLAN_TAG,
  };
}

// What a member sees when their gym suggests a trainer. One at a time, so a new suggestion
// replaces the last.
export function gymOfferMessage({ gymName, trainerName }: { gymName: string; trainerName: string }): PushPayload {
  return {
    title: `${gymName} suggests ${trainerName} as your trainer`,
    body: "Open Profile to accept or decline.",
    url: "/profile",
    tag: "gym-trainer-offer",
  };
}

// What a member sees when their gym removes them.
export function gymRemovedMessage({ gymName, trainerName }: { gymName: string; trainerName?: string | null }): PushPayload {
  return {
    title: `You're no longer a member of ${gymName}`,
    body: `${trainerName ? `${trainerName} is no longer your trainer. ` : ""}Your workouts and history are still here. If this is a mistake, ask the gym.`,
    url: "/profile",
    tag: "gym-removed",
  };
}

// What a member sees when someone else ends their trainer: the gym, or the trainer.
export function trainerEndedMessage({ trainerName }: { trainerName: string }): PushPayload {
  return {
    title: `${trainerName} is no longer your trainer`,
    body: "Your workouts and plans are still here.",
    url: "/profile",
    tag: "trainer-ended",
  };
}

// What a trainer or admin sees when their gym removes them.
export function gymStaffRemovedMessage({ gymName, role }: { gymName: string; role: "admin" | "trainer" }): PushPayload {
  return {
    title: `You're no longer ${role === "admin" ? "an admin" : "a trainer"} at ${gymName}`,
    body: role === "admin" ? "You can no longer manage this gym." : "You'll no longer train members through this gym.",
    url: "/profile",
    tag: "gym-staff-removed",
  };
}
