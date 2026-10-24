import type { Metadata } from "next";
import Link from "next/link";
import Icon from "@/components/Icon";
import { getProfile } from "@/lib/queries";
import { getClientOverview, getMyTrainer, getMyTrainerProfile } from "@/lib/trainers";
import RemoveButton from "@/components/RemoveButton";
import { stopTraining } from "./trainerActions";
import { getAdminGym, getMyGymMembership, getMyGymTrainerOffer, getMyTrainerGyms, getTrainerLinkGymId } from "@/lib/gyms";
import { profileFieldsFromProfile } from "@/lib/profile-fields";
import { joinName, namePartsOf } from "@/lib/names";
import { formatDateLong, todayIn } from "@/lib/date";
import SignOutButton from "@/components/SignOutButton";
import PageHeader from "@/components/PageHeader";
import { createClient } from "@/lib/supabase/server";
import ProfileCard from "./ProfileCard";
import DeleteAccountSection from "./DeleteAccountSection";
import CoachConsentSection from "./CoachConsentSection";
import RemindersSection from "./RemindersSection";
import YourTrainerSection from "./YourTrainerSection";
import YourGymSection from "./YourGymSection";
import GymOfferCard from "./GymOfferCard";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const [profile, supabase, myTrainer, trainerProfile, membership, offer, trainerGyms, adminGym] = await Promise.all([
    getProfile(),
    createClient(),
    getMyTrainer(),
    getMyTrainerProfile(),
    getMyGymMembership(),
    getMyGymTrainerOffer(),
    getMyTrainerGyms(),
    getAdminGym(),
  ]);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Trainers and gym staff have no journal here (src/lib/workAccount.ts): just their account and work.
  if (trainerProfile || adminGym) {
    const { firstName, lastName } = namePartsOf(profile);
    const clients = trainerProfile ? (await getClientOverview()).length : 0;
    return (
      <main className="px-4 pt-6 pb-10 md:px-8 md:pt-10">
        <PageHeader title="Profile" subtitle={joinName(firstName, lastName) || undefined} />

        {adminGym && (
          <>
            <h2 className="section-title">Gym</h2>
            <section className="card divide-y divide-separator">
              <LinkRow href="/gym/invite" title="Invite people" text="Member poster, trainer and admin links" />
              <LinkRow
                href="/gym/setup"
                title="Gym details"
                text={[adminGym.name, adminGym.area, adminGym.city].filter(Boolean).join(" · ")}
              />
            </section>
          </>
        )}

        {trainerProfile && (
          <>
            <h2 className={`section-title ${adminGym ? "mt-8" : ""}`}>Trainer</h2>
            <section className="card divide-y divide-separator">
              <LinkRow href="/trainer/invite" title="Invite a client" text="Share your join link on WhatsApp" />
              <LinkRow
                href="/trainer/setup"
                title="Trainer details"
                text={[trainerProfile.display_name, trainerProfile.gym_name, trainerProfile.city].filter(Boolean).join(" · ")}
              />
              <RemoveButton
                label="Stop training clients"
                warning={[
                  clients > 0 && `Your ${clients} client${clients === 1 ? "" : "s"} will lose you as their trainer.`,
                  "Your trainer details and invite link are deleted; plans you made stay with your clients.",
                  adminGym ? "This account stays a gym account." : "This account goes back to your own workout journal.",
                ]
                  .filter(Boolean)
                  .join(" ")}
                action={stopTraining}
                confirmLabel="Stop"
                done="/"
                subtle
              />
            </section>
          </>
        )}

        <YourGymSection
          membership={null}
          trainerGyms={trainerGyms}
          adminOf={adminGym && !adminGym.isOwner ? adminGym : null}
          gymTrainer={null}
        />

        <h2 className="section-title mt-8">Privacy</h2>
        <section className="card">
          <LinkRow href="/privacy" title="Privacy policy" text="What's kept, who sees it, and how to delete it" />
        </section>

        <h2 className="section-title mt-8">Account</h2>
        <section className="card divide-y divide-separator">
          {!trainerProfile && (
            <LinkRow href="/trainer/setup" title="Train clients too" text="Invite clients and plan their workouts" />
          )}
          {!adminGym && <LinkRow href="/gym/setup" title="Set up a gym" text="Invite trainers and members" />}
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold">Sign out</p>
              <p className="truncate text-sm text-label-2">{user?.email ?? "This device"}</p>
            </div>
            <SignOutButton />
          </div>
          <DeleteAccountSection summary={workDeleteSummary(trainerProfile !== null, adminGym)} />
        </section>
      </main>
    );
  }

  // The trainer the member's gym arranged stops training them if they leave it.
  const gymArrangedTrainer =
    myTrainer && membership && (await getTrainerLinkGymId(myTrainer.linkId)) === membership.gym.id
      ? myTrainer.trainer.display_name
      : null;

  return (
    <main className="px-4 pt-6 pb-10 md:px-8 md:pt-10">
      <PageHeader title="Profile" />

      <ProfileCard initial={profileFieldsFromProfile(profile)} email={user?.email ?? null} />

      {offer && (
        <GymOfferCard
          offer={offer}
          currentTrainer={myTrainer && { id: myTrainer.trainerId, name: myTrainer.trainer.display_name }}
        />
      )}

      {myTrainer && (
        <YourTrainerSection
          myTrainer={myTrainer}
          gym={gymArrangedTrainer && membership ? membership.gym : null}
          since={formatDateLong(todayIn(profile?.timezone, new Date(myTrainer.startedAt)))}
        />
      )}

      <YourGymSection
        membership={
          membership && {
            gym: membership.gym,
            since: formatDateLong(todayIn(profile?.timezone, new Date(membership.startedAt))),
          }
        }
        trainerGyms={trainerGyms}
        adminOf={null}
        gymTrainer={gymArrangedTrainer}
      />

      <h2 className="section-title mt-8">Tracking</h2>
      <Link href="/body" className="card flex items-center gap-3 px-4 py-3 hover:bg-fill">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-green/12 text-green">
          <Icon name="body" className="size-[18px]" strokeWidth={2} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">Body &amp; measurements</span>
          <span className="block text-sm text-label-2">Body weight, measurements and training days</span>
        </span>
        <Icon name="chevronRight" className="size-4 text-label-3" strokeWidth={2} />
      </Link>

      <RemindersSection
        enabled={profile?.workout_reminders ?? false}
        time={(profile?.reminder_time ?? "18:00").slice(0, 5)}
        hasTrainer={myTrainer !== null}
      />

      <h2 className="section-title mt-8">Privacy</h2>
      <CoachConsentSection consentedAt={profile?.coach_consent_at ?? null} timeZone={profile?.timezone ?? null} />
      <section className="card mt-3">
        <LinkRow href="/privacy" title="Privacy policy" text="What's kept, who sees it, and how to delete it" />
      </section>

      <h2 className="section-title mt-8">Account</h2>
      <section className="card divide-y divide-separator">
        <LinkRow href="/trainer/setup" title="Set up a trainer account" text="Invite clients and plan their workouts" />
        <LinkRow href="/gym/setup" title="Set up a gym" text="Invite trainers and members" />
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold">Sign out</p>
            <p className="truncate text-sm text-label-2">{user?.email ?? "This device"}</p>
          </div>
          <SignOutButton />
        </div>
        <DeleteAccountSection />
      </section>
    </main>
  );
}

function LinkRow({ href, title, text }: { href: string; title: string; text: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 px-4 py-3 hover:bg-fill">
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{title}</span>
        <span className="block truncate text-sm text-label-2">{text}</span>
      </span>
      <Icon name="chevronRight" className="size-4 text-label-3" strokeWidth={2} />
    </Link>
  );
}

// What deleting a work account removes, and what stays with other people.
function workDeleteSummary(isTrainer: boolean, gym: { name: string; isOwner: boolean } | null): string {
  const parts = [
    gym?.isOwner ? `Removes your account and your gym, ${gym.name}: its member list, trainers and links.` : "Removes your account.",
    isTrainer && "Your clients keep their accounts and the plans you made them.",
    gym?.isOwner && "Members and trainers keep their own accounts.",
    gym && !gym.isOwner && `${gym.name} stays as it is.`,
  ];
  return parts.filter(Boolean).join(" ");
}
