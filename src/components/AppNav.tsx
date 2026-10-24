"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon, { type IconName } from "@/components/Icon";

type Tab = { href: string; label: string; icon: IconName };

// The workout journal: members.
const MEMBER_TABS: Tab[] = [
  { href: "/", label: "Today", icon: "today" },
  { href: "/calendar", label: "Calendar", icon: "calendar" },
  { href: "/history", label: "History", icon: "history" },
  { href: "/progress", label: "Progress", icon: "progress" },
  { href: "/exercises", label: "Exercises", icon: "dumbbell" },
  { href: "/profile", label: "Profile", icon: "person" },
];

const PROFILE_TAB: Tab = { href: "/profile", label: "Profile", icon: "person" };
const TRAINER_TABS: Tab[] = [
  { href: "/trainer", label: "Today", icon: "today" },
  { href: "/trainer/clients", label: "Clients", icon: "people" },
  { href: "/trainer/plans", label: "Plans", icon: "calendar" },
];
const GYM_TABS: Tab[] = [
  { href: "/gym", label: "Dashboard", icon: "gym" },
  { href: "/gym/members", label: "Members", icon: "people" },
  { href: "/gym/trainers", label: "Trainers", icon: "dumbbell" },
  { href: "/gym/invite", label: "Invite", icon: "share" },
];

// Trainers and the people who run a gym get work screens instead of the journal (src/lib/
// workAccount.ts). Someone who does both gets the trainer's tabs and one Gym tab, whose dashboard
// leads to the gym's other screens.
export function tabsFor(isTrainer: boolean, isGymAdmin: boolean): Tab[] {
  if (isTrainer && isGymAdmin) return [...TRAINER_TABS, { href: "/gym", label: "Gym", icon: "gym" }, PROFILE_TAB];
  if (isTrainer) return [...TRAINER_TABS, { href: "/exercises", label: "Exercises", icon: "dumbbell" }, PROFILE_TAB];
  if (isGymAdmin) return [...GYM_TABS, PROFILE_TAB];
  return MEMBER_TABS;
}

// Sub-pages highlight the tab they belong to.
const SECTION_OF: [string, string][] = [
  ["/log", "/calendar"],
  ["/schedule", "/calendar"],
  ["/programs", "/calendar"],
  ["/body", "/profile"],
  ["/join", "/profile"],
  ["/g/", "/profile"],
  ["/coach", "/"],
  ["/ai-plan", "/"],
  ["/suggestions", "/"],
  ["/trainer/invite", "/trainer/clients"],
];

const HIDDEN_ON = [
  "/login",
  "/auth",
  "/onboarding",
  "/trainer/setup",
  "/gym/setup",
  "/gym/admin-setup",
  "/gym/poster",
  "/forgot-password",
  "/reset-password",
  "/privacy",
];

// The tab a page belongs to: its section, else the tab with the longest path it sits under (so
// /trainer/clients/… is Clients, not the trainer's Today at /trainer).
export function activeTab(pathname: string, tabs: Tab[]): string {
  const section = SECTION_OF.find(([prefix]) => pathname.startsWith(prefix))?.[1];
  if (section && tabs.some((t) => t.href === section)) return section;
  if (pathname === "/") return "/";
  const under = tabs.filter((t) => t.href !== "/" && (pathname === t.href || pathname.startsWith(`${t.href}/`)));
  return under.sort((a, b) => b.href.length - a.href.length)[0]?.href ?? "";
}

// Primary navigation: a bottom bar on phones, a sidebar from tablet width up.
export default function AppNav({ isTrainer = false, isGymAdmin = false }: { isTrainer?: boolean; isGymAdmin?: boolean }) {
  const pathname = usePathname();
  if (HIDDEN_ON.some((p) => pathname.startsWith(p))) return null;
  const tabs = tabsFor(isTrainer, isGymAdmin);
  const current = activeTab(pathname, tabs);

  return (
    <>
      <nav
        aria-label="Primary"
        className="material fixed inset-x-0 bottom-0 z-30 border-t border-separator pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <ul className="mx-auto flex max-w-lg">
          {tabs.map((tab) => {
            const active = current === tab.href;
            return (
              <li key={tab.href} className="flex-1">
                <Link
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex flex-col items-center gap-1 pt-2 pb-1.5 text-[11px] font-medium ${
                    active ? "text-link" : "text-label-3"
                  }`}
                >
                  <Icon name={tab.icon} className="size-[22px]" strokeWidth={active ? 2.1 : 1.75} />
                  {tab.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <nav
        aria-label="Primary"
        className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-separator bg-surface px-3 py-5 md:flex"
      >
        <Link href="/" className="mb-6 flex items-center gap-2.5 px-2">
          <span className="grid size-8 place-items-center rounded-lg bg-accent text-on-accent">
            <Icon name="dumbbell" className="size-5" strokeWidth={2.25} />
          </span>
          <span className="text-[15px] font-semibold tracking-tight">Gym Journal</span>
        </Link>
        <ul className="flex flex-col gap-0.5">
          {tabs.map((tab) => {
            const active = current === tab.href;
            return (
              <li key={tab.href}>
                <Link
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex h-9 items-center gap-3 rounded-lg px-2.5 text-sm font-medium ${
                    active ? "bg-fill text-label" : "text-label-2 hover:bg-fill hover:text-label"
                  }`}
                >
                  <Icon name={tab.icon} className={`size-[18px] ${active ? "text-link" : ""}`} />
                  {tab.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
