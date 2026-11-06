import type { ReactNode } from "react";
import Icon from "@/components/Icon";
import TrendChart from "@/components/TrendChart";
import {
  DEMO_COACH,
  DEMO_PLAN,
  DEMO_RECORDS,
  DEMO_WEEK,
  DEMO_WORKOUT,
  demoBenchTrend,
  type DemoDay,
} from "@/lib/demoData";

// Small, live renderings of the app's screens with sample data (lib/demoData.ts), drawn with the
// app's own tokens so they follow light and dark mode and never go stale like screenshots.

export function PreviewCard({ title, caption, children, className = "" }: {
  title: string;
  caption?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`card flex flex-col gap-3 p-4 ${className}`}>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        {caption && <span className="text-xs text-label-3">{caption}</span>}
      </div>
      {children}
    </div>
  );
}

const DAY_STYLE: Record<DemoDay["status"], string> = {
  done: "bg-green/12 text-green",
  today: "bg-accent text-on-accent",
  planned: "bg-accent/10 text-link",
  rest: "bg-fill text-label-3",
};

export function WeekPreview() {
  return (
    <PreviewCard title="This week" caption="2 of 4 done">
      <ol className="grid grid-cols-7 gap-1.5">
        {DEMO_WEEK.map((d) => (
          <li key={d.day} className="flex flex-col items-center gap-1.5">
            <span className="text-[11px] font-medium text-label-3">{d.day}</span>
            <span
              className={`grid h-10 w-full place-items-center rounded-lg text-[11px] font-semibold ${DAY_STYLE[d.status]}`}
              aria-label={`${d.day}: ${d.label}${d.status === "done" ? ", done" : d.status === "today" ? ", today" : ""}`}
            >
              {d.status === "done" ? <Icon name="checkmark" className="size-4" strokeWidth={2.5} /> : d.label}
            </span>
          </li>
        ))}
      </ol>
    </PreviewCard>
  );
}

export function PlanPreview() {
  return (
    <PreviewCard title={`Today · ${DEMO_PLAN.title}`} caption="Planned">
      <ul className="flex flex-col divide-y divide-separator text-sm">
        {DEMO_PLAN.exercises.map((e) => (
          <li key={e} className="py-2 first:pt-0 last:pb-0">
            {e}
          </li>
        ))}
      </ul>
    </PreviewCard>
  );
}

export function WorkoutPreview({ exercises = DEMO_WORKOUT.exercises.length }: { exercises?: number }) {
  return (
    <PreviewCard title={`${DEMO_WORKOUT.day} · ${DEMO_WORKOUT.title}`} caption="Logged">
      <div className="flex flex-col gap-4">
        {DEMO_WORKOUT.exercises.slice(0, exercises).map((exercise) => (
          <div key={exercise.name}>
            <p className="text-sm font-semibold">{exercise.name}</p>
            <table className="mt-1.5 w-full text-sm tabular-nums">
              <thead>
                <tr className="text-left text-[11px] text-label-3">
                  <th scope="col" className="w-10 pb-1 font-medium">Set</th>
                  <th scope="col" className="pb-1 font-medium">Done</th>
                  <th scope="col" className="pb-1 text-right font-medium">Last week</th>
                </tr>
              </thead>
              <tbody>
                {exercise.sets.map((set, i) => (
                  <tr key={i} className="border-t border-separator">
                    <td className="py-1.5 text-label-3">{i + 1}</td>
                    <td className="py-1.5 font-medium">
                      {set.weight} kg × {set.reps}
                      {set.record && (
                        <span className="ml-2 rounded-full bg-orange/12 px-1.5 py-0.5 text-[10px] font-semibold text-orange">
                          Record
                        </span>
                      )}
                    </td>
                    <td className="py-1.5 text-right text-label-3">{set.previous}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </PreviewCard>
  );
}

export function ProgressPreview() {
  return (
    <PreviewCard title="Bench press" caption="Estimated one-rep max">
      <TrendChart points={demoBenchTrend()} unit="kg" />
    </PreviewCard>
  );
}

export function RecordsPreview() {
  return (
    <PreviewCard title="Recent records">
      <ul className="flex flex-col divide-y divide-separator text-sm">
        {DEMO_RECORDS.map((r) => (
          <li key={r.exercise} className="flex items-baseline justify-between gap-3 py-2 first:pt-0 last:pb-0">
            <span>
              <span className="font-medium">{r.exercise}</span> <span className="tabular-nums text-label-2">{r.record}</span>
            </span>
            <span className="shrink-0 text-xs text-label-3">{r.when}</span>
          </li>
        ))}
      </ul>
    </PreviewCard>
  );
}

export function CoachPreview() {
  return (
    <PreviewCard title="Coach" caption="Answers from your own logs">
      <div className="flex flex-col gap-2 text-sm">
        <p className="self-end rounded-2xl rounded-br-md bg-accent px-3.5 py-2 text-on-accent">{DEMO_COACH.question}</p>
        <div className="self-start rounded-2xl rounded-bl-md bg-fill px-3.5 py-2">
          <p>{DEMO_COACH.answer}</p>
          <p className="mt-1.5 flex items-center gap-1.5 text-xs text-label-2">
            <Icon name="sparkles" className="size-3.5" /> {DEMO_COACH.evidence}
          </p>
        </div>
      </div>
    </PreviewCard>
  );
}

// A trainer's client list with each client's status.
// The labels are the app's own (lib/clientStatus.ts).
const CLIENTS = [
  { name: "Arjun S.", status: "Done", tone: "text-green bg-green/12" },
  { name: "Priya D.", status: "Done", tone: "text-green bg-green/12" },
  { name: "Rohan M.", status: "Missed", tone: "text-orange bg-orange/12" },
  { name: "Neha K.", status: "Planned", tone: "text-link bg-accent/10" },
  { name: "Kabir T.", status: "Nothing planned", tone: "text-label-2 bg-fill" },
];

export function ClientsPreview() {
  return (
    <PreviewCard title="Your clients" caption="Today">
      <ul className="flex flex-col divide-y divide-separator text-sm">
        {CLIENTS.map((c) => (
          <li key={c.name} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
            <span className="flex items-center gap-2.5">
              <Initials name={c.name} />
              <span className="font-medium">{c.name}</span>
            </span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${c.tone}`}>{c.status}</span>
          </li>
        ))}
      </ul>
    </PreviewCard>
  );
}

// A gym's members at a glance: counts and dates only, never their workouts.
const MEMBERS = [
  { name: "Sana R.", week: 4, last: "Today" },
  { name: "Vikram P.", week: 3, last: "Yesterday" },
  { name: "Meera J.", week: 1, last: "Monday" },
  { name: "Dev A.", week: 0, last: "12 days ago", quiet: true },
];

export function MembersPreview() {
  return (
    <PreviewCard title="Members" caption="This week">
      <table className="w-full text-sm tabular-nums">
        <thead>
          <tr className="text-left text-[11px] text-label-3">
            <th scope="col" className="pb-1.5 font-medium">Member</th>
            <th scope="col" className="pb-1.5 text-right font-medium">Workouts</th>
            <th scope="col" className="pb-1.5 text-right font-medium">Last trained</th>
          </tr>
        </thead>
        <tbody>
          {MEMBERS.map((m) => (
            <tr key={m.name} className="border-t border-separator">
              <td className="py-2 font-medium">{m.name}</td>
              <td className="py-2 text-right">{m.week}</td>
              <td className={`py-2 text-right ${m.quiet ? "font-semibold text-orange" : "text-label-2"}`}>{m.last}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </PreviewCard>
  );
}

export function FeesPreview() {
  return (
    <PreviewCard title="Fees" caption="November">
      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          ["32", "Paid", "text-green"],
          ["5", "Due", "text-label"],
          ["2", "Overdue", "text-orange"],
        ].map(([n, label, tone]) => (
          <div key={label} className="rounded-lg bg-fill py-3">
            <p className={`text-xl font-semibold tabular-nums ${tone}`}>{n}</p>
            <p className="text-xs text-label-2">{label}</p>
          </div>
        ))}
      </div>
      <p className="text-xs text-label-3">Recorded by you: cash, UPI and so on. GymJourno doesn&apos;t take payments.</p>
    </PreviewCard>
  );
}

// A person's or gym's initials in a circle, where a photo would go.
export function Initials({ name, size = "sm" }: { name: string; size?: "sm" | "lg" }) {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center rounded-full bg-accent/12 font-semibold text-link ${
        size === "lg" ? "size-16 text-xl" : "size-8 text-xs"
      }`}
    >
      {letters}
    </span>
  );
}
