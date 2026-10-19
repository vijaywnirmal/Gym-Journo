import Link from "next/link";
import Icon from "@/components/Icon";
import { getProfile } from "@/lib/queries";
import { profileFieldsFromProfile } from "@/lib/profile-fields";
import SignOutButton from "@/components/SignOutButton";
import PageHeader from "@/components/PageHeader";
import { createClient } from "@/lib/supabase/server";
import ProfileCard from "./ProfileCard";
import DeleteAccountSection from "./DeleteAccountSection";
import CoachConsentSection from "./CoachConsentSection";
import RemindersSection from "./RemindersSection";

export default async function ProfilePage() {
  const [profile, supabase] = await Promise.all([getProfile(), createClient()]);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="px-4 pt-6 pb-10 md:px-8 md:pt-10">
      <PageHeader title="Profile" />

      <ProfileCard initial={profileFieldsFromProfile(profile)} email={user?.email ?? null} />

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
      />

      <h2 className="section-title mt-8">Privacy</h2>
      <CoachConsentSection consentedAt={profile?.coach_consent_at ?? null} />

      <h2 className="section-title mt-8">Account</h2>
      <section className="card divide-y divide-separator">
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
