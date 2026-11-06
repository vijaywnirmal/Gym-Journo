import type { ReactNode } from "react";
import Link from "next/link";
import Icon from "@/components/Icon";
import { PRIVACY_EMAIL } from "@/lib/contact";
import { SIGN_UP_HREF } from "@/lib/publicPages";

// The front door's frame: a header with the name and the two ways in, the page, and a footer.

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5 rounded-lg" aria-label="GymJourno home">
      <span className="grid size-8 place-items-center rounded-lg bg-accent text-on-accent">
        <Icon name="dumbbell" className="size-5" strokeWidth={2.25} />
      </span>
      <span className="text-[17px] font-semibold tracking-tight">GymJourno</span>
    </Link>
  );
}

export function ButtonLink({
  href,
  children,
  variant = "primary",
  className = "",
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary";
  className?: string;
}) {
  const look =
    variant === "primary"
      ? "bg-accent text-on-accent hover:bg-accent-hover"
      : "border border-separator bg-surface text-label hover:bg-fill";
  return (
    <Link
      href={href}
      className={`inline-flex h-11 items-center justify-center rounded-[10px] px-5 text-[15px] font-semibold ${look} ${className}`}
    >
      {children}
    </Link>
  );
}

export function PublicPage({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="material sticky top-0 z-30 border-b border-separator pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 md:px-8">
          <Logo />
          <nav aria-label="Main" className="flex items-center gap-1 text-sm font-medium">
            <Link href="/trainers" className="hidden rounded-lg px-3 py-2 text-label-2 hover:bg-fill hover:text-label md:block">
              For trainers
            </Link>
            <Link href="/gyms" className="hidden rounded-lg px-3 py-2 text-label-2 hover:bg-fill hover:text-label md:block">
              For gyms
            </Link>
            <Link href="/login" className="rounded-lg px-3 py-2 text-label-2 hover:bg-fill hover:text-label">
              Sign in
            </Link>
            <Link
              href={SIGN_UP_HREF}
              className="ml-1 inline-flex h-9 items-center rounded-[10px] bg-accent px-3.5 font-semibold text-on-accent hover:bg-accent-hover"
            >
              Start free
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-separator pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 text-sm md:flex-row md:items-start md:justify-between md:px-8">
          <div className="flex flex-col gap-2">
            <Logo />
            <p className="max-w-xs text-label-2">Plan your workouts and log what you actually do.</p>
          </div>
          <nav aria-label="Footer" className="grid grid-cols-2 gap-x-10 gap-y-2 text-label-2 sm:grid-cols-3">
            <Link href="/trainers" className="hover:text-label">For trainers</Link>
            <Link href="/gyms" className="hover:text-label">For gyms</Link>
            <Link href="/demo" className="hover:text-label">See a demo</Link>
            <Link href="/login" className="hover:text-label">Sign in</Link>
            <Link href="/privacy" className="hover:text-label">Privacy</Link>
            <a href={`mailto:${PRIVACY_EMAIL}`} className="hover:text-label">Contact</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}

// One band of the page, at a readable width.
export function Section({ children, className = "", id }: { children: ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={`mx-auto max-w-6xl px-4 md:px-8 ${className}`}>
      {children}
    </section>
  );
}

export function FeatureCard({ icon, title, children }: { icon: Parameters<typeof Icon>[0]["name"]; title: string; children: ReactNode }) {
  return (
    <div className="card flex flex-col gap-3 p-5">
      <span className="grid size-9 place-items-center rounded-lg bg-accent/10 text-link">
        <Icon name={icon} className="size-5" strokeWidth={2} />
      </span>
      <h3 className="text-[15px] font-semibold">{title}</h3>
      <p className="text-sm text-label-2">{children}</p>
    </div>
  );
}

// Who can see what: the same honesty the app's consent screens have.
export function SeesList({ title, sees, doesntSee }: { title: string; sees: string[]; doesntSee: string[] }) {
  return (
    <div className="card grid gap-6 p-5 text-sm md:grid-cols-2">
      <div>
        <h3 className="font-semibold">{title} sees</h3>
        <ul className="mt-2 flex flex-col gap-1.5 text-label-2">
          {sees.map((item) => (
            <li key={item} className="flex gap-2">
              <Icon name="checkmark" className="mt-0.5 size-4 shrink-0 text-green" strokeWidth={2.25} />
              {item}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h3 className="font-semibold">{title} doesn&apos;t see</h3>
        <ul className="mt-2 flex flex-col gap-1.5 text-label-2">
          {doesntSee.map((item) => (
            <li key={item} className="flex gap-2">
              <Icon name="close" className="mt-0.5 size-4 shrink-0 text-label-3" strokeWidth={2.25} />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function ClosingCall({ title, text, primary, secondary }: {
  title: string;
  text: string;
  primary: { href: string; label: string };
  secondary?: { href: string; label: string };
}) {
  return (
    <Section className="py-16 md:py-24">
      <div className="card flex flex-col items-start gap-4 p-6 md:flex-row md:items-center md:justify-between md:p-10">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
          <p className="mt-1 text-label-2">{text}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href={primary.href}>{primary.label}</ButtonLink>
          {secondary && (
            <ButtonLink href={secondary.href} variant="secondary">
              {secondary.label}
            </ButtonLink>
          )}
        </div>
      </div>
    </Section>
  );
}
