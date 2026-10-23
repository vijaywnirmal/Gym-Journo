import type { Metadata } from "next";
import Link from "next/link";
import Icon from "@/components/Icon";
import { getProfile } from "@/lib/queries";
import { getMyTrainer, getMyTrainerProfile } from "@/lib/trainers";
import { getAdminGym, getMyGymMembership, getMyGymTrainerOffer, getMyTrainerGyms } from "@/lib/gyms";
import { profileFieldsFromProfile } from "@/lib/profile-fields";
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

  return (
    <main className="px-4 pt-6 pb-10 md:px-8 md:pt-10">
      <PageHeader title="Profile" />

      <ProfileCard initial={profileFieldsFromProfile(profile)} email={user?.email ?? null} />

      {offer && <GymOfferCard offer={offer} currentTrainer={myTrainer?.trainer.display_name ?? null} />}

      {myTrainer && (
        <YourTrainerSection
          myTrainer={myTrainer}
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
        gymTrainer={myTrainer && membership && myTrainer.gymId === membership.gym.id ? myTrainer.trainer.display_name : null}
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

      {trainerProfile && (
        <>
          <h2 className="section-title mt-8">Trainer</h2>
          <section className="card divide-y divide-separator">
            <LinkRow href="/trainer/invite" title="Invite a client" text="Share your join link on WhatsApp" />
            <LinkRow
              href="/trainer/setup"
              title="Trainer details"
              text={[trainerProfile.display_name, trainerProfile.gym_name, trainerProfile.city].filter(Boolean).join(" · ")}
            />
          </section>
        </>
      )}

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
        {!trainerProfile && (
          <LinkRow href="/trainer/setup" title="Set up a trainer account" text="Invite clients and plan their workouts" />
        )}
        {!adminGym && <LinkRow href="/gym/setup" title="Set up a gym" text="Invite trainers and members" />}
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
