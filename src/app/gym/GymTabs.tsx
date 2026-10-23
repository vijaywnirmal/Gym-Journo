import Link from "next/link";

// Members and Trainers, the two halves of the gym's screens.
export default function GymTabs({ current }: { current: "members" | "trainers" }) {
  const tabs = [
    { key: "members", href: "/gym", label: "Members" },
    { key: "trainers", href: "/gym/trainers", label: "Trainers" },
  ] as const;
  return (
    <nav aria-label="Gym" className="mb-4 flex rounded-[10px] bg-fill p-0.5">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={current === tab.key ? "page" : undefined}
          className={`flex h-8 flex-1 items-center justify-center rounded-lg text-sm font-semibold ${
            current === tab.key ? "bg-surface shadow-card" : "text-label-2 hover:text-label"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
