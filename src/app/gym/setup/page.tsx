import type { Metadata } from "next";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { getProfile } from "@/lib/queries";
import { getAdminGym } from "@/lib/gyms";
import { joinName, namePartsOf } from "@/lib/names";
import GymSetupForm from "./GymSetupForm";

export const metadata: Metadata = { title: "Gym account" };

export default async function GymSetupPage() {
  const [gym, profile] = await Promise.all([getAdminGym(), getProfile()]);
  const onboarded = profile?.onboarded === true;
  const { firstName, lastName } = namePartsOf(profile);

  return (
    <main className="px-4 pt-6 md:px-8 md:pt-10">
      <PageHeader
        title={gym ? "Gym details" : "Set up your gym"}
        subtitle="Trainers and members see these when you invite them."
        back={gym ? { href: "/gym", label: "Gym" } : onboarded ? { href: "/profile", label: "Profile" } : undefined}
      />
      <div className="max-w-md">
        <GymSetupForm
          initial={{
            name: gym?.name ?? "",
            city: gym?.city ?? "",
            area: gym?.area ?? "",
            phone: gym?.phone ?? "",
            ownerName: joinName(firstName, lastName),
          }}
          askOwner={!onboarded}
          editing={gym !== null}
        />
        {!onboarded && (
          <p className="pb-8 text-center text-sm">
            <Link href="/onboarding" className="text-link">
              Not a gym? Set up a regular account
            </Link>
          </p>
        )}
      </div>
    </main>
  );
}
