"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon, { type IconName } from "@/components/Icon";

const TABS: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "Today", icon: "today" },
  { href: "/calendar", label: "Calendar", icon: "calendar" },
  { href: "/history", label: "History", icon: "history" },
  { href: "/progress", label: "Progress", icon: "progress" },
  { href: "/exercises", label: "Exercises", icon: "dumbbell" },
  { href: "/profile", label: "Profile", icon: "person" },
];

export default function BottomNav() {
  const pathname = usePathname();

  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password")
  )
    return null;

  // A floating translucent tab bar: content scrolls underneath, the bar never consumes a fixed strip.
  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-20 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <ul className="material pointer-events-auto mx-auto flex max-w-md rounded-full border border-[var(--material-edge)] p-1 shadow-raised">
        {TABS.map((tab) => {
          const active = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-0.5 rounded-full py-1.5 text-[11px] font-medium tracking-normal ${
                  active ? "bg-fill text-tint" : "text-label-2"
                }`}
              >
                <Icon name={tab.icon} className="size-6" strokeWidth={active ? 2.1 : 1.75} />
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
