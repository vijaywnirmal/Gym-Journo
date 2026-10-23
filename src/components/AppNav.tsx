"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon, { type IconName } from "@/components/Icon";

type Tab = { href: string; label: string; icon: IconName };

const TABS: Tab[] = [
  { href: "/", label: "Today", icon: "today" },
  { href: "/calendar", label: "Calendar", icon: "calendar" },
  { href: "/history", label: "History", icon: "history" },
  { href: "/progress", label: "Progress", icon: "progress" },
  { href: "/exercises", label: "Exercises", icon: "dumbbell" },
  { href: "/profile", label: "Profile", icon: "person" },
];

const CLIENTS_TAB: Tab = { href: "/trainer", label: "Clients", icon: "people" };

// Trainers get a Clients tab after Calendar. The phone bar has room for six, so there it takes
// Exercises' place (the library is still a tap away when planning, and in the sidebar).
function tabsFor(isTrainer: boolean, phone: boolean): Tab[] {
  if (!isTrainer) return TABS;
  const tabs = phone ? TABS.filter((t) => t.href !== "/exercises") : TABS;
  return [...tabs.slice(0, 2), CLIENTS_TAB, ...tabs.slice(2)];
}

// Sub-pages highlight the tab they belong to.
const SECTION_OF: [string, string][] = [
  ["/log", "/calendar"],
  ["/schedule", "/calendar"],
  ["/programs", "/calendar"],
  ["/body", "/profile"],
  ["/join", "/profile"],
  ["/coach", "/"],
  ["/ai-plan", "/"],
  ["/suggestions", "/"],
];

const HIDDEN_ON = ["/login", "/auth", "/onboarding", "/trainer/setup", "/forgot-password", "/reset-password", "/privacy"];

function activeTab(pathname: string): string {
  const section = SECTION_OF.find(([prefix]) => pathname.startsWith(prefix));
  if (section) return section[1];
  return (
    [...TABS, CLIENTS_TAB].find((t) => t.href !== "/" && pathname.startsWith(t.href))?.href ?? (pathname === "/" ? "/" : "")
  );
}

// Primary navigation: a bottom bar on phones, a sidebar from tablet width up.
export default function AppNav({ isTrainer = false }: { isTrainer?: boolean }) {
  const pathname = usePathname();
  if (HIDDEN_ON.some((p) => pathname.startsWith(p))) return null;
  const current = activeTab(pathname);

  return (
    <>
      <nav
        aria-label="Primary"
        className="material fixed inset-x-0 bottom-0 z-30 border-t border-separator pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <ul className="mx-auto flex max-w-lg">
          {tabsFor(isTrainer, true).map((tab) => {
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
          {tabsFor(isTrainer, false).map((tab) => {
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
