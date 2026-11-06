import type { Metadata } from "next";
import { ButtonLink, ClosingCall, FeatureCard, PublicPage, Section, SeesList } from "@/components/public/PublicChrome";
import { ClientsPreview, WorkoutPreview } from "@/components/public/Previews";

const TITLE = "GymJourno for trainers";
const DESCRIPTION =
  "Plan your clients' workouts, see who trained, and keep their fees in one place instead of WhatsApp. Free to start.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  openGraph: { title: TITLE, description: DESCRIPTION },
};

const SIGN_UP = "/login?role=trainer";

// For personal trainers, coaches and fitness creators: what they get, and what their clients share.
// Every claim is something the trainer screens do today.
export default function TrainersPage() {
  return (
    <PublicPage>
      <Section className="grid items-center gap-10 py-12 md:grid-cols-[1.05fr_1fr] md:gap-14 md:py-20">
        <div className="flex flex-col items-start gap-5">
          <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-link">For trainers and creators</span>
          <h1 className="text-[2.25rem] leading-[1.08] font-semibold tracking-[-0.03em] md:text-[3.25rem]">
            Your clients&apos; training in one place, not in WhatsApp.
          </h1>
          <p className="max-w-xl text-lg text-label-2">
            Send a link, and your clients join you on GymJourno. Plan their days, see who trained, review what they
            lifted, and keep track of who&apos;s paid.
          </p>
          <div className="flex flex-wrap gap-3">
            <ButtonLink href={SIGN_UP}>Create your trainer account</ButtonLink>
            <ButtonLink href="/demo" variant="secondary">
              See what clients see
            </ButtonLink>
          </div>
          <p className="text-sm text-label-3">Free to start. Your clients use GymJourno free too.</p>
        </div>
        <div className="flex flex-col gap-3">
          <ClientsPreview />
        </div>
      </Section>

      <div className="border-y border-separator bg-surface/60">
        <Section className="py-16 md:py-24">
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">How it works</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <FeatureCard icon="share" title="Invite with a link">
              Make an invite link and share it on WhatsApp. Clients sign up and join you in a couple of taps.
            </FeatureCard>
            <FeatureCard icon="calendar" title="Plan their days">
              Plan a client&apos;s workouts day by day, or put them on one of your multi-week programs. They see it on
              their phone that day.
            </FeatureCard>
            <FeatureCard icon="people" title="See who trained">
              Every client&apos;s week at a glance: done, planned, missed or nothing planned. Open anyone to see the
              sets they logged, their notes and their body weight.
            </FeatureCard>
            <FeatureCard icon="checkmark" title="Track fees">
              Set what each client pays and record payments, cash or UPI. Clients see their own fee and payment
              history. GymJourno doesn&apos;t take payments.
            </FeatureCard>
          </div>
        </Section>
      </div>

      <Section className="grid items-center gap-10 py-16 md:grid-cols-2 md:gap-14 md:py-24">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Your clients log, you coach</h2>
          <p className="mt-3 max-w-md text-label-2 md:text-lg">
            Clients log their sets with last week&apos;s numbers beside them, so they know what to beat. You see the
            same log the moment they save it.
          </p>
        </div>
        <WorkoutPreview exercises={2} />
      </Section>

      <Section className="pb-4">
        <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Clients choose to share</h2>
        <p className="mt-3 max-w-2xl text-label-2">
          A client sees exactly this before they accept your invite, and can remove you from their profile at any time.
        </p>
        <div className="mt-6">
          <SeesList
            title="Their trainer"
            sees={[
              "Their workout plans, and can plan workouts for them",
              "Their logged workouts, including notes",
              "Their body weight",
              "Their name, goal, experience and training days",
            ]}
            doesntSee={["Their email, date of birth, height or gender", "Their Coach questions, AI plans or meals"]}
          />
        </div>
      </Section>

      <ClosingCall
        title="Bring your first client this week"
        text="Set up your trainer account, make an invite link, and send it."
        primary={{ href: SIGN_UP, label: "Create your trainer account" }}
        secondary={{ href: "/gyms", label: "Run a gym?" }}
      />
    </PublicPage>
  );
}
