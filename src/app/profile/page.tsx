import { getProfile } from "@/lib/queries";
import { profileFieldsFromProfile } from "@/lib/profile-fields";
import SignOutButton from "@/components/SignOutButton";
import ProfileEditForm from "./ProfileEditForm";
import DeleteAccountSection from "./DeleteAccountSection";

export default async function ProfilePage() {
  const profile = await getProfile();

  return (
    <main className="px-4 pt-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold text-neutral-100">Profile</h1>
        <SignOutButton />
      </div>
      <ProfileEditForm initial={profileFieldsFromProfile(profile)} />
      <div className="pb-10">
        <DeleteAccountSection />
      </div>
    </main>
  );
}
