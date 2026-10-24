// Shown before a member's account becomes a work account (trainer or gym), which has no workout
// journal (src/lib/workAccount.ts). Their own workouts are kept, just not shown. Only for accounts
// set up as members (with a goal): one made for work has no journal to lose.
export function hasJournal(profile: { primary_goal: string | null } | null): boolean {
  return profile?.primary_goal != null;
}

export default function WorkAccountNotice({ as, className = "" }: { as: "trainer" | "gym" | "admin"; className?: string }) {
  const becomes = as === "trainer" ? "a trainer account" : "a gym account";
  return (
    <p className={`rounded-[10px] bg-orange/10 px-3 py-2.5 text-sm ${className}`}>
      This account will become {becomes}, without your own workout journal (what you&apos;ve logged is kept). To keep
      logging your own training, use a different email for {as === "trainer" ? "your trainer account" : "the gym"}.
    </p>
  );
}
