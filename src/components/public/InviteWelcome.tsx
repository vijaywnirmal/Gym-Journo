import Link from "next/link";
import TrainerSeesList from "@/components/TrainerSeesList";
import { placeOf, type InvitePreview } from "@/lib/invitePreview";
import { ButtonLink, PublicPage, Section, SeesList } from "./PublicChrome";
import { Initials } from "./Previews";

type Open = Extract<InvitePreview, { state: "open" }>;

// What someone sees when they open a trainer's or gym's invite link before they have an account:
// who sent it, what that person or gym will see, and how to join. Accepting happens after sign-up,
// on the invite page itself, where they see the same list again.
export default function InviteWelcome({ invite }: { invite: Open }) {
  const isTrainer = invite.kind === "trainer";
  const role = invite.kind === "gym" ? invite.role : "member";
  const place = invite.kind === "trainer" ? [invite.gymName, invite.city].filter(Boolean).join(" · ") : placeOf(invite.area, invite.city);

  const title = isTrainer
    ? `Train with ${invite.name}`
    : role === "trainer"
      ? `Train at ${invite.name}`
      : role === "admin"
        ? `Help run ${invite.name}`
        : `Join ${invite.name}`;
  const lead = isTrainer
    ? `${invite.name} has invited you to GymJourno. They plan your workouts there, you log what you lift, and they see how it's going.`
    : role === "trainer"
      ? `${invite.name} has invited you to train its members on GymJourno.`
      : role === "admin"
        ? `${invite.name} has invited you to help run the gym on GymJourno.`
        : `${invite.name} has invited you to GymJourno: a training journal for your phone, free for members.`;

  const signUp = isTrainer ? "/login?invite=1" : role === "member" ? "/login?invite=gym" : `/login?invite=gym&role=${role}`;
  const signIn = `${signUp}&signin=1`;

  return (
    <PublicPage>
      <Section className="py-10 md:py-16">
        <div className="mx-auto flex max-w-xl flex-col gap-6">
          <div className="flex items-center gap-4">
            <Initials name={invite.name} size="lg" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-label-2">You&apos;re invited</p>
              <h1 className="page-title">{title}</h1>
              {place && <p className="mt-0.5 text-sm text-label-2">{place}</p>}
            </div>
          </div>
          <p className="text-[17px] text-label-2">{lead}</p>

          <ol className="card flex flex-col gap-3 p-5 text-sm">
            {[
              "Create your free GymJourno account",
              "Confirm your email",
              isTrainer || role === "member"
                ? `Join ${invite.name}. You'll see what they can see before you do`
                : role === "trainer"
                  ? "Set up your trainer details, then join the gym"
                  : "Add your name, then join the gym",
            ].map((step, i) => (
              <li key={step} className="flex gap-3">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent/10 text-xs font-semibold text-link">
                  {i + 1}
                </span>
                <span className="pt-0.5">{step}</span>
              </li>
            ))}
          </ol>

          {isTrainer && (
            <section className="card p-5">
              <TrainerSeesList name={invite.name} />
            </section>
          )}
          {!isTrainer && role === "member" && (
            <SeesList
              title={invite.name}
              sees={["Your name", "How many workouts you log each week, and when you last trained", "Whether you have a trainer"]}
              doesntSee={["Your plans, sets, notes or body weight", "Your email or other profile details"]}
            />
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <ButtonLink href={signUp}>Create account to join</ButtonLink>
            <Link href={signIn} className="py-2 text-center text-sm font-semibold text-link sm:px-3">
              I already have an account
            </Link>
          </div>
          <p className="text-sm text-label-3">
            Not sure what GymJourno is?{" "}
            <Link href="/" className="text-link">
              Have a look first
            </Link>
            . You can leave {isTrainer ? "your trainer" : "the gym"} any time from your profile.{" "}
            <Link href="/privacy" className="text-link">
              Privacy
            </Link>
          </p>
        </div>
      </Section>
    </PublicPage>
  );
}
