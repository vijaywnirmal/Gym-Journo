import type { ReactNode } from "react";
import Link from "next/link";
import Icon from "@/components/Icon";
import { SIGN_UP_HREF } from "@/lib/publicPages";
import { ButtonLink, ClosingCall, PublicPage, Section } from "./PublicChrome";
import { CoachPreview, PlanPreview, ProgressPreview, RecordsPreview, WeekPreview, WorkoutPreview } from "./Previews";

// gymjourno.fit for someone who isn't signed in: what it is, who it's for, and the two ways in.
// Individuals first (they're who opens it every day), then trainers and gyms. Every claim here is
// something the app does today.
export default function PublicHome() {
  return (
    <PublicPage>
      <Section className="grid items-center gap-10 py-12 md:grid-cols-[1.05fr_1fr] md:gap-14 md:py-20">
        <div className="flex flex-col items-start gap-5">
          <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-link">Free to start</span>
          <h1 className="text-[2.25rem] leading-[1.08] font-semibold tracking-[-0.03em] md:text-[3.25rem]">
            Plan your week. Log every set. See yourself get stronger.
          </h1>
          <p className="max-w-xl text-lg text-label-2">
            GymJourno is a training journal for your phone. Plan your workouts, log what you actually lift, and watch
            your progress add up, on your own or with your trainer.
          </p>
          <div className="flex flex-wrap gap-3">
            <ButtonLink href={SIGN_UP_HREF}>Start free</ButtonLink>
            <ButtonLink href="/demo" variant="secondary">
              See a demo
            </ButtonLink>
          </div>
          <p className="text-sm text-label-3">Works in any phone browser. Add it to your home screen like an app.</p>
        </div>
        <div className="flex flex-col gap-3" aria-label="A preview of GymJourno with sample data" role="group">
          <WeekPreview />
          <WorkoutPreview exercises={1} />
        </div>
      </Section>

      <div className="border-y border-separator bg-surface/60">
        <Section className="flex flex-col gap-16 py-16 md:gap-24 md:py-24">
          <Feature
            title="Plan your week"
            text="Pick your training days and plan each one, or follow a multi-week program. Rest days and days off count too, so a missed day is only ever one you meant to train."
            preview={
              <div className="flex flex-col gap-3">
                <WeekPreview />
                <PlanPreview />
              </div>
            }
          />
          <Feature
            flip
            title="Log every set"
            text="Sets, reps, weight and how hard it felt, with last week's numbers beside each set. A rest timer and plate calculator are built in, and logging keeps working when the gym has no signal."
            preview={<WorkoutPreview />}
          />
          <Feature
            title="See your progress"
            text="Personal records, strength trends and weekly volume for each muscle, worked out from what you logged. No spreadsheets."
            preview={
              <div className="flex flex-col gap-3">
                <ProgressPreview />
                <RecordsPreview />
              </div>
            }
          />
          <Feature
            flip
            title="Ask about your training"
            text="Coach answers questions about your training from your own logs, and shows the numbers it used. It's off until you turn it on."
            preview={<CoachPreview />}
          />
          <ul className="grid gap-x-8 gap-y-3 text-sm text-label-2 sm:grid-cols-2 lg:grid-cols-4">
            {[
              "700+ exercises with how-to steps and pictures",
              "Swap an exercise mid-workout for one that works the same muscles",
              "Short workouts suggested when nothing's planned",
              "Workout reminders on your phone",
            ].map((item) => (
              <li key={item} className="flex gap-2">
                <Icon name="checkmark" className="mt-0.5 size-4 shrink-0 text-green" strokeWidth={2.25} />
                {item}
              </li>
            ))}
          </ul>
        </Section>
      </div>

      <Section className="py-16 md:py-24">
        <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Who it&apos;s for</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <Audience
            title="You"
            text="Train on your own and keep every workout, record and trend in one place."
            link={{ href: SIGN_UP_HREF, label: "Start free" }}
          />
          <Audience
            title="Trainers and creators"
            text="Plan your clients' workouts, see who trained, and keep fees in one place instead of WhatsApp."
            link={{ href: "/trainers", label: "GymJourno for trainers" }}
          />
          <Audience
            title="Gyms"
            text="Members join with a QR code. See who's training, who's gone quiet, and whose fees are due."
            link={{ href: "/gyms", label: "GymJourno for gyms" }}
          />
        </div>
      </Section>

      <div className="border-t border-separator">
        <Section className="grid gap-6 py-12 sm:grid-cols-3">
          <Pledge title="Free to start" text="Sign up with your email. No card needed." />
          <Pledge
            title="Your data stays yours"
            text="We don't sell your data or show ads. Delete your account and everything in it whenever you like."
            link={{ href: "/privacy", label: "Privacy" }}
          />
          <Pledge title="Your trainer sees only what you allow" text="Nobody sees your workouts unless you accept their invite." />
        </Section>
      </div>

      <ClosingCall
        title="Start your first week"
        text="Plan it in a few minutes, then log as you go."
        primary={{ href: SIGN_UP_HREF, label: "Start free" }}
        secondary={{ href: "/demo", label: "See a demo" }}
      />
    </PublicPage>
  );
}

function Feature({ title, text, preview, flip = false }: { title: string; text: string; preview: ReactNode; flip?: boolean }) {
  return (
    <div className="grid items-center gap-6 md:grid-cols-2 md:gap-14">
      <div className={flip ? "md:order-2" : ""}>
        <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">{title}</h2>
        <p className="mt-3 max-w-md text-label-2 md:text-lg">{text}</p>
      </div>
      <div className={flip ? "md:order-1" : ""}>{preview}</div>
    </div>
  );
}

function Audience({ title, text, link }: { title: string; text: string; link: { href: string; label: string } }) {
  return (
    <div className="card flex flex-col gap-2 p-5">
      <h3 className="text-[17px] font-semibold">{title}</h3>
      <p className="flex-1 text-sm text-label-2">{text}</p>
      <Link href={link.href} className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-link">
        {link.label}
        <Icon name="chevronRight" className="size-4" />
      </Link>
    </div>
  );
}

function Pledge({ title, text, link }: { title: string; text: string; link?: { href: string; label: string } }) {
  return (
    <div>
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-label-2">
        {text}
        {link && (
          <>
            {" "}
            <Link href={link.href} className="text-link">
              {link.label}
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
