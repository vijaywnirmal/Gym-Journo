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
