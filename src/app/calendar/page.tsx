import Link from "next/link";
import { getWeekOverview } from "@/lib/queries";
import { formatDate, shiftDate, weekDates } from "@/lib/date";
import { getToday } from "@/lib/userDate";
import { formatDayStatus } from "./dayStatus";
import Icon from "@/components/Icon";

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
    <main className="screen-enter px-4 pt-4">
      <header className="mb-4 flex items-end justify-between px-1">
        <h1 className="large-title">Calendar</h1>
        <Link href="/programs" className="pb-1 text-base text-tint">
          Programs
        </Link>
      </header>

      <div className="mb-4 flex items-center justify-between rounded-full bg-fill p-1">
        <Link
          href={`/calendar?week=${shiftDate(centerDate, -7)}`}
          aria-label="Previous week"
          className="grid size-9 place-items-center rounded-full text-tint"
        >
          <Icon name="chevronLeft" className="size-5" strokeWidth={2.25} />
        </Link>
        <Link href="/calendar" className="rounded-full px-4 py-1.5 text-sm font-semibold text-label">
          This week
        </Link>
        <Link
          href={`/calendar?week=${shiftDate(centerDate, 7)}`}
          aria-label="Next week"
          className="grid size-9 place-items-center rounded-full text-tint"
        >
          <Icon name="chevronRight" className="size-5" strokeWidth={2.25} />
        </Link>
      </div>

      <ul className="mb-6 overflow-hidden rounded-xl bg-surface">
        {dates.map((date, i) => {
          const info = overview.get(date);
          const isToday = date === todayDate;
          return (
            <li key={date} className="relative flex items-center justify-between gap-3 px-4 py-3">
              {i > 0 && <span className="absolute inset-x-4 top-0 h-px bg-separator" aria-hidden />}
              <div className="min-w-0">
                <p className={`text-base font-semibold ${isToday ? "text-tint" : "text-label"}`}>
                  {formatDate(date)}
                  {isToday && (
                    <span className="ml-2 rounded-full bg-tint px-2 py-0.5 align-middle text-[11px] font-semibold text-white">
                      Today
                    </span>
                  )}
                </p>
                <p className="truncate text-sm text-label-2">
                  {info?.isRestDay
                    ? `Rest day${info.title ? ` · ${info.title}` : ""}`
                    : info?.title
                      ? info.title
                      : "Not scheduled"}
                  {info ? formatDayStatus(info) : ""}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Link
                  href={`/schedule/${date}`}
                  className="rounded-full bg-fill px-3 py-1.5 text-sm font-semibold text-tint"
                >
                  Plan
                </Link>
                {!info?.isRestDay && (
                  <Link
                    href={`/log/${date}`}
                    className="rounded-full bg-tint px-3 py-1.5 text-sm font-semibold text-white"
                  >
                    Log
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
