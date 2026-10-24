import type { Metadata } from "next";
import type { ReactNode } from "react";
import PageHeader from "@/components/PageHeader";
import { getCurrentUser } from "@/lib/currentUser";
import { PRIVACY_EMAIL } from "@/lib/contact";

export const metadata: Metadata = { title: "Privacy" };

// Keep this true to the app: it states what's stored, who sees it, which services handle it, and
// how to leave. The Gemini lists themselves live in lib/ai-plan-prompt.ts and lib/coach/consent.ts.
const UPDATED = "24 October 2026";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <h2 className="section-title mt-6">{title}</h2>
      <section className="card flex flex-col gap-2 p-4 text-sm text-label-2 [&_strong]:font-semibold [&_strong]:text-label">
        {children}
      </section>
    </>
  );
}

function List({ items }: { items: ReactNode[] }) {
  return (
    <ul className="list-disc space-y-1 pl-5">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

const email = (
  <a href={`mailto:${PRIVACY_EMAIL}`} className="font-medium text-link">
    {PRIVACY_EMAIL}
  </a>
);

export default async function PrivacyPage() {
  const signedIn = (await getCurrentUser()) !== null;

  return (
    <main className="px-4 pt-6 pb-10 md:px-8 md:pt-10">
      <PageHeader
        title="Privacy"
        subtitle={`Last updated ${UPDATED}`}
        back={signedIn ? { href: "/profile", label: "Profile" } : { href: "/login", label: "Sign in" }}
      />
      <div className="max-w-xl">
        <p className="text-sm text-label-2">
          Gym Journal (gymjourno.fit) keeps your training records so you can plan and log your workouts. Questions
          or requests about your data: {email}.
        </p>

        <Section title="What we keep">
          <List
            items={[
              <>
                <strong>Your account:</strong> email address and password (stored scrambled, never readable).
              </>,
              <>
                <strong>Your profile:</strong> your name, and what you choose to add: date of birth, height, weight,
                gender, goal, experience, training days and time zone.
              </>,
              <>
                <strong>Your training:</strong> plans, templates, workouts, sets, notes, body weight and custom
                exercises.
              </>,
              <>
                <strong>If you use them:</strong> AI plans and what you entered for them, Coach questions and replies,
                reminder settings and the devices you turned notifications on for.
              </>,
              <>
                <strong>If you&apos;re a trainer:</strong> your name, gym, city, WhatsApp number and invite links.
              </>,
              <>
                <strong>If you run a gym:</strong> its name, area, city, phone number, invite links, and who its
                members, trainers and admins are.
              </>,
              <>
                <strong>Fees, if your gym or trainer records them:</strong> the amount, how often it&apos;s due, and
                each payment&apos;s date, amount and method (cash, UPI and so on). Gym Journal doesn&apos;t take
                payments.
              </>,
            ]}
          />
        </Section>

        <Section title="Who sees it">
          <List
            items={[
              <>
                <strong>You.</strong> We don&apos;t look at your data unless you ask us to help with a problem or the
                law requires it.
              </>,
              <>
                <strong>Your trainer, only after you accept their invite:</strong> your plans (and they can plan for
                you), logged workouts including notes, body weight, and your name, goal, experience and training days.
                Not your email, date of birth, height, gender, Coach, AI plans or meals. Remove them in Profile and they
                lose access at once; plans they made stay with you.
              </>,
              <>
                <strong>Your gym, only after you join it:</strong> your name, how many workouts you log each week, when
                you last trained, and whether you have a trainer. Not your plans, sets, notes, body weight, email or
                other profile details. Leave it in Profile and it loses access at once.
              </>,
              <>
                <strong>A gym you train at</strong> sees your name, how many of its members you train and how many
                plans you&apos;ve made them this week. Not your other clients or your own workouts.
              </>,
              <>
                <strong>Fees:</strong> the gym or trainer who records your fee, and you, in Profile. Nobody else. They
                keep their record of what you paid if you leave.
              </>,
              <>
                <strong>A trainer&apos;s details</strong> (name, gym, city, WhatsApp) are shown to people who open
                their invite link and to their clients.
              </>,
            ]}
          />
          <p>We don&apos;t sell your data or show ads.</p>
        </Section>

        <Section title="Services we use">
          <List
            items={[
              <>
                <strong>Supabase</strong> stores the app&apos;s data, in Singapore, and handles sign-in.
              </>,
              <>
                <strong>Vercel</strong> runs the website.
              </>,
              <>
                <strong>Resend</strong> sends sign-in and confirmation emails.
              </>,
              <>
                <strong>Google Gemini</strong> writes AI plans and Coach answers, only when you ask for one, and Coach
                only after you allow it in Profile. Each screen lists what&apos;s sent; your name and email never are.
                Google doesn&apos;t use it to improve its products.
              </>,
              <>
                <strong>Your browser&apos;s push service</strong> (Google, Apple or Mozilla) delivers notifications;
                what we send it is encrypted.
              </>,
            ]}
          />
        </Section>

        <Section title="Cookies">
          <p>
            Only what the app needs: keeping you signed in, remembering you&apos;ve finished setting up, and, for a
            day, an invite you opened (or that you chose &ldquo;I&apos;m a trainer&rdquo;) before signing up. No
            tracking or advertising cookies. Your browser also keeps a few settings and unsaved workouts on your
            device.
          </p>
        </Section>

        <Section title="Your choices">
          <List
            items={[
              "Change or remove your profile details in Profile at any time; most are optional.",
              "Turn notifications or Coach off, or remove your trainer, in Profile.",
              <>
                <strong>Delete your account</strong> in Profile: your account and everything in it are deleted for
                good. A copy can stay in our database host&apos;s backups for a short while, until they&apos;re
                replaced.
              </>,
              <>
                For a copy of your data, a correction, or a complaint, email {email}. We&apos;ll reply within 30 days.
                If you&apos;re not satisfied, you can complain to the Data Protection Board of India.
              </>,
            ]}
          />
        </Section>

        <Section title="Age">
          <p>Gym Journal is for people 18 or older.</p>
        </Section>

        <Section title="Changes">
          <p>If this changes in a way that matters, we&apos;ll say so in the app first.</p>
        </Section>
      </div>
    </main>
  );
}
