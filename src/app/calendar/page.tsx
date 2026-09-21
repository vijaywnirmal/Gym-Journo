import Link from "next/link";
import { getWeekOverview } from "@/lib/queries";
import { formatDate, shiftDate, weekDates } from "@/lib/date";
import { getToday } from "@/lib/userDate";
import { formatDayStatus } from "./dayStatus";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { week } = await searchParams;
  const todayDate = await getToday();
  const centerDate = week ?? todayDate;
  const dates = weekDates(centerDate);
  const overview = await getWeekOverview(dates);

  return (
    <main className="px-4 pt-6">
      <h1 className="mb-4 text-xl font-bold">Calendar</h1>

      <div className="mb-4 flex items-center justify-between">
        <Link
          href={`/calendar?week=${shiftDate(centerDate, -7)}`}
          className="rounded-lg border border-neutral-700 px-3 py-1.5 text-sm text-neutral-100"
        >
          ← Prev
        </Link>
        <Link href="/calendar" className="text-sm text-neutral-400">
          This week
        </Link>
        <Link
          href={`/calendar?week=${shiftDate(centerDate, 7)}`}
          className="rounded-lg border border-neutral-700 px-3 py-1.5 text-sm text-neutral-100"
        >
          Next →
        </Link>
      </div>

      <div className="flex flex-col gap-2 pb-6">
        {dates.map((date) => {
          const info = overview.get(date);
          const isToday = date === todayDate;
          return (
            <div
              key={date}
              className={`flex items-center justify-between rounded-xl border p-3 ${
                isToday ? "border-neutral-100" : "border-neutral-800"
              }`}
            >
              <div>
                <p className="text-sm font-medium text-neutral-100">
                  {formatDate(date)} {isToday && <span className="text-neutral-500">· today</span>}
                </p>
                <p className="text-xs text-neutral-400">
                  {info?.isRestDay
                    ? `😴 Rest day${info.title ? ` · ${info.title}` : ""}`
                    : info?.title
                      ? info.title
                      : "Not scheduled"}
                  {info ? formatDayStatus(info) : ""}
                </p>
              </div>
              <div className="flex gap-2">
                <Link
                  href={`/schedule/${date}`}
                  className="rounded-lg border border-neutral-700 px-2.5 py-1.5 text-xs font-medium text-neutral-100"
                >
                  Schedule
                </Link>
                {!info?.isRestDay && (
                  <Link
                    href={`/log/${date}`}
                    className="rounded-lg bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-900"
                  >
                    Log
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
