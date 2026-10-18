import Link from "next/link";
import { format, parseISO } from "date-fns";
import PageHeader from "@/components/PageHeader";
import { getWeekOverview } from "@/lib/queries";
import { formatDate, shiftDate, weekDates } from "@/lib/date";
import { getToday } from "@/lib/userDate";
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
    <main className="px-4 pt-6 md:px-8 md:pt-10">
      <PageHeader
        title="Calendar"
        subtitle={`${formatDate(dates[0])} – ${formatDate(dates[6])}`}
        actions={
          <Link
            href="/programs"
            className="flex h-9 items-center rounded-[10px] border border-separator px-3 text-sm font-medium hover:bg-fill"
          >
            Programs
          </Link>
        }
      />

      <div className="mb-4 flex items-center gap-2">
        <Link
          href={`/calendar?week=${shiftDate(centerDate, -7)}`}
          aria-label="Previous week"
          className="grid size-9 place-items-center rounded-[10px] border border-separator text-label-2 hover:bg-fill"
        >
          <Icon name="chevronLeft" className="size-4" strokeWidth={2.25} />
        </Link>
        <Link
          href={`/calendar?week=${shiftDate(centerDate, 7)}`}
          aria-label="Next week"
          className="grid size-9 place-items-center rounded-[10px] border border-separator text-label-2 hover:bg-fill"
        >
          <Icon name="chevronRight" className="size-4" strokeWidth={2.25} />
        </Link>
        {!dates.includes(todayDate) && (
          <Link href="/calendar" className="ml-1 rounded-lg px-2.5 py-1.5 text-sm font-medium text-link hover:bg-fill">
            Back to this week
          </Link>
        )}
      </div>

      <ul className="card mb-6 divide-y divide-separator overflow-hidden">
        {dates.map((date) => {
          const info = overview.get(date);
          const isToday = date === todayDate;
          const isFuture = date > todayDate;
          const day = parseISO(date);
          return (
            <li key={date} className={`flex items-center gap-4 px-4 py-3 ${isToday ? "bg-accent/5" : ""}`}>
              <div
                className={`flex w-11 shrink-0 flex-col items-center rounded-lg py-1 ${
                  isToday ? "bg-accent text-on-accent" : ""
                }`}
              >
                <span className={`text-[11px] font-medium uppercase ${isToday ? "" : "text-label-3"}`}>
                  {format(day, "EEE")}
                </span>
                <span className="text-lg leading-6 font-semibold tabular-nums">{format(day, "d")}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className={`truncate text-sm font-medium ${info?.title || info?.isRestDay ? "" : "text-label-3"}`}>
                  {info?.isRestDay ? `Rest day${info.title ? ` · ${info.title}` : ""}` : (info?.title ?? "Not planned")}
                </p>
                {info && (info.performed || info.completed) && (
                  <p className="flex items-center gap-1 text-xs text-green">
                    <Icon name="checkmark" className="size-3.5" strokeWidth={2.5} />
                    {[info.performed && "Performed", info.completed && "Completed"].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 gap-1.5">
                <Link
                  href={`/schedule/${date}`}
                  className="flex h-8 items-center rounded-lg px-3 text-sm font-medium text-label-2 hover:bg-fill hover:text-label"
                >
                  {info?.title || info?.isRestDay ? "Edit" : "Plan"}
                </Link>
                {!isFuture && !info?.isRestDay && (
                  <Link
                    href={`/log/${date}`}
                    className="flex h-8 items-center rounded-lg bg-accent px-3 text-sm font-semibold text-on-accent hover:bg-accent-hover"
                  >
                    {info?.performed || info?.completed ? "View" : "Log"}
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
