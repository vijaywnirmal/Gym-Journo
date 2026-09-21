import Link from "next/link";
import { getProfile } from "@/lib/queries";
import { profileFieldsFromProfile } from "@/lib/profile-fields";
import SignOutButton from "@/components/SignOutButton";
import ProfileEditForm from "./ProfileEditForm";
import DeleteAccountSection from "./DeleteAccountSection";
import CoachConsentSection from "./CoachConsentSection";

export default async function ProfilePage() {
  const profile = await getProfile();

  return (
    <main className="px-4 pt-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold text-neutral-100">Profile</h1>
        <SignOutButton />
      </div>
      <ProfileEditForm initial={profileFieldsFromProfile(profile)} />
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
