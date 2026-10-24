import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import PageHeader from "@/components/PageHeader";
import { getProfile } from "@/lib/queries";
import { getMyTrainerProfile } from "@/lib/trainers";
import { createClient } from "@/lib/supabase/server";
import { GYM_JOIN_COOKIE, gymJoinCodeOf, isInviteCode } from "@/lib/trainerInvites";
import { joinName, namePartsOf } from "@/lib/names";
import TrainerSetupForm from "./TrainerSetupForm";

export const metadata: Metadata = { title: "Trainer account" };

export default async function TrainerSetupPage({ searchParams }: PageProps<"/trainer/setup">) {
  const [trainer, profile, { next }] = await Promise.all([getMyTrainerProfile(), getProfile(), searchParams]);
  const onboarded = profile?.onboarded === true;
  const { firstName, lastName } = namePartsOf(profile);
  const gym = trainer ? null : await joiningGym(typeof next === "string" ? next : undefined, onboarded);

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
            gymName: trainer?.gym_name ?? gym?.gym_name ?? "",
            city: trainer?.city ?? gym?.city ?? "",
            whatsapp: trainer?.whatsapp ?? "",
          }}
          askAge={!onboarded}
          editing={trainer !== null}
          next={typeof next === "string" ? next : undefined}
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

// The gym a new trainer is joining (from its trainer link), to fill in their gym and city.
async function joiningGym(next: string | undefined, onboarded: boolean) {
  const remembered = onboarded ? undefined : (await cookies()).get(GYM_JOIN_COOKIE)?.value;
  const code = gymJoinCodeOf(next ?? "") ?? (isInviteCode(remembered) ? remembered : null);
  if (!code) return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc("gym_invite_details", { p_code: code });
  const details = (data as { role: string | null; gym_name: string | null; city: string | null }[] | null)?.[0];
  return details?.role === "trainer" ? details : null;
}
