import Link from "next/link";
import Icon from "@/components/Icon";
import { getProfile } from "@/lib/queries";
import { profileFieldsFromProfile } from "@/lib/profile-fields";
import SignOutButton from "@/components/SignOutButton";
import { createClient } from "@/lib/supabase/server";
import ProfileCard from "./ProfileCard";
import DeleteAccountSection from "./DeleteAccountSection";
import CoachConsentSection from "./CoachConsentSection";

export default async function ProfilePage() {
  const [profile, supabase] = await Promise.all([getProfile(), createClient()]);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="screen-enter px-4 pt-4">
      <header className="mb-5 flex items-end justify-between px-1">
        <h1 className="large-title">Profile</h1>
        <SignOutButton />
      </header>
      <ProfileCard initial={profileFieldsFromProfile(profile)} email={user?.email ?? null} />
      <CoachConsentSection consentedAt={profile?.coach_consent_at ?? null} />
      <Link
        href="/body"
        className="mt-5 mb-1 flex items-center justify-between rounded-xl bg-surface px-4 py-3"
      >
        <span className="flex items-center gap-3">
          <span className="grid size-7 place-items-center rounded-lg bg-green text-white">
            <Icon name="progress" className="size-[18px]" strokeWidth={2} />
          </span>
          <span className="text-base text-label">Body & Progress</span>
        </span>
        <Icon name="chevronRight" className="size-4 text-label-3" strokeWidth={2.25} />
      </Link>
      <div className="pb-10">
        <DeleteAccountSection />
      </div>
    </main>
  );
}
