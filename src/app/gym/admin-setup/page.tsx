import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import { getProfile } from "@/lib/queries";
import { joinName, namePartsOf } from "@/lib/names";
import AdminSetupForm from "./AdminSetupForm";

export const metadata: Metadata = { title: "Your account" };

export default async function AdminSetupPage() {
  const profile = await getProfile();
  if (profile?.onboarded) redirect("/");
  const { firstName, lastName } = namePartsOf(profile);

  return (
    <main className="px-4 pt-6 md:px-8 md:pt-10">
      <PageHeader title="Set up your account" subtitle="You're joining a gym's team." />
      <div className="max-w-md">
        <AdminSetupForm initialName={joinName(firstName, lastName)} />
        <p className="pb-8 text-center text-sm">
          <Link href="/onboarding" className="text-link">
            Want to log your own workouts? Set up a full account
          </Link>
        </p>
      </div>
    </main>
  );
}
