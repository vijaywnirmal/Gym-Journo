import type { Metadata } from "next";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { getProfile } from "@/lib/queries";
import { getMyTrainerProfile } from "@/lib/trainers";
import { joinName, namePartsOf } from "@/lib/names";
import TrainerSetupForm from "./TrainerSetupForm";

export const metadata: Metadata = { title: "Trainer account" };

export default async function TrainerSetupPage() {
  const [trainer, profile] = await Promise.all([getMyTrainerProfile(), getProfile()]);
  const onboarded = profile?.onboarded === true;
  const { firstName, lastName } = namePartsOf(profile);

  return (
    <main className="px-4 pt-6 md:px-8 md:pt-10">
      <PageHeader
        title={trainer ? "Trainer details" : "Set up your trainer account"}
        subtitle="Clients see these when you invite them."
        back={onboarded ? { href: "/profile", label: "Profile" } : undefined}
      />
      <div className="max-w-md">
        <TrainerSetupForm
          initial={{
            displayName: trainer?.display_name ?? joinName(firstName, lastName),
            gymName: trainer?.gym_name ?? "",
            city: trainer?.city ?? "",
            whatsapp: trainer?.whatsapp ?? "",
          }}
          askAge={!onboarded}
          editing={trainer !== null}
        />
        {!onboarded && (
          <p className="pb-8 text-center text-sm">
            <Link href="/onboarding" className="text-link">
              Not a trainer? Set up a regular account
            </Link>
          </p>
        )}
      </div>
    </main>
  );
}
