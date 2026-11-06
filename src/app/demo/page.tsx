import type { Metadata } from "next";
import { ButtonLink, PublicPage, Section } from "@/components/public/PublicChrome";
import {
  CoachPreview,
  PlanPreview,
  ProgressPreview,
  RecordsPreview,
  WeekPreview,
  WorkoutPreview,
} from "@/components/public/Previews";
import { DEMO_NAME } from "@/lib/demoData";
import { SIGN_UP_HREF } from "@/lib/publicPages";

const TITLE = "GymJourno demo";
const DESCRIPTION = "Look around a sample week in GymJourno before you sign up: the plan, a logged workout, progress and Coach.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  openGraph: { title: TITLE, description: DESCRIPTION },
};

// Try before signing up: a made-up lifter's week (lib/demoData.ts), laid out like the app.
// Read-only, so there's nothing to save and nothing that needs an account.
export default function DemoPage() {
  return (
    <PublicPage>
      <div className="border-b border-separator bg-accent/8">
        <Section className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm">
            <span className="font-semibold">This is a demo with sample data.</span>{" "}
            <span className="text-label-2">Start free to plan and log your own.</span>
          </p>
          <ButtonLink href={SIGN_UP_HREF} className="h-9 self-start px-4 text-sm sm:self-auto">
            Start free
          </ButtonLink>
        </Section>
      </div>

      <Section className="py-8 md:py-12">
        <h1 className="page-title">{DEMO_NAME}&apos;s week</h1>
        <p className="mt-0.5 text-sm text-label-2">Build muscle · Intermediate · 4 days a week</p>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="flex flex-col gap-3">
            <h2 className="section-title mb-0">Today</h2>
            <PlanPreview />
            <WeekPreview />
            <h2 className="section-title mt-3 mb-0">Last workout</h2>
            <WorkoutPreview />
          </div>
          <div className="flex flex-col gap-3">
            <h2 className="section-title mb-0">Progress</h2>
            <ProgressPreview />
            <RecordsPreview />
            <h2 className="section-title mt-3 mb-0">Coach</h2>
            <CoachPreview />
          </div>
        </div>

        <div className="mt-10 flex flex-col items-start gap-3 rounded-xl border border-separator bg-surface p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-label-2">Your own week starts empty. Plan your first day in a few minutes.</p>
          <ButtonLink href={SIGN_UP_HREF}>Start free</ButtonLink>
        </div>
      </Section>
    </PublicPage>
  );
}
