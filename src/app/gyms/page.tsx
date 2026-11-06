import type { Metadata } from "next";
import { ButtonLink, ClosingCall, FeatureCard, PublicPage, Section, SeesList } from "@/components/public/PublicChrome";
import { FeesPreview, MembersPreview } from "@/components/public/Previews";

const TITLE = "GymJourno for gyms";
const DESCRIPTION =
  "Members join with a QR code at your front desk. See who's training, who's gone quiet, and whose fees are due. Free to start.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  openGraph: { title: TITLE, description: DESCRIPTION },
};

const SIGN_UP = "/login?role=gym";

// For gym owners: what they get, and what their members share. Every claim is something the gym
// screens do today.
export default function GymsPage() {
  return (
    <PublicPage>
      <Section className="grid items-center gap-10 py-12 md:grid-cols-[1.05fr_1fr] md:gap-14 md:py-20">
        <div className="flex flex-col items-start gap-5">
          <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-link">For gyms</span>
          <h1 className="text-[2.25rem] leading-[1.08] font-semibold tracking-[-0.03em] md:text-[3.25rem]">
            Members, trainers and fees in one place.
          </h1>
          <p className="max-w-xl text-lg text-label-2">
            Put a QR code at the front desk and your members join your gym on GymJourno. They get a training journal;
            you see who&apos;s coming in, who&apos;s gone quiet, and whose fees are due.
          </p>
          <div className="flex flex-wrap gap-3">
            <ButtonLink href={SIGN_UP}>Set up your gym</ButtonLink>
            <ButtonLink href="/demo" variant="secondary">
              See what members get
            </ButtonLink>
          </div>
          <p className="text-sm text-label-3">Free to start. Your members use GymJourno free too.</p>
        </div>
        <div className="flex flex-col gap-3">
          <MembersPreview />
          <FeesPreview />
        </div>
      </Section>

      <div className="border-y border-separator bg-surface/60">
        <Section className="py-16 md:py-24">
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">How it works</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <FeatureCard icon="share" title="A QR code to join">
              Print your gym&apos;s poster for the front desk. Members scan it, sign up and join your gym. Trainers and
              an admin join with their own links.
            </FeatureCard>
            <FeatureCard icon="people" title="See who's training">
              Every member&apos;s workouts this week and when they last trained, with a list of who&apos;s gone quiet
              so you can check in before they leave.
            </FeatureCard>
            <FeatureCard icon="dumbbell" title="Suggest a trainer">
              Suggest one of your trainers to a member. The member chooses whether to accept, and only then does the
              trainer see their workouts.
            </FeatureCard>
            <FeatureCard icon="checkmark" title="Track fees">
              Set what each member pays, record payments, cash or UPI, and see who&apos;s due or overdue. GymJourno
              doesn&apos;t take payments.
            </FeatureCard>
          </div>
        </Section>
      </div>

      <Section className="py-16 md:py-24">
        <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Members keep their workouts private</h2>
        <p className="mt-3 max-w-2xl text-label-2">
          A member sees exactly this before they join, and can leave your gym from their profile at any time.
        </p>
        <div className="mt-6">
          <SeesList
            title="The gym"
            sees={[
              "Their name",
              "How many workouts they log each week, and when they last trained",
              "Whether they have a trainer",
            ]}
            doesntSee={["Their plans, sets, notes or body weight", "Their email or other profile details"]}
          />
        </div>
      </Section>

      <ClosingCall
        title="Set up your gym in a few minutes"
        text="Add your gym's details, print the poster, and invite your trainers."
        primary={{ href: SIGN_UP, label: "Set up your gym" }}
        secondary={{ href: "/trainers", label: "A trainer?" }}
      />
    </PublicPage>
  );
}
