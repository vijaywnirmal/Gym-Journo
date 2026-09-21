import Link from "next/link";
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
    <main className="px-4 pt-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold text-neutral-100">Profile</h1>
        <SignOutButton />
      </div>
      <ProfileCard initial={profileFieldsFromProfile(profile)} email={user?.email ?? null} />
      <CoachConsentSection consentedAt={profile?.coach_consent_at ?? null} />
      <Link
        href="/body"
        className="mt-5 mb-1 flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-900 p-4"
      >
        <span className="text-sm font-medium text-neutral-100">📈 Body & Progress</span>
        <span className="text-neutral-500">→</span>
      </Link>
      <div className="pb-10">
        <DeleteAccountSection />
      </div>
    </main>
  );
}
