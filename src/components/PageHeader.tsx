import type { ReactNode } from "react";
import BackLink from "@/components/BackLink";

// Title block at the top of every screen: optional back link, title, one line of context, and
// actions aligned to the title.
export default function PageHeader({
  title,
  subtitle,
  back,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  back?: { href: string; label: string };
  actions?: ReactNode;
}) {
  return (
    <header className="mb-5">
      {back && <BackLink href={back.href} label={back.label} />}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="page-title">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-label-2">{subtitle}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2 pt-0.5">{actions}</div>}
      </div>
    </header>
  );
}
